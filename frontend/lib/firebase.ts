import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize if API key is present to prevent fatal runtime crash
const app =
  getApps().length === 0 && firebaseConfig.apiKey
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const auth = app ? getAuth(app) : (null as any);
export const googleProvider = new GoogleAuthProvider();
