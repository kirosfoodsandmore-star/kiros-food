// The only place that talks to Paystack. The secret key is passed in per call (it belongs to the
// restaurant, decrypted by PaymentSettingsService), never read from env.
import crypto from "crypto";
import { AppError } from "../../shared/errors/AppError";

const BASE = "https://api.paystack.co";

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyResult {
  status: "success" | "failed" | "abandoned" | "pending" | string;
  reference: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  channel: string | null;
  customerEmail: string | null;
}

async function call<T>(secretKey: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error("[paystack] network error", err instanceof Error ? err.message : err);
    throw AppError.unavailable("Could not reach Paystack, please try again");
  }
  const json = (await response.json().catch(() => null)) as PaystackEnvelope<T> | null;
  if (!response.ok || !json || !json.status) {
    const message = json?.message ?? `Paystack answered ${response.status}`;
    if (response.status === 401) throw new AppError("Paystack rejected the secret key", 502);
    throw new AppError(`Paystack: ${message}`, 502);
  }
  return json.data;
}

export const paystackClient = {
  async initialize(
    secretKey: string,
    input: { email: string; amount: number; reference: string; callbackUrl: string; currency?: string; metadata?: Record<string, unknown> }
  ): Promise<InitializeResult> {
    const data = await call<{ authorization_url: string; access_code: string; reference: string }>(secretKey, "POST", "/transaction/initialize", {
      email: input.email,
      amount: input.amount,
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: input.currency ?? "NGN",
      metadata: input.metadata,
    });
    return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
  },

  async verify(secretKey: string, reference: string): Promise<VerifyResult> {
    const data = await call<{
      status: string;
      reference: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      channel: string | null;
      customer?: { email?: string };
    }>(secretKey, "GET", `/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      status: data.status,
      reference: data.reference,
      amount: data.amount,
      currency: data.currency,
      paidAt: data.paid_at,
      channel: data.channel,
      customerEmail: data.customer?.email ?? null,
    };
  },

  /** Full or partial refund. Amount in kobo; omit for a full refund. */
  async refund(secretKey: string, reference: string, amount?: number, note?: string): Promise<{ id: number | string; status: string }> {
    const data = await call<{ id: number | string; status: string }>(secretKey, "POST", "/refund", {
      transaction: reference,
      ...(amount ? { amount } : {}),
      ...(note ? { merchant_note: note } : {}),
    });
    return data;
  },

  /** "Test connection" in payment settings: any authenticated call proves the key works. */
  async testConnection(secretKey: string): Promise<{ ok: true; integration: string | null }> {
    const data: { business_name?: string } = await call<{ business_name?: string }>(secretKey, "GET", "/integration").catch(async (err: unknown) => {
      // Some keys cannot read /integration; fall back to a harmless list call.
      if (err instanceof AppError && err.statusCode === 502 && !err.message.includes("secret key")) {
        await call(secretKey, "GET", "/transaction?perPage=1");
        return {};
      }
      throw err;
    });
    return { ok: true, integration: data.business_name ?? null };
  },

  /** Webhook signature: HMAC-SHA512 of the raw body with the secret key, hex, in `x-paystack-signature`. */
  verifySignature(secretKey: string, rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
};
