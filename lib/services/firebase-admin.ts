import "server-only";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!process.env.FIREBASE_PROJECT_ID) throw new Error("Missing FIREBASE_PROJECT_ID");
if (!process.env.FIREBASE_CLIENT_EMAIL) throw new Error("Missing FIREBASE_CLIENT_EMAIL");
if (!process.env.FIREBASE_PRIVATE_KEY) throw new Error("Missing FIREBASE_PRIVATE_KEY");

const adminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      })
    : getApps()[0];

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
