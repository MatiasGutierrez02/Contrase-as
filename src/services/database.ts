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
  authenticateWithPrf,
  registerPrfCredential,
  type StoredPrfCredential,
} from "@/services/biometric";
import {
  decryptCredentials,
  encryptCredentials,
  generateVaultKeyPair,
  protectPrivateKey,
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
  webAuthn: StoredPrfCredential;
  privateKey?: never;
}

type StoredVaultKeys = LegacyStoredVaultKeyPair | ProtectedStoredVaultKeyPair;

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
        const prfOutput = await authenticateWithPrf(keys.webAuthn);
        return unprotectPrivateKey(keys.protectedPrivateKey, prfOutput);
      }

      const registration = await registerPrfCredential();
      const protectedPrivateKey = await protectPrivateKey(
        keys.privateKey,
        registration.prfOutput,
      );
      const protectedKeys: ProtectedStoredVaultKeyPair = {
        id: "primary",
        publicKey: keys.publicKey,
        protectedPrivateKey,
        webAuthn: {
          credentialId: registration.credentialId,
          prfSalt: registration.prfSalt,
        },
      };
      await database.cryptoKeys.put(protectedKeys);
      keyPairPromises.set(database, Promise.resolve(protectedKeys));
      return unprotectPrivateKey(protectedPrivateKey, registration.prfOutput);
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
