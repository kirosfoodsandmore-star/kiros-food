// Firestore (realtime fan-out for order chat). Server-only writes through the Admin SDK; clients open
// read listeners gated by firestore.rules. Shares the credential-guarded app from firebaseAdmin.ts.
import { FieldValue, getFirestore as getFirestoreInstance, Timestamp, type Firestore } from "firebase-admin/firestore";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import { getFirebaseApp } from "../firebase/firebaseAdmin";

let firestore: Firestore | null = null;

export const firestoreConfigured = (): boolean => env.firebase.configured;

export function getFirestore(): Firestore {
  if (!env.firebase.configured) {
    throw AppError.unavailable("Live chat is not configured on the server (Firebase credentials missing)");
  }
  if (firestore) return firestore;
  firestore = getFirestoreInstance(getFirebaseApp());
  return firestore;
}

/** Wrap any Firestore failure as a 503 so an outage never surfaces as a 500 with internals. */
export function firestoreUnavailable(scope: string, err: unknown): AppError {
  console.error(`[${scope}] Firestore error:`, err instanceof Error ? err.message : err);
  return AppError.unavailable("Live chat is temporarily unavailable");
}

export { FieldValue, Timestamp };
