import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createPasswordRepository, PasswordVaultDatabase } from "./database";

describe("migración de contraseñas en texto plano", () => {
  const databaseNames: string[] = [];

  afterEach(async () => {
    await Promise.all(databaseNames.map((name) => Dexie.delete(name)));
    databaseNames.length = 0;
  });

  it("preserva los datos y elimina usuario y contraseña del registro almacenado", async () => {
    const name = `password-vault-migration-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(1).stores({ passwords: "++id, name" });
    const legacyPasswords = legacyDatabase.table("passwords");
    const id = await legacyPasswords.add({
      name: "Google",
      username: "user@example.com",
      password: "legacy-password",
    });
    legacyDatabase.close();

    const database = new PasswordVaultDatabase(name);
    const repository = createPasswordRepository(database);
    await repository.listSummaries();
    const storedKeys = await database.cryptoKeys.get("primary");
    if (!storedKeys?.privateKey)
      throw new Error("No se generó la clave de migración.");
    await expect(
      repository.get(Number(id), storedKeys.privateKey),
    ).resolves.toEqual({
      id,
      name: "Google",
      username: "user@example.com",
      password: "legacy-password",
    });

    const stored = await database.passwords.get(Number(id));
    expect(stored).not.toHaveProperty("username");
    expect(stored).not.toHaveProperty("password");
    expect(stored).toMatchObject({ id, name: "Google", cryptoVersion: 1 });
    if (!stored || !("encryptedData" in stored))
      throw new Error("La entrada no fue migrada.");
    expect(stored.encryptedData.byteLength).toBeGreaterThan(0);
    expect(stored.wrappedKey.byteLength).toBeGreaterThan(0);
    database.close();
  });
});
