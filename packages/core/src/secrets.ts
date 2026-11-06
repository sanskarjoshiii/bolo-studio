import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { setting } from "./env";
import { secret } from "./users";

// Client API keys and OAuth tokens are stored encrypted (AES-256-GCM). On AWS set
// BOLO_ENCRYPTION_KEY (32 random bytes, hex or base64 — e.g. from Secrets Manager); locally the key
// is derived from the session secret so nothing extra is needed.

const PREFIX = "enc:v1:";

function key(): Buffer {
  const configured = setting("BOLO_ENCRYPTION_KEY");
  if (configured) {
    const raw = /^[0-9a-f]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
    if (raw.length === 32) return raw;
    throw new Error("BOLO_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).");
  }
  return createHash("sha256").update(`${secret()}:bolo-secrets`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${PREFIX}${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

export function decrypt(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const [iv, tag, body] = stored.slice(PREFIX.length).split(".");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/** "sk-ant-…abcd" — enough to recognise a key without showing it. */
export const maskKey = (k: string) => (k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-4)}` : "••••");
