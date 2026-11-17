// Firebase Authentication is the only place passwords live: Postgres stores no password or hash, only the
// Firebase uid. Google (and phone) sign-ins arrive as Firebase ID tokens that the Admin SDK verifies.
// Without Firebase credentials nobody can sign in, and the server says so instead of falling back.
import { env } from "../../config/env";
import { firebaseConfigured, getFirebaseAuth, getServiceAccountAccessToken } from "../../infrastructure/firebase/firebaseAdmin";
import { AppError } from "../errors/AppError";

export interface VerifiedIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  name: string | null;
  /** "google.com" | "password" | "phone" | … */
  provider: string;
  /** When the person last actually signed in (seconds since the epoch), not when the token was refreshed. */
  authTime: number;
}

export class FirebaseAuthService {
  static Instance = new FirebaseAuthService();
  private cachedWebApiKey: string | null = null;
  private constructor() {}

  get isConfigured(): boolean {
    return firebaseConfigured();
  }

  /** Sign-in needs Firebase; without it, say so plainly (503) rather than failing in some confusing way. */
  assertConfigured(): void {
    if (!this.isConfigured) throw AppError.unavailable("Sign-in is not set up on this server yet: Firebase credentials are missing");
  }

  /** Verifies a Firebase ID token produced by the client SDK (email/password, Google, phone). */
  async verifyIdToken(idToken: string): Promise<VerifiedIdentity> {
    this.assertConfigured();
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase() ?? null,
        emailVerified: Boolean(decoded.email_verified),
        phone: decoded.phone_number ?? null,
        name: typeof decoded.name === "string" ? decoded.name : null,
        provider: decoded.firebase?.sign_in_provider ?? "unknown",
        authTime: decoded.auth_time,
      };
    } catch (err) {
      console.warn("[firebase] id token rejected:", err instanceof Error ? err.message : err);
      throw AppError.unauthorised("Your sign-in could not be verified, please try again");
    }
  }

  /** Create or update the Firebase user that holds this staff member's password. Returns the uid. */
  async upsertUserPassword(email: string, password: string, displayName?: string): Promise<string> {
    this.assertConfigured();
    const auth = getFirebaseAuth();
    const normalized = email.trim().toLowerCase();
    try {
      const existing = await auth.getUserByEmail(normalized).catch(() => null);
      if (existing) {
        await auth.updateUser(existing.uid, { password, ...(displayName ? { displayName } : {}), emailVerified: true });
        return existing.uid;
      }
      const created = await auth.createUser({ email: normalized, password, ...(displayName ? { displayName } : {}), emailVerified: true });
      return created.uid;
    } catch (err) {
      console.error("[firebase] could not save credentials", err instanceof Error ? err.message : err);
      throw AppError.unavailable("Could not save your credentials, please try again");
    }
  }

  /** Which ways this email can sign in: with a password, with Google, or both. */
  async signInMethods(email: string): Promise<{ password: boolean; google: boolean }> {
    this.assertConfigured();
    const user = await getFirebaseAuth()
      .getUserByEmail(email.trim().toLowerCase())
      .catch(() => null);
    const ids = user?.providerData.map((p) => p.providerId) ?? [];
    return { password: ids.includes("password"), google: ids.includes("google.com") };
  }

  /** Ends every Firebase session for a uid (deactivation, password change). */
  async revokeSessions(uid: string | null): Promise<void> {
    if (!uid || !this.isConfigured) return;
    await getFirebaseAuth()
      .revokeRefreshTokens(uid)
      .catch((err) => console.warn("[firebase] revoke failed", err instanceof Error ? err.message : err));
  }

  async disableUser(uid: string | null, disabled: boolean): Promise<void> {
    if (!uid || !this.isConfigured) return;
    await getFirebaseAuth()
      .updateUser(uid, { disabled })
      .catch((err) => console.warn("[firebase] disable failed", err instanceof Error ? err.message : err));
  }

  private async webApiKey(): Promise<string> {
    if (env.firebase.webApiKey) return env.firebase.webApiKey;
    if (this.cachedWebApiKey) return this.cachedWebApiKey;
    const token = await getServiceAccountAccessToken();
    const res = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${env.firebase.projectId}/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const cfg = (await res.json()) as { client?: { apiKey?: string } };
      if (cfg.client?.apiKey) {
        this.cachedWebApiKey = cfg.client.apiKey;
        return this.cachedWebApiKey;
      }
    }
    throw AppError.unavailable("FIREBASE_API_KEY is not set and could not be discovered");
  }

  /**
   * Checks an email and password against Firebase and returns the uid when they are right, otherwise null.
   * Anyone can create a Firebase account for any address from a browser, so an account only counts as that
   * person's once its email is verified (accounts created here always are).
   */
  async checkPassword(email: string, password: string): Promise<string | null> {
    this.assertConfigured();
    const result = await this.verifyUserPassword(email, password);
    if (!result.ok || !result.uid) return null;
    const user = await getFirebaseAuth()
      .getUser(result.uid)
      .catch(() => null);
    return user && user.emailVerified && !user.disabled ? user.uid : null;
  }

  /** Email + password check against Firebase (`accounts:signInWithPassword`). */
  private async verifyUserPassword(email: string, password: string): Promise<{ ok: boolean; uid: string | null }> {
    try {
      const apiKey = await this.webApiKey();
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, uid: null };
      const data = (await res.json()) as { localId?: string };
      return { ok: true, uid: data.localId ?? null };
    } catch (err) {
      console.error("[firebase] password verification error", err instanceof Error ? err.message : err);
      return { ok: false, uid: null };
    }
  }
}
