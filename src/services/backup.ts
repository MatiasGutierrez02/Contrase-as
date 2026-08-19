import type { PasswordEntryInput } from "@/models/PasswordEntry";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const BACKUP_FORMAT = "password-vault-backup";
const BACKUP_VERSION = 1 as const;
const PBKDF2_ITERATIONS = 600_000;

interface BackupPayload {
  version: typeof BACKUP_VERSION;
  createdAt: string;
  entries: PasswordEntryInput[];
}

interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  encryption: {
    name: "AES-GCM";
    iv: string;
  };
  ciphertext: string;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export async function createEncryptedBackup(
  entries: PasswordEntryInput[],
  password: string,
): Promise<string> {
  assertPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, PBKDF2_ITERATIONS, [
    "encrypt",
  ]);
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    entries: entries.map(({ name, username, password }) => ({
      name,
      username,
      password,
    })),
  };
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  const backup: EncryptedBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt),
    },
    encryption: { name: "AES-GCM", iv: toBase64(iv) },
    ciphertext: toBase64(ciphertext),
  };
  return JSON.stringify(backup, null, 2);
}

export async function readEncryptedBackup(
  serialized: string,
  password: string,
): Promise<PasswordEntryInput[]> {
  assertPassword(password);
  const backup = parseBackup(serialized);
  try {
    const salt = fromBase64(backup.kdf.salt);
    const iv = fromBase64(backup.encryption.iv);
    if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new Error();
    const key = await deriveBackupKey(password, salt, backup.kdf.iterations, [
      "decrypt",
    ]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      fromBase64(backup.ciphertext),
    );
    const payload: unknown = JSON.parse(decoder.decode(plaintext));
    if (!isBackupPayload(payload))
      throw new BackupError(
        "El contenido del backup no tiene un formato válido.",
      );
    return payload.entries;
  } catch (cause) {
    if (cause instanceof BackupError) throw cause;
    throw new BackupError(
      "La contraseña es incorrecta o el archivo está dañado.",
    );
  }
}

function parseBackup(serialized: string): EncryptedBackup {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isEncryptedBackup(value)) throw new Error();
    return value;
  } catch {
    throw new BackupError("El archivo seleccionado no es un backup válido.");
  }
}

async function deriveBackupKey(
  password: string,
  salt: BufferSource,
  iterations: number,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function assertPassword(password: string): void {
  if (password.length < 8) {
    throw new BackupError(
      "La contraseña del backup debe tener al menos 8 caracteres.",
    );
  }
}

function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EncryptedBackup>;
  return (
    candidate.format === BACKUP_FORMAT &&
    candidate.version === BACKUP_VERSION &&
    candidate.kdf?.name === "PBKDF2" &&
    candidate.kdf.hash === "SHA-256" &&
    candidate.kdf.iterations === PBKDF2_ITERATIONS &&
    typeof candidate.kdf.salt === "string" &&
    candidate.encryption?.name === "AES-GCM" &&
    typeof candidate.encryption.iv === "string" &&
    typeof candidate.ciphertext === "string"
  );
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BackupPayload>;
  return (
    candidate.version === BACKUP_VERSION &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.name === "string" &&
        entry.name.length > 0 &&
        typeof entry.username === "string" &&
        typeof entry.password === "string",
    )
  );
}

function toBase64(source: BufferSource): string {
  const bytes =
    source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
