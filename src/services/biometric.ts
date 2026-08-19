export interface PrfCredentialRegistration {
  credentialId: ArrayBuffer;
  prfSalt: Uint8Array<ArrayBuffer>;
  prfOutput: ArrayBuffer;
}

export interface StoredPrfCredential {
  credentialId: ArrayBuffer;
  prfSalt: Uint8Array<ArrayBuffer>;
}

export class WebAuthnSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebAuthnSecurityError";
  }
}

export async function registerPrfCredential(): Promise<PrfCredentialRegistration> {
  await assertWebAuthnAvailable();
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
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
          extensions: { prf: { eval: { first: prfSalt } } },
        } as PublicKeyCredentialCreationOptions,
      }),
  );

  if (!(credential instanceof PublicKeyCredential))
    throw new WebAuthnSecurityError(
      "El navegador no devolvió una credencial WebAuthn válida.",
    );
  const extension = credential.getClientExtensionResults().prf;
  if (extension?.enabled !== true) {
    throw new WebAuthnSecurityError(
      "Este dispositivo no admite la extensión PRF requerida para proteger la bóveda.",
    );
  }

  const stored = { credentialId: credential.rawId.slice(0), prfSalt };
  const prfOutput = extension.results?.first
    ? copyBuffer(extension.results.first)
    : await authenticateWithPrf(stored);
  return { ...stored, prfOutput };
}

export async function authenticateWithPrf(
  credential: StoredPrfCredential,
): Promise<ArrayBuffer> {
  await assertWebAuthnAvailable();
  const assertion = await performWebAuthn(
    "No se pudo autenticar el acceso a la bóveda.",
    () =>
      navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [
            { id: credential.credentialId, type: "public-key" },
          ],
          userVerification: "required",
          timeout: 60_000,
          extensions: { prf: { eval: { first: credential.prfSalt } } },
        } as PublicKeyCredentialRequestOptions,
      }),
  );
  if (!(assertion instanceof PublicKeyCredential))
    throw new WebAuthnSecurityError(
      "El navegador no devolvió una autenticación WebAuthn válida.",
    );
  const result = assertion.getClientExtensionResults().prf?.results?.first;
  if (!result || result.byteLength !== 32) {
    throw new WebAuthnSecurityError(
      "La autenticación se completó, pero el dispositivo no entregó el resultado PRF requerido.",
    );
  }
  return copyBuffer(result);
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
  const platformAvailable =
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!platformAvailable) {
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
        "El navegador o autenticador no soporta WebAuthn con PRF.",
      );
    }
    throw new WebAuthnSecurityError(fallback);
  }
}
