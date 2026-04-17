import { readFile } from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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

function parseArgs() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3]?.trim();

  if (!email || !password) {
    throw new Error("Usage: node scripts/cbg.mjs <email> <password>");
  }

  return { email, password };
}

async function main() {
  const { email, password } = parseArgs();
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

  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, {
      password,
      disabled: false,
      emailVerified: true,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      user = await auth.createUser({
        email,
        password,
        displayName: "Break Glass",
        disabled: false,
        emailVerified: true,
      });
    } else {
      throw error;
    }
  }

  const nextClaims = {
    ...(user.customClaims ?? {}),
    breakglass: true,
    platform_owner: true,
  };

  await auth.setCustomUserClaims(user.uid, nextClaims);

  await db.collection("users").doc(user.uid).set(
    {
      email: user.email ?? email,
      displayName: user.displayName ?? "Break Glass",
      photoURL: user.photoURL ?? "",
      providers: user.providerData.map((provider) => provider.providerId).filter(Boolean),
      role: "admin",
      isBreakglass: true,
      customPermissions: [],
      excludedPermissions: [],
      disabled: false,
      mustSetPassword: false,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection("systemLogs").add({
    level: "warn",
    action: "breakglass_created",
    summary: `Break-glass account created or updated for ${email}.`,
    actorType: "system",
    actorUid: "",
    actorEmail: "",
    targetType: "breakglass_account",
    targetId: user.uid,
    details: email,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Break-glass account ready for ${email} (${user.uid})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
