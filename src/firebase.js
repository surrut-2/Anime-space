import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getAnalytics, logEvent as fbLogEvent } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const ts = serverTimestamp;

// Initialize Analytics only when Measurement ID is provided and running in browser
let analytics = null;
try {
  if (typeof window !== "undefined" && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    analytics = getAnalytics(app);
  }
} catch (e) {
  // analytics may fail in non-browser environments or if blocked by browser
  // keep fail-safe behavior
  console.warn("Firebase Analytics not initialized:", e);
}

export const analyticsObj = analytics;
export function logEvent(name, params) {
  if (!analytics) return;
  try {
    fbLogEvent(analytics, name, params);
  } catch (e) {
    console.warn("logEvent failed", e);
  }
}
