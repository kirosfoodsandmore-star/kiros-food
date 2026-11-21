// The ONLY file that reads process.env. Everything else imports `env`.
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const read = (key: string, fallback = ""): string => {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
};

const readInt = (key: string, fallback: number): number => {
  const parsed = Number.parseInt(read(key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBool = (key: string, fallback: boolean): boolean => {
  const value = read(key).toLowerCase();
  if (value === "") return fallback;
  return value === "true" || value === "1" || value === "yes";
};

const readList = (key: string): string[] =>
  read(key)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/** "15m", "7d", "12h", "900s" or plain seconds → seconds. Undefined when unset or unreadable. */
function readDurationSeconds(key: string): number | undefined {
  const match = /^(\d+)\s*([smhd]?)$/i.exec(read(key).trim());
  if (!match) return undefined;
  const unit = { "": 1, s: 1, m: 60, h: 3600, d: 86_400 }[match[2].toLowerCase() as "" | "s" | "m" | "h" | "d"];
  return Number(match[1]) * unit;
}

const MAX_ACCESS_TTL = 7 * 86_400;
function accessTtlSeconds(): number {
  const ttl = readDurationSeconds("JWT_ACCESS_EXPIRES_IN") ?? 900;
  if (ttl > MAX_ACCESS_TTL) {
    console.warn(`[env] Access tokens of ${ttl}s are unsafe; capped at 7d.`);
    return MAX_ACCESS_TTL;
  }
  return Math.max(ttl, 60);
}

function refreshTtlDays(): number {
  const seconds = readDurationSeconds("JWT_REFRESH_EXPIRES_IN");
  return seconds !== undefined ? Math.max(1, Math.round(seconds / 86_400)) : 30;
}

const nodeEnv = read("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const DEV_ACCESS_SECRET = "dev-only-access-secret-change-me-0123456789";
const DEV_REFRESH_SECRET = "dev-only-refresh-secret-change-me-0123456789";

function secret(key: string, devFallback: string): string {
  const value = read(key);
  if (value.length >= 32) return value;
  if (isProduction) throw new Error(`${key} must be set to a random string of at least 32 characters in production`);
  return value || devFallback;
}

// Either CLOUDINARY_URL (cloudinary://key:secret@cloud_name) or the three separate values.
function parseCloudinaryUrl(url: string): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url.trim());
  return match ? { apiKey: match[1], apiSecret: match[2], cloudName: match[3] } : null;
}
const cloudFromUrl = parseCloudinaryUrl(read("CLOUDINARY_URL"));
const cloudName = read("CLOUDINARY_CLOUD_NAME", cloudFromUrl?.cloudName ?? "");
const cloudKey = read("CLOUDINARY_API_KEY", cloudFromUrl?.apiKey ?? "");
const cloudSecret = read("CLOUDINARY_API_SECRET", cloudFromUrl?.apiSecret ?? "");

function firebaseConfig() {
  let projectId = read("FIREBASE_PROJECT_ID");
  let clientEmail = read("FIREBASE_CLIENT_EMAIL");
  let privateKey = read("FIREBASE_PRIVATE_KEY")
    .trim()
    .replace(/^["']+|["',\s]+$/g, "")
    .replace(/\\n/g, "\n"); // .env stores the key on one line with literal "\n" sequences
  const serviceAccountJson = read("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as { project_id?: string; client_email?: string; private_key?: string };
      projectId = projectId || parsed.project_id || "";
      clientEmail = clientEmail || parsed.client_email || "";
      privateKey = privateKey || parsed.private_key || "";
    } catch {
      console.warn("[env] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — ignored");
    }
  }
  return {
    projectId,
    clientEmail,
    privateKey,
    webApiKey: read("FIREBASE_API_KEY"),
    configured: Boolean(projectId && clientEmail && privateKey),
  };
}

function emailConfig() {
  const provider = read("EMAIL_PROVIDER", "nodemailer").toLowerCase() === "script" ? "script" : "nodemailer";
  const user = read("EMAIL_USER");
  // Gmail shows app passwords with spaces ("abcd efgh …"); they work without them.
  const password = read("EMAIL_PASSWORD").replace(/\s+/g, "");
  const scriptUrl = read("EMAIL_SCRIPT_URL");
  const fromMatch = /<([^>]+)>/.exec(read("EMAIL_FROM"));
  const fromAddress = (fromMatch?.[1] ?? read("EMAIL_FROM", user)).trim() || user;
  return {
    enabled: readBool("EMAIL_ENABLED", true),
    provider: provider as "nodemailer" | "script",
    user,
    password,
    scriptUrl,
    fromAddress,
    configured: provider === "script" ? Boolean(scriptUrl) : Boolean(user && password),
  };
}

const corsList = readList("CORS_ORIGINS");
const corsOrigins = corsList.length > 0 ? corsList : ["http://localhost:5173"];
const storefrontUrl = read("STOREFRONT_URL", corsOrigins[0]).replace(/\/+$/, "");

/** True for an address that only works on the computer running the server (localhost, 127.0.0.1, ::1). */
export function isLocalAddress(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url.trim());
}

export const env = {
  nodeEnv,
  isProduction,
  port: readInt("PORT", 4000),
  appUrl: read("APP_URL", "http://localhost:4000").replace(/\/+$/, ""),
  corsOrigins,
  /** The one web app address (STOREFRONT_URL): customer emails, the Paystack return URL and the admin portal below. */
  storefrontUrl,
  /** Admin portal (links in staff emails: invites, new orders). It is the same site, under /admin. */
  adminUrl: `${storefrontUrl}/admin`,
  db: {
    url: read("DATABASE_URL"),
    host: read("DB_HOST", "localhost"),
    port: readInt("DB_PORT", 5432),
    user: read("DB_USER", "postgres"),
    password: read("DB_PASSWORD", "postgres"),
    name: read("DB_NAME", "kiros"),
    ssl: readBool("DB_SSL", false),
    logging: readBool("DB_LOGGING", false),
    // Managed Postgres plans allow few connections in total (Aiven free ≈ 20); keep each process small.
    poolMax: readInt("DB_POOL_MAX", 5),
    poolIdleMs: readInt("DB_POOL_IDLE_MS", 30_000),
  },
  jwt: {
    accessSecret: secret("JWT_ACCESS_SECRET", DEV_ACCESS_SECRET),
    refreshSecret: secret("JWT_REFRESH_SECRET", DEV_REFRESH_SECRET),
    accessTtlSeconds: accessTtlSeconds(),
    refreshTtlDays: refreshTtlDays(),
  },
  /** AES-256-GCM key for secrets at rest (Paystack secret keys). Empty = saving payment keys refused. */
  encryptionKey: read("APP_ENCRYPTION_KEY"),
  otpTtlMinutes: readInt("OTP_TTL_MINUTES", 15),
  inviteTtlHours: readInt("INVITE_TTL_HOURS", 48),
  cloudinary: {
    cloudName,
    apiKey: cloudKey,
    apiSecret: cloudSecret,
    configured: Boolean(cloudName && cloudKey && cloudSecret),
  },
  firebase: firebaseConfig(),
  email: emailConfig(),
  paystack: {
    callbackUrl: read("PAYSTACK_CALLBACK_URL", `${storefrontUrl}/checkout/return`).replace(/\/+$/, ""),
  },
  /**
   * Public "Create your restaurant" sign-up. Off by default: a deployment that serves one restaurant should not let
   * strangers add another. First-run setup still works because sign-up is always open while no restaurant exists.
   */
  allowSignup: readBool("ALLOW_SIGNUP", false),
  /** People who run the platform itself (not a restaurant). */
  platformAdminEmails: readList("PLATFORM_ADMIN_EMAILS").map((e) => e.toLowerCase()),
  /** Minutes a rider has to accept or decline a delivery before it is passed to the next available rider. 0 = never. */
  riderAcceptMinutes: readInt("RIDER_ACCEPT_MINUTES", 3),
  socketEnabled: readBool("SOCKET_ENABLED", true),
  scheduler: {
    enabled: readBool("SCHEDULER_ENABLED", true),
    intervalMinutes: readInt("SCHEDULER_INTERVAL_MINUTES", 5),
  },
} as const;
