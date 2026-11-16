import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../errors/AppError";

const ISSUER = "kiros";

export interface AccessTokenPayload {
  sub: string;
  org: string;
  typ: "access";
}

export interface CustomerTokenPayload {
  sub: string;
  org: string;
  typ: "customer";
}

function verify<T extends { typ: string }>(token: string, expectedType: T["typ"]): T {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret, { issuer: ISSUER });
    if (typeof decoded !== "object" || decoded === null) throw new Error("bad token");
    const { sub, org, typ } = decoded as { sub?: unknown; org?: unknown; typ?: unknown };
    if (typ !== expectedType || typeof sub !== "string" || typeof org !== "string") throw new Error("bad token");
    return { sub, org, typ } as unknown as T;
  } catch {
    throw AppError.unauthorised("Session expired or invalid — please sign in again");
  }
}

export function signAccessToken(userId: string, organizationId: string): string {
  const payload: AccessTokenPayload = { sub: userId, org: organizationId, typ: "access" };
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtlSeconds, issuer: ISSUER });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return verify<AccessTokenPayload>(token, "access");
}

/** Customers get longer-lived access tokens: the storefront must not log them out mid-order. */
export function signCustomerToken(customerId: string, organizationId: string): string {
  const payload: CustomerTokenPayload = { sub: customerId, org: organizationId, typ: "customer" };
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: Math.max(env.jwt.accessTtlSeconds, 3600), issuer: ISSUER });
}

export function verifyCustomerToken(token: string): CustomerTokenPayload {
  return verify<CustomerTokenPayload>(token, "customer");
}

/** Opaque refresh token (random) — only its keyed hash is stored. */
export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac("sha256", env.jwt.refreshSecret).update(token).digest("hex");
}

/** Keyed hash for any opaque secret we must look up later (invite tokens, cart tokens, reset codes). */
export function hashToken(value: string): string {
  return hashRefreshToken(value);
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
