import { SignJWT, jwtVerify } from "jose";
import type { JwtUserPayload } from "../types/env";

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signUserToken(
  payload: Omit<JwtUserPayload, "exp" | "iat">,
  secret: string,
  expirationTime = "7d"
): Promise<string> {
  const secretKey = getSecretKey(secret);
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secretKey);
}

export async function verifyUserToken(
  token: string,
  secret: string
): Promise<{ valid: true; payload: JwtUserPayload } | { valid: false; error: string }> {
  try {
    const secretKey = getSecretKey(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"]
    });
    return {
      valid: true,
      payload: payload as unknown as JwtUserPayload
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token inválido ou expirado";
    return {
      valid: false,
      error: message
    };
  }
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1].trim();
  }
  return null;
}
