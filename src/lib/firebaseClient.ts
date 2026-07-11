import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Client-side Firebase app. The whole app is a static export on Firebase
 * Hosting (free plan): Auth and Firestore are both accessed directly from the
 * browser, guarded by the per-user security rules in firestore.rules.
 *
 * Set NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1 to run against the local
 * Auth/Firestore emulators (ports from firebase.json) with a demo project.
 */
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "1";

let emulatorsConnected = false;

function app(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? (useEmulators ? "fake" : undefined),
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      (useEmulators ? "demo-rekam" : undefined),
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function firebaseConfigured(): boolean {
  if (useEmulators) return true;
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function connectEmulators(auth: Auth, db: Firestore) {
  if (!useEmulators || emulatorsConnected) return;
  emulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8089);
}

export function clientAuth(): Auth {
  const a = app();
  const auth = getAuth(a);
  connectEmulators(auth, getFirestore(a));
  return auth;
}

export function clientDb(): Firestore {
  const a = app();
  const db = getFirestore(a);
  connectEmulators(getAuth(a), db);
  return db;
}
