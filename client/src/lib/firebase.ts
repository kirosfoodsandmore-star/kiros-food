// Firebase client: identity (phone, Google, email/password) and Firestore for live chat threads.
// The server verifies ID tokens and issues its own JWTs; Firestore reads are gated by firestore.rules.
import { getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  // Needed for push notifications (Firebase Cloud Messaging); sign-in works without them.
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** Web push needs the sender id, app id and the VAPID key (Project settings → Cloud Messaging → Web Push certificates). */
export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
export const pushConfigured = Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId && vapidKey && config.apiKey !== "e2e-placeholder")

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.apiKey !== "e2e-placeholder")

let app: FirebaseApp | null = null
export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase is not configured (VITE_FIREBASE_*)")
  app ??= getApps()[0] ?? initializeApp(config)
  return app
}

export function firebaseAuth() {
  return getAuth(firebaseApp())
}

export function firestoreDb(): Firestore {
  return getFirestore(firebaseApp())
}

export async function currentIdToken(forceRefresh = false): Promise<string | null> {
  if (!firebaseConfigured) return null
  const user: User | null = firebaseAuth().currentUser
  return user ? user.getIdToken(forceRefresh) : null
}

export async function signInWithGoogle(): Promise<string> {
  const provider = new GoogleAuthProvider()
  // Always show the account picker, so someone with several Google accounts (work and personal) chooses the right one.
  provider.setCustomParameters({ prompt: "select_account" })
  const result = await signInWithPopup(firebaseAuth(), provider)
  return result.user.getIdToken()
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  const result = await signInWithEmailAndPassword(firebaseAuth(), email, password)
  return result.user.getIdToken()
}

let recaptcha: RecaptchaVerifier | null = null
/** Phone sign-in step 1: send the SMS code. `containerId` is an element for the invisible reCAPTCHA. */
export async function startPhoneSignIn(phone: string, containerId: string): Promise<ConfirmationResult> {
  recaptcha ??= new RecaptchaVerifier(firebaseAuth(), containerId, { size: "invisible" })
  return signInWithPhoneNumber(firebaseAuth(), phone, recaptcha)
}

/** Phone sign-in step 2: confirm the code → Firebase ID token for the API. */
export async function confirmPhoneCode(confirmation: ConfirmationResult, code: string): Promise<string> {
  const result = await confirmation.confirm(code)
  return result.user.getIdToken()
}

export async function firebaseSignOut(): Promise<void> {
  if (!firebaseConfigured) return
  await signOut(firebaseAuth()).catch(() => undefined)
}
