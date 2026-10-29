// Server-only helpers: AES-256-GCM for OAuth tokens at rest and HMAC-signed OAuth state.
// TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64 (openssl rand -base64 32).
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
  const raw = process.env["TOKEN_ENCRYPTION_KEY"];
  if (!raw) throw new Error("Falta TOKEN_ENCRYPTION_KEY en el servidor");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY debe ser de 32 bytes en base64");
  return k;
}

/** Encrypts to "iv.tag.ciphertext" (base64url parts). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Token cifrado con formato no válido");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

const mac = (body: string) => createHmac("sha256", key()).update("oauth-state:" + body).digest("base64url");

/** Signed, expiring state for the OAuth round-trip (binds the callback to the user who started it). */
export function signState(userId: string, ttlMs = 10 * 60 * 1000, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, e: now + ttlMs, n: randomBytes(8).toString("hex") })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifyState(state: string, now = Date.now()): string | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u: string; e: number };
    return typeof u === "string" && e > now ? u : null;
  } catch {
    return null;
  }
}
