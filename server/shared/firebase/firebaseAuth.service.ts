// Firebase Authentication as the identity provider. Staff passwords live in Firebase (never bcrypt in
// Postgres) when Firebase is configured; Google and phone sign-ins arrive as Firebase ID tokens that
// the Admin SDK verifies. Without Firebase credentials the server falls back to bcrypt so local
// development still works.
import { env } from "../../config/env";
import { firebaseConfigured, getFirebaseAuth, getServiceAccountAccessToken } from "../../infrastructure/firebase/firebaseAdmin";
import { AppError } from "../errors/AppError";

/** Stored in `users.password_hash` when Firebase holds the credential. */
export const FIREBASE_MANAGED_PASSWORD = "firebase:managed";

export interface VerifiedIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  name: string | null;
  /** "google.com" | "password" | "phone" | … */
  provider: string;
}

export class FirebaseAuthService {
  static Instance = new FirebaseAuthService();
  private cachedWebApiKey: string | null = null;
  private constructor() {}

  get isConfigured(): boolean {
    return firebaseConfigured();
  }

  /** Verifies a Firebase ID token produced by the client SDK (email/password, Google, phone). */
  async verifyIdToken(idToken: string): Promise<VerifiedIdentity> {
    if (!this.isConfigured) throw AppError.unavailable("Sign-in with Firebase is not configured on the server");
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase() ?? null,
        emailVerified: Boolean(decoded.email_verified),
        phone: decoded.phone_number ?? null,
        name: typeof decoded.name === "string" ? decoded.name : null,
        provider: decoded.firebase?.sign_in_provider ?? "unknown",
      };
    } catch (err) {
      console.warn("[firebase] id token rejected:", err instanceof Error ? err.message : err);
      throw AppError.unauthorised("Your sign-in could not be verified, please try again");
    }
  }

  /** Create or update the Firebase user that holds this staff member's password. Returns the uid. */
  async upsertUserPassword(email: string, password: string, displayName?: string): Promise<string> {
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

  /** Email + password check against Firebase (`accounts:signInWithPassword`). */
  async verifyUserPassword(email: string, password: string): Promise<{ ok: boolean; uid: string | null }> {
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

  /** Verifies a raw Google ID token (for clients using Google Identity Services instead of Firebase). */
  async verifyGoogleIdToken(idToken: string): Promise<{ email: string; name: string | null; sub: string }> {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { signal: AbortSignal.timeout(15_000) }).catch(
      () => null
    );
    if (!res || !res.ok) throw AppError.unauthorised("Invalid Google sign-in token");
    const payload = (await res.json()) as { email?: string; email_verified?: string; name?: string; sub?: string };
    if (!payload.email || payload.email_verified !== "true" || !payload.sub) throw AppError.unauthorised("Google account email is not verified");
    return { email: payload.email.toLowerCase(), name: payload.name ?? null, sub: payload.sub };
  }
}
