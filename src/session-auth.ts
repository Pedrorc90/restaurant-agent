import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
  return secret;
}

export function signSession(sessionId: string): string {
  return createHmac("sha256", getSecret()).update(sessionId).digest("hex");
}

export function verifySession(sessionId: string, token: string): boolean {
  const expected = signSession(sessionId);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
}
