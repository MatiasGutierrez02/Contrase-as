export interface StoredWebAuthnCredential {
  credentialId: ArrayBuffer;
}

export interface StoredLegacyPrfCredential extends StoredWebAuthnCredential {
  prfSalt: Uint8Array<ArrayBuffer>;
}

export class WebAuthnSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebAuthnSecurityError";
  }
}

export async function registerWebAuthnCredential(): Promise<StoredWebAuthnCredential> {
  await assertWebAuthnAvailable();
  const credential = await performWebAuthn(
    "No se pudo registrar la autenticación del dispositivo.",
    () =>
      navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Mi bóveda" },
          user: {
            id: crypto.getRandomValues(new Uint8Array(32)),
            name: "boveda-local",
            displayName: "Bóveda local",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "required",
            userVerification: "required",
          },
          attestation: "none",
          timeout: 60_000,
        },
      }),
  );
  if (!(credential instanceof PublicKeyCredential)) {
    throw new WebAuthnSecurityError(
      "El navegador no devolvió una credencial WebAuthn válida.",
    );
  }
  return { credentialId: credential.rawId.slice(0) };
}

export async function authenticateWebAuthn(
  credential: StoredWebAuthnCredential,
): Promise<void> {
  const assertion = await requestAssertion(credential);
  if (!(assertion instanceof PublicKeyCredential)) {
    throw new WebAuthnSecurityError(
      "El navegador no devolvió una autenticación WebAuthn válida.",
    );
  }
}

export async function authenticateLegacyPrf(
  credential: StoredLegacyPrfCredential,
): Promise<ArrayBuffer> {
  const assertion = await requestAssertion(credential, {
    prf: { eval: { first: credential.prfSalt } },
  });
  if (!(assertion instanceof PublicKeyCredential)) {
    throw new WebAuthnSecurityError(
      "El navegador no devolvió una autenticación WebAuthn válida.",
    );
  }
  const result = assertion.getClientExtensionResults().prf?.results?.first;
  if (!result || result.byteLength !== 32) {
    throw new WebAuthnSecurityError(
      "Esta bóveda todavía requiere PRF para migrar su clave, pero el dispositivo no entregó el resultado necesario.",
    );
  }
  return copyBuffer(result);
}

async function requestAssertion(
  credential: StoredWebAuthnCredential,
  extensions?: AuthenticationExtensionsClientInputs,
): Promise<Credential | null> {
  await assertWebAuthnAvailable();
  return performWebAuthn("No se pudo autenticar el acceso a la bóveda.", () =>
    navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: credential.credentialId, type: "public-key" }],
        userVerification: "required",
        timeout: 60_000,
        extensions,
      },
    }),
  );
}

function copyBuffer(source: BufferSource): ArrayBuffer {
  const bytes =
    source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return Uint8Array.from(bytes).buffer;
}

async function assertWebAuthnAvailable(): Promise<void> {
  if (
    typeof window === "undefined" ||
    !("PublicKeyCredential" in window) ||
    !navigator.credentials
  ) {
    throw new WebAuthnSecurityError(
      "WebAuthn no está disponible en este navegador.",
    );
  }
  if (
    !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  ) {
    throw new WebAuthnSecurityError(
      "No hay un autenticador de dispositivo con verificación de usuario disponible.",
    );
  }
}

async function performWebAuthn<T>(
  fallback: string,
  operation: () => Promise<T | null>,
): Promise<T> {
  try {
    const result = await operation();
    if (!result) throw new WebAuthnSecurityError(fallback);
    return result;
  } catch (cause) {
    if (cause instanceof WebAuthnSecurityError) throw cause;
    if (cause instanceof DOMException && cause.name === "NotAllowedError") {
      throw new WebAuthnSecurityError(
        "La autenticación fue cancelada o no pudo completarse.",
      );
    }
    if (cause instanceof DOMException && cause.name === "NotSupportedError") {
      throw new WebAuthnSecurityError(
        "El navegador o autenticador no soporta el flujo WebAuthn requerido.",
      );
    }
    throw new WebAuthnSecurityError(fallback);
  }
}
