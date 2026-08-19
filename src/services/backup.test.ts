import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import {
  BackupError,
  createEncryptedBackup,
  readEncryptedBackup,
} from "./backup";
import { createPasswordRepository, PasswordVaultDatabase } from "./database";

describe("backup cifrado", () => {
  const databaseNames: string[] = [];

  afterEach(async () => {
    await Promise.all(databaseNames.map((name) => Dexie.delete(name)));
    databaseNames.length = 0;
  });

  it("exporta, restaura con otra clave local, conserva datos y evita duplicados exactos", async () => {
    const source = await createTestVault("source");
    await source.repository.create({
      name: "Google",
      username: "user@example.com",
      password: "google-password",
    });
    await source.repository.create({
      name: "Netflix",
      username: "user@example.com",
      password: "netflix-password",
    });
    const sourceKey = await getPrivateKey(source.database);
    const sourceEntries = await source.repository.listAll(sourceKey);
    const serialized = await createEncryptedBackup(
      sourceEntries,
      "backup-password",
    );

    expect(serialized).not.toContain("google-password");
    expect(serialized).not.toContain("user@example.com");

    const destination = await createTestVault("destination");
    await destination.repository.create({
      name: "Google",
      username: "user@example.com",
      password: "google-password",
    });
    const destinationKey = await getPrivateKey(destination.database);
    const importedEntries = await readEncryptedBackup(
      serialized,
      "backup-password",
    );
    await expect(
      destination.repository.importUnique(importedEntries, destinationKey),
    ).resolves.toBe(1);

    const restored = await destination.repository.listAll(destinationKey);
    expect(restored).toHaveLength(2);
    expect(restored.map(({ name }) => name).sort()).toEqual([
      "Google",
      "Netflix",
    ]);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const serialized = await createEncryptedBackup(
      [{ name: "Google", username: "user", password: "password" }],
      "correct-password",
    );
    await expect(
      readEncryptedBackup(serialized, "wrong-password"),
    ).rejects.toThrow("La contraseña es incorrecta o el archivo está dañado.");
  });

  it("rechaza un archivo inválido antes de modificar la bóveda", async () => {
    const destination = await createTestVault("invalid");
    await destination.repository.create({
      name: "Existing",
      username: "user",
      password: "password",
    });
    const destinationKey = await getPrivateKey(destination.database);

    await expect(
      readEncryptedBackup("not-json", "backup-password"),
    ).rejects.toBeInstanceOf(BackupError);
    const existing = await destination.repository.listAll(destinationKey);
    expect(existing).toHaveLength(1);
    expect(existing[0]?.name).toBe("Existing");
  });

  async function createTestVault(label: string) {
    const name = `password-vault-backup-${label}-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const database = new PasswordVaultDatabase(name);
    return { database, repository: createPasswordRepository(database) };
  }

  async function getPrivateKey(
    database: PasswordVaultDatabase,
  ): Promise<CryptoKey> {
    const keys = await database.cryptoKeys.get("primary");
    if (!keys?.privateKey)
      throw new Error("No se generó la clave privada local.");
    return keys.privateKey;
  }
});
