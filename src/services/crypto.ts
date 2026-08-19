const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const CRYPTO_VERSION = 1 as const;

export interface Credentials {
  username: string;
  password: string;
}

export interface EncryptedCredentials {
  cryptoVersion: typeof CRYPTO_VERSION;
  encryptedData: ArrayBuffer;
  iv: Uint8Array<ArrayBuffer>;
  wrappedKey: ArrayBuffer;
}

export interface VaultKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface VaultKeyProvider {
  getPublicKey(): Promise<CryptoKey>;
  unlockPrivateKey(): Promise<CryptoKey>;
}

export interface ProtectedPrivateKey {
  protectionVersion: 1;
  encryptedPrivateKey: ArrayBuffer;
  iv: Uint8Array<ArrayBuffer>;
  derivationSalt: Uint8Array<ArrayBuffer>;
}

export async function generateVaultKeyPair(): Promise<VaultKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["wrapKey", "unwrapKey"],
  );
}

export async function encryptCredentials(
  credentials: Credentials,
  publicKey: CryptoKey,
): Promise<EncryptedCredentials> {
  const dataKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(credentials));
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    dataKey,
    plaintext,
  );
  const wrappedKey = await crypto.subtle.wrapKey("raw", dataKey, publicKey, {
    name: "RSA-OAEP",
  });

  return { cryptoVersion: CRYPTO_VERSION, encryptedData, iv, wrappedKey };
}

export async function decryptCredentials(
  encrypted: EncryptedCredentials,
  privateKey: CryptoKey,
): Promise<Credentials> {
  if (encrypted.cryptoVersion !== CRYPTO_VERSION)
    throw new Error("Versión de cifrado no compatible.");

  const dataKey = await crypto.subtle.unwrapKey(
    "raw",
    encrypted.wrappedKey,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encrypted.iv, tagLength: 128 },
    dataKey,
    encrypted.encryptedData,
  );
  const credentials: unknown = JSON.parse(decoder.decode(plaintext));
  if (!isCredentials(credentials))
    throw new Error("Los datos descifrados no tienen un formato válido.");
  return credentials;
}

export async function protectPrivateKey(
  privateKey: CryptoKey,
  prfOutput: BufferSource,
): Promise<ProtectedPrivateKey> {
  const derivationSalt = crypto.getRandomValues(new Uint8Array(32));
  const protectionKey = await deriveProtectionKey(prfOutput, derivationSalt, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const exportedPrivateKey = await crypto.subtle.exportKey("pkcs8", privateKey);
  const encryptedPrivateKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    protectionKey,
    exportedPrivateKey,
  );
  return { protectionVersion: 1, encryptedPrivateKey, iv, derivationSalt };
}

export async function unprotectPrivateKey(
  protectedKey: ProtectedPrivateKey,
  prfOutput: BufferSource,
): Promise<CryptoKey> {
  if (protectedKey.protectionVersion !== 1)
    throw new Error("Versión de protección de clave no compatible.");
  const protectionKey = await deriveProtectionKey(
    prfOutput,
    protectedKey.derivationSalt,
    ["decrypt"],
  );
  const exportedPrivateKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: protectedKey.iv, tagLength: 128 },
    protectionKey,
    protectedKey.encryptedPrivateKey,
  );
  return crypto.subtle.importKey(
    "pkcs8",
    exportedPrivateKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["unwrapKey"],
  );
}

async function deriveProtectionKey(
  prfOutput: BufferSource,
  derivationSalt: BufferSource,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const sourceKey = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: derivationSalt,
      info: encoder.encode("password-vault/private-key/v1"),
    },
    sourceKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function isCredentials(value: unknown): value is Credentials {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in value &&
    typeof value.username === "string" &&
    "password" in value &&
    typeof value.password === "string"
  );
}
