import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createPasswordRepository, PasswordVaultDatabase } from "./database";

describe("repositorio cifrado de contraseñas", () => {
  const databases: PasswordVaultDatabase[] = [];

  afterEach(async () => {
    const names = [...new Set(databases.map((database) => database.name))];
    databases.forEach((database) => database.close());
    await Promise.all(names.map((name) => Dexie.delete(name)));
    databases.length = 0;
  });

  it("crea, lista, lee, edita y elimina sin persistir credenciales en claro", async () => {
    const database = createDatabase();
    const repository = createPasswordRepository(database);
    const id = await repository.create({
      name: "Google",
      username: "user@example.com",
      password: "secret-password",
    });

    const stored = await database.passwords.get(id);
    expect(stored).not.toHaveProperty("username");
    expect(stored).not.toHaveProperty("password");
    await expect(repository.listSummaries()).resolves.toEqual([
      { id, name: "Google" },
    ]);

    const privateKey = await getPrivateKey(database);
    expect(privateKey.extractable).toBe(false);
    await expect(repository.get(id, privateKey)).resolves.toEqual({
      id,
      name: "Google",
      username: "user@example.com",
      password: "secret-password",
    });

    await repository.update(id, {
      name: "Google Work",
      username: "work@example.com",
      password: "updated-password",
    });
    await expect(repository.get(id, privateKey)).resolves.toMatchObject({
      name: "Google Work",
      username: "work@example.com",
      password: "updated-password",
    });

    await repository.remove(id);
    await expect(repository.get(id, privateKey)).resolves.toBeUndefined();
  });

  it("deduplica importaciones concurrentes de forma atómica", async () => {
    const name = `password-vault-concurrent-${crypto.randomUUID()}`;
    const firstDatabase = createDatabase(name);
    const firstRepository = createPasswordRepository(firstDatabase);
    await firstRepository.create({
      name: "Existing",
      username: "user",
      password: "password",
    });
    const privateKey = await getPrivateKey(firstDatabase);
    const secondDatabase = createDatabase(name);
    const secondRepository = createPasswordRepository(secondDatabase);
    const imported = [
      { name: "Netflix", username: "user", password: "secret" },
    ];

    const counts = await Promise.all([
      firstRepository.importUnique(imported, privateKey),
      secondRepository.importUnique(imported, privateKey),
    ]);

    expect(counts.reduce((total, count) => total + count, 0)).toBe(1);
    const restored = await firstRepository.listAll(privateKey);
    expect(restored.map(({ name }) => name).sort()).toEqual([
      "Existing",
      "Netflix",
    ]);
  });

  function createDatabase(name = `password-vault-${crypto.randomUUID()}`) {
    const database = new PasswordVaultDatabase(name);
    databases.push(database);
    return database;
  }

  async function getPrivateKey(database: PasswordVaultDatabase) {
    const keys = await database.cryptoKeys.get("primary");
    if (!keys?.privateKey) throw new Error("No se generó la clave privada.");
    return keys.privateKey;
  }
});
