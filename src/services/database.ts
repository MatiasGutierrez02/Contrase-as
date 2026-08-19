import Dexie, { type EntityTable } from "dexie";
import type {
  EncryptedPasswordRecord,
  PasswordEntry,
  PasswordEntryInput,
  PasswordSummary,
  StoredPasswordRecord,
} from "@/models/PasswordEntry";
import { isPlaintextPasswordRecord } from "@/models/PasswordEntry";
import {
  authenticateLegacyPrf,
  authenticateWebAuthn,
  registerWebAuthnCredential,
  type StoredLegacyPrfCredential,
  type StoredWebAuthnCredential,
} from "@/services/biometric";
import {
  decryptCredentials,
  encryptCredentials,
  generateVaultKeyPair,
  makePrivateKeyNonExtractable,
  unprotectPrivateKey,
  type ProtectedPrivateKey,
  type VaultKeyPair,
  type VaultKeyProvider,
} from "@/services/crypto";

interface LegacyStoredVaultKeyPair extends VaultKeyPair {
  id: "primary";
  protectedPrivateKey?: never;
}

interface ProtectedStoredVaultKeyPair {
  id: "primary";
  publicKey: CryptoKey;
  protectedPrivateKey: ProtectedPrivateKey;
  webAuthn: StoredLegacyPrfCredential;
  privateKey?: never;
}

interface LocalStoredVaultKeyPair extends VaultKeyPair {
  id: "primary";
  webAuthn: StoredWebAuthnCredential;
  protectedPrivateKey?: never;
}

type StoredVaultKeys =
  | LegacyStoredVaultKeyPair
  | ProtectedStoredVaultKeyPair
  | LocalStoredVaultKeyPair;

export class PasswordVaultDatabase extends Dexie {
  passwords!: EntityTable<StoredPasswordRecord, "id">;
  cryptoKeys!: EntityTable<StoredVaultKeys, "id">;

  constructor(name = "password-vault") {
    super(name);
    this.version(1).stores({ passwords: "++id, name" });
    this.version(2).stores({ passwords: "++id, name", cryptoKeys: "id" });
  }
}

const keyPairPromises = new WeakMap<
  PasswordVaultDatabase,
  Promise<StoredVaultKeys>
>();

async function loadOrCreateKeys(
  database: PasswordVaultDatabase,
): Promise<StoredVaultKeys> {
  const stored = await database.cryptoKeys.get("primary");
  if (stored) return stored;
  const generated = await generateVaultKeyPair();
  const legacyKeys: LegacyStoredVaultKeyPair = { id: "primary", ...generated };
  try {
    await database.cryptoKeys.add(legacyKeys);
    return legacyKeys;
  } catch (cause) {
    const concurrentlyCreated = await database.cryptoKeys.get("primary");
    if (concurrentlyCreated) return concurrentlyCreated;
    throw cause;
  }
}

function getStoredKeys(
  database: PasswordVaultDatabase,
): Promise<StoredVaultKeys> {
  const pending = keyPairPromises.get(database);
  if (pending) return pending;
  const created = loadOrCreateKeys(database).catch((cause) => {
    keyPairPromises.delete(database);
    throw cause;
  });
  keyPairPromises.set(database, created);
  return created;
}

function isProtected(
  keys: StoredVaultKeys,
): keys is ProtectedStoredVaultKeyPair {
  return "protectedPrivateKey" in keys;
}

function isWebAuthnRegistered(
  keys: StoredVaultKeys,
): keys is LocalStoredVaultKeyPair {
  return "webAuthn" in keys && "privateKey" in keys;
}

export function createVaultKeyProvider(
  database: PasswordVaultDatabase,
): VaultKeyProvider {
  return {
    async getPublicKey() {
      return (await getStoredKeys(database)).publicKey;
    },

    async unlockPrivateKey() {
      const keys = await getStoredKeys(database);
      if (isProtected(keys)) {
        const prfOutput = await authenticateLegacyPrf(keys.webAuthn);
        const privateKey = await unprotectPrivateKey(
          keys.protectedPrivateKey,
          prfOutput,
        );
        const migratedKeys: LocalStoredVaultKeyPair = {
          id: "primary",
          publicKey: keys.publicKey,
          privateKey,
          webAuthn: { credentialId: keys.webAuthn.credentialId },
        };
        await database.cryptoKeys.put(migratedKeys);
        keyPairPromises.set(database, Promise.resolve(migratedKeys));
        return privateKey;
      }

      if (isWebAuthnRegistered(keys)) {
        await authenticateWebAuthn(keys.webAuthn);
        return keys.privateKey;
      }

      const webAuthn = await registerWebAuthnCredential();
      const privateKey = await makePrivateKeyNonExtractable(keys.privateKey);
      const registeredKeys: LocalStoredVaultKeyPair = {
        id: "primary",
        publicKey: keys.publicKey,
        privateKey,
        webAuthn,
      };
      await database.cryptoKeys.put(registeredKeys);
      keyPairPromises.set(database, Promise.resolve(registeredKeys));
      return privateKey;
    },
  };
}

export function createPasswordRepository(database: PasswordVaultDatabase) {
  const keyProvider = createVaultKeyProvider(database);

  async function encryptRecord(
    entry: PasswordEntryInput,
  ): Promise<Omit<EncryptedPasswordRecord, "id">> {
    const encrypted = await encryptCredentials(
      { username: entry.username, password: entry.password },
      await keyProvider.getPublicKey(),
    );
    return { name: entry.name, ...encrypted };
  }

  async function decryptRecord(
    record: EncryptedPasswordRecord,
    privateKey: CryptoKey,
  ): Promise<PasswordEntry> {
    const credentials = await decryptCredentials(record, privateKey);
    return { id: record.id, name: record.name, ...credentials };
  }

  async function migratePlaintextEntries(): Promise<number> {
    const records = await database.passwords.toArray();
    let migrated = 0;
    for (const record of records) {
      if (!isPlaintextPasswordRecord(record)) continue;
      const encrypted = await encryptRecord(record);
      await database.passwords.put({ id: record.id, ...encrypted });
      migrated += 1;
    }
    return migrated;
  }

  return {
    async listSummaries(): Promise<PasswordSummary[]> {
      await migratePlaintextEntries();
      const records = await database.passwords.orderBy("name").toArray();
      return records.map(({ id, name }) => ({ id, name }));
    },

    async get(
      id: number,
      privateKey: CryptoKey,
    ): Promise<PasswordEntry | undefined> {
      await migratePlaintextEntries();
      const record = await database.passwords.get(id);
      return record
        ? decryptRecord(record as EncryptedPasswordRecord, privateKey)
        : undefined;
    },

    async create(entry: PasswordEntryInput): Promise<number> {
      const id = await database.passwords.add(await encryptRecord(entry));
      if (id === undefined)
        throw new Error("No se pudo generar el identificador.");
      return id;
    },

    async update(id: number, entry: PasswordEntryInput): Promise<void> {
      const updated = await database.passwords.update(
        id,
        await encryptRecord(entry),
      );
      if (updated === 0) throw new Error("La contraseña no existe.");
    },

    async remove(id: number): Promise<void> {
      await database.passwords.delete(id);
    },

    migratePlaintextEntries,
    keyProvider,
  };
}

export const database = new PasswordVaultDatabase();
export const passwordRepository = createPasswordRepository(database);
