import { readFile } from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function parseEnvFile(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadLocalEnv() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = path.join(rootDir, ".env.local");
  const content = await readFile(envPath, "utf8");
  const parsed = parseEnvFile(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const role = process.argv[3]?.trim().toLowerCase() || "admin";

  if (!email) {
    throw new Error("Usage: node scripts/grant-admin.mjs <email> [role]");
  }

  await loadLocalEnv();

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: getRequiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: getRequiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });

  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = await auth.getUserByEmail(email);

  await db.collection("users").doc(user.uid).set(
    {
      email: user.email ?? email,
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      providers: user.providerData.map((provider) => provider.providerId).filter(Boolean),
      role,
      customPermissions: [],
      disabled: user.disabled,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Granted ${role} access to ${email} (${user.uid})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
