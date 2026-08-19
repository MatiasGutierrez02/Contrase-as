export interface PasswordEntry {
  id?: number;
  name: string;
  username: string;
  password: string;
}

export type PasswordEntryInput = Omit<PasswordEntry, "id">;

export type PasswordSummary = Pick<PasswordEntry, "id" | "name">;

export interface PlaintextPasswordRecord extends PasswordEntry {
  id: number;
}

export interface EncryptedPasswordRecord {
  id?: number;
  name: string;
  cryptoVersion: 1;
  encryptedData: ArrayBuffer;
  iv: Uint8Array<ArrayBuffer>;
  wrappedKey: ArrayBuffer;
}

export type StoredPasswordRecord =
  PlaintextPasswordRecord | EncryptedPasswordRecord;

export function isPlaintextPasswordRecord(
  record: StoredPasswordRecord,
): record is PlaintextPasswordRecord {
  return "username" in record && "password" in record;
}
