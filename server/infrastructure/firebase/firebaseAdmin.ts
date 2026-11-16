// The only place the Firebase Admin SDK is initialised. Lazy + credential-guarded (see
// ai_agent_flow_firebase.md §4.1 / §7.2): nothing touches the SDK unless a service account is configured,
// so a missing credential becomes a clean AppError instead of an unhandled rejection that kills the process.
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";

let app: App | null = null;

export const firebaseConfigured = (): boolean => env.firebase.configured;

export function getFirebaseApp(): App {
  if (!env.firebase.configured) {
    throw AppError.unavailable("Firebase is not configured on the server — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY");
  }
  if (app) return app;
  app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId: env.firebase.projectId, clientEmail: env.firebase.clientEmail, privateKey: env.firebase.privateKey }),
      projectId: env.firebase.projectId,
    });
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Short-lived Google OAuth2 token for the service account (Identity Toolkit admin REST calls). */
export async function getServiceAccountAccessToken(): Promise<string> {
  const credential = getFirebaseApp().options.credential;
  if (!credential) throw AppError.unavailable("Firebase credential is missing");
  const token = await credential.getAccessToken();
  return token.access_token;
}
