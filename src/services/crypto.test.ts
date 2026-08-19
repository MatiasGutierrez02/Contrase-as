import { describe, expect, it } from "vitest";
import {
  decryptCredentials,
  encryptCredentials,
  generateVaultKeyPair,
  protectPrivateKey,
  unprotectPrivateKey,
} from "./crypto";

describe("cifrado híbrido de credenciales", () => {
  it("cifra y descifra usuario y contraseña", async () => {
    const keyPair = await generateVaultKeyPair();
    const credentials = {
      username: "user@example.com",
      password: "sensitive-password",
    };

    const encrypted = await encryptCredentials(credentials, keyPair.publicKey);

    expect(new TextDecoder().decode(encrypted.encryptedData)).not.toContain(
      credentials.username,
    );
    expect(new TextDecoder().decode(encrypted.encryptedData)).not.toContain(
      credentials.password,
    );
    await expect(
      decryptCredentials(encrypted, keyPair.privateKey),
    ).resolves.toEqual(credentials);
  });

  it("rechaza datos cifrados alterados", async () => {
    const keyPair = await generateVaultKeyPair();
    const encrypted = await encryptCredentials(
      { username: "user", password: "password" },
      keyPair.publicKey,
    );
    const alteredData = encrypted.encryptedData.slice(0);
    new Uint8Array(alteredData)[0] ^= 1;

    await expect(
      decryptCredentials(
        { ...encrypted, encryptedData: alteredData },
        keyPair.privateKey,
      ),
    ).rejects.toThrow();
  });

  it("protege la clave RSA y sólo la recupera con el mismo material PRF", async () => {
    const keyPair = await generateVaultKeyPair();
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));
    const protectedKey = await protectPrivateKey(keyPair.privateKey, prfOutput);
    const unlockedKey = await unprotectPrivateKey(protectedKey, prfOutput);
    const encrypted = await encryptCredentials(
      { username: "user", password: "password" },
      keyPair.publicKey,
    );

    await expect(decryptCredentials(encrypted, unlockedKey)).resolves.toEqual({
      username: "user",
      password: "password",
    });
    await expect(
      unprotectPrivateKey(
        protectedKey,
        crypto.getRandomValues(new Uint8Array(32)),
      ),
    ).rejects.toThrow();
    expect(unlockedKey.extractable).toBe(false);
  });
});
