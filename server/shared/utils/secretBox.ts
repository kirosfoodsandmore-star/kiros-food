// Secrets at rest (Paystack secret keys): AES-256-GCM with a key derived from APP_ENCRYPTION_KEY and an
// AAD context (the organisation id) so a sealed value copied to another row does not open.
import crypto from "crypto";
import { env } from "../../config/env";
import { AppError } from "../errors/AppError";

const VERSION = "v1";

function key(): Buffer {
  if (env.encryptionKey.length < 32) {
    throw AppError.unavailable("APP_ENCRYPTION_KEY (at least 32 characters) must be set on the server before secrets can be saved");
  }
  return crypto.createHash("sha256").update(env.encryptionKey).digest();
}

export const secretBoxReady = (): boolean => env.encryptionKey.length >= 32;

export function seal(plain: string, context: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function open(sealed: string, context: string): string {
  const [version, ivB64, tagB64, bodyB64] = sealed.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !bodyB64) throw AppError.unavailable("Stored secret is unreadable");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(bodyB64, "base64url")), decipher.final()]).toString("utf8");
}

export function last4(value: string): string {
  return value.slice(-4);
}
