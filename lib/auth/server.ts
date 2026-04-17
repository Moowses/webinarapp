import "server-only";

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/services/firebase-admin";
import {
  USER_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
  isUserRole,
  normalizePermissions,
  type UserPermission,
  type UserRole,
} from "@/lib/auth/roles";

export const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRES_MS = 1000 * 60 * 60 * 24 * 5;

export type AppUserRecord = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  providers: string[];
  role: UserRole;
  isBreakglass: boolean;
  customPermissions: UserPermission[];
  excludedPermissions: UserPermission[];
  disabled: boolean;
  mustSetPassword: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

export type SessionUser = AppUserRecord & {
  effectivePermissions: UserPermission[];
};

function toIsoOrNull(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("toDate" in value)) return null;
  try {
    return (value as { toDate: () => Date }).toDate().toISOString();
  } catch {
    return null;
  }
}

function mapAuthUserProviders(user: UserRecord) {
  return user.providerData.map((provider) => provider.providerId).filter(Boolean);
}

function isBreakglassClaim(value: unknown) {
  return value === true;
}

function resolveIsBreakglass(
  data: Record<string, unknown> | undefined,
  authUser?: UserRecord,
  decodedToken?: DecodedIdToken
) {
  return Boolean(
    data?.isBreakglass ||
      isBreakglassClaim(authUser?.customClaims?.breakglass) ||
      isBreakglassClaim(authUser?.customClaims?.platform_owner) ||
      isBreakglassClaim(decodedToken?.breakglass) ||
      isBreakglassClaim(decodedToken?.platform_owner)
  );
}

function mapUserDoc(
  uid: string,
  authUser: UserRecord,
  data: Record<string, unknown> | undefined
): AppUserRecord {
  const role = isUserRole(data?.role) ? data.role : "user";
  const isBreakglass = resolveIsBreakglass(data, authUser);
  const customPermissions = normalizePermissions(data?.customPermissions);
  const excludedPermissions = normalizePermissions(data?.excludedPermissions);

  return {
    uid,
    email: String(data?.email ?? authUser.email ?? ""),
    displayName: String(data?.displayName ?? authUser.displayName ?? ""),
    photoURL: String(data?.photoURL ?? authUser.photoURL ?? ""),
    providers: Array.isArray(data?.providers)
      ? data.providers.map((value) => String(value)).filter(Boolean)
      : mapAuthUserProviders(authUser),
    role,
    isBreakglass,
    customPermissions,
    excludedPermissions,
    disabled: Boolean(data?.disabled ?? authUser.disabled),
    mustSetPassword: Boolean(data?.mustSetPassword),
    createdAt: toIsoOrNull(data?.createdAt),
    updatedAt: toIsoOrNull(data?.updatedAt),
    lastLoginAt: toIsoOrNull(data?.lastLoginAt),
  };
}

export async function syncUserProfile(uid: string, decodedToken?: DecodedIdToken): Promise<AppUserRecord> {
  const authUser = await adminAuth.getUser(uid);
  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : undefined;

  const payload = {
    email: authUser.email ?? decodedToken?.email ?? "",
    displayName: authUser.displayName ?? decodedToken?.name ?? "",
    photoURL: authUser.photoURL ?? "",
    providers: mapAuthUserProviders(authUser),
    disabled: authUser.disabled,
    role: isUserRole(existing?.role) ? existing.role : "user",
    isBreakglass: resolveIsBreakglass(existing, authUser, decodedToken),
    customPermissions: normalizePermissions(existing?.customPermissions),
    excludedPermissions: normalizePermissions(existing?.excludedPermissions),
    mustSetPassword: Boolean(existing?.mustSetPassword),
    updatedAt: FieldValue.serverTimestamp(),
    lastLoginAt: FieldValue.serverTimestamp(),
    createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });

  return mapUserDoc(uid, authUser, {
    ...existing,
    ...payload,
  });
}

async function getSessionUserFromCookieValue(sessionCookie: string | undefined): Promise<SessionUser | null> {
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const profile = await syncUserProfile(decoded.uid, decoded);
    return {
      ...profile,
      effectivePermissions: profile.isBreakglass
        ? [...USER_PERMISSIONS]
        : getEffectivePermissions(profile.role, profile.customPermissions, profile.excludedPermissions),
    };
  } catch {
    return null;
  }
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return getSessionUserFromCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function requireSignedInUser(nextPath?: string): Promise<SessionUser> {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  return sessionUser;
}

export async function requireAdminUser(
  permission: UserPermission = "view_admin",
  nextPath?: string
): Promise<SessionUser> {
  const sessionUser = await requireSignedInUser(nextPath);
  if (sessionUser.mustSetPassword) {
    redirect("/account?reset=required");
  }
  if (sessionUser.isBreakglass) {
    return {
      ...sessionUser,
      effectivePermissions: [...USER_PERMISSIONS],
    };
  }
  if (!hasPermission(
    sessionUser.role,
    sessionUser.customPermissions,
    sessionUser.excludedPermissions,
    permission
  )) {
    redirect("/account");
  }
  return sessionUser;
}

export async function createSessionCookieFromIdToken(idToken: string) {
  return adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_MS });
}

export function buildSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_EXPIRES_MS / 1000),
  };
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireAdminRequestPermission(permission: UserPermission = "view_admin") {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (sessionUser.isBreakglass) {
    return {
      ok: true as const,
      user: {
        ...sessionUser,
        effectivePermissions: [...USER_PERMISSIONS],
      },
    };
  }
  if (!hasPermission(
    sessionUser.role,
    sessionUser.customPermissions,
    sessionUser.excludedPermissions,
    permission
  )) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
    };
  }
  return {
    ok: true as const,
    user: sessionUser,
  };
}

export async function listAllManagedUsers(): Promise<SessionUser[]> {
  const [userDocs, authUsers] = await Promise.all([
    adminDb.collection("users").get(),
    adminAuth.listUsers(1000),
  ]);

  const authMap = new Map(authUsers.users.map((user) => [user.uid, user]));

  const merged = new Map<string, SessionUser>();

  userDocs.forEach((doc) => {
    const authUser = authMap.get(doc.id);
    if (!authUser) return;
    const profile = mapUserDoc(doc.id, authUser, doc.data());
    if (profile.isBreakglass) return;
    merged.set(doc.id, {
      ...profile,
      effectivePermissions: getEffectivePermissions(
        profile.role,
        profile.customPermissions,
        profile.excludedPermissions
      ),
    });
  });

  authUsers.users.forEach((authUser) => {
    if (merged.has(authUser.uid)) return;
    const profile = mapUserDoc(authUser.uid, authUser, undefined);
    if (profile.isBreakglass) return;
    merged.set(authUser.uid, {
      ...profile,
      effectivePermissions: getEffectivePermissions(
        profile.role,
        profile.customPermissions,
        profile.excludedPermissions
      ),
    });
  });

  return [...merged.values()].sort((a, b) => {
    const roleWeight = { admin: 0, editor: 1, dev: 2, user: 3 } satisfies Record<UserRole, number>;
    return (
      roleWeight[a.role] - roleWeight[b.role] ||
      a.email.localeCompare(b.email) ||
      a.uid.localeCompare(b.uid)
    );
  });
}

export async function isBreakglassUid(uid: string) {
  const cleanUid = uid.trim();
  if (!cleanUid) return false;

  try {
    const [docSnap, authUser] = await Promise.all([
      adminDb.collection("users").doc(cleanUid).get(),
      adminAuth.getUser(cleanUid),
    ]);
    return resolveIsBreakglass(
      docSnap.exists ? (docSnap.data() as Record<string, unknown>) : undefined,
      authUser
    );
  } catch {
    return false;
  }
}

export async function updateManagedUserAccess(input: {
  uid: string;
  role: UserRole;
  grantedPermissions: UserPermission[];
  disabled: boolean;
}) {
  const cleanUid = input.uid.trim();
  if (!cleanUid) throw new Error("uid is required");
  const grantedPermissions = normalizePermissions(input.grantedPermissions);
  const roleDefaults = new Set(getEffectivePermissions(input.role));
  const customPermissions = grantedPermissions.filter((permission) => !roleDefaults.has(permission));
  const excludedPermissions = [...roleDefaults].filter(
    (permission) => !grantedPermissions.includes(permission)
  );

  await adminDb.collection("users").doc(cleanUid).set(
    {
      role: input.role,
      customPermissions,
      excludedPermissions,
      disabled: input.disabled,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await adminAuth.updateUser(cleanUid, { disabled: input.disabled });
}

function buildTemporaryPassword() {
  return `Tmp!${randomBytes(6).toString("base64url")}9a`;
}

async function sendFirebasePasswordResetEmail(email: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(payload.error?.message || "Failed to send reset email");
  }
}

export async function createManagedUser(input: {
  email: string;
  role: UserRole;
  grantedPermissions: UserPermission[];
  displayName?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const temporaryPassword = buildTemporaryPassword();
  const displayName = input.displayName?.trim() || email.split("@")[0];
  const grantedPermissions = normalizePermissions(input.grantedPermissions);
  const roleDefaults = new Set(getEffectivePermissions(input.role));
  const customPermissions = grantedPermissions.filter((permission) => !roleDefaults.has(permission));
  const excludedPermissions = [...roleDefaults].filter(
    (permission) => !grantedPermissions.includes(permission)
  );

  let userRecord: UserRecord;
  try {
    userRecord = await adminAuth.createUser({
      email,
      password: temporaryPassword,
      displayName,
      emailVerified: false,
      disabled: false,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/email-already-exists"
    ) {
      throw new Error("A user with that email already exists.");
    }
    throw error;
  }

  await adminDb.collection("users").doc(userRecord.uid).set(
    {
      email,
      displayName,
      photoURL: userRecord.photoURL ?? "",
      providers: ["password"],
      role: input.role,
      customPermissions,
      excludedPermissions,
      disabled: false,
      mustSetPassword: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: null,
    },
    { merge: true }
  );

  return {
    uid: userRecord.uid,
    email,
    temporaryPassword,
  };
}

export async function clearMustSetPasswordFlag(uid: string) {
  const cleanUid = uid.trim();
  if (!cleanUid) throw new Error("uid is required");

  await adminDb.collection("users").doc(cleanUid).set(
    {
      mustSetPassword: false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function sendManagedUserPasswordReset(uid: string) {
  const cleanUid = uid.trim();
  if (!cleanUid) throw new Error("uid is required");

  const userRecord = await adminAuth.getUser(cleanUid);
  if (!userRecord.email) {
    throw new Error("User does not have an email address.");
  }

  await sendFirebasePasswordResetEmail(userRecord.email);
  await adminDb.collection("users").doc(cleanUid).set(
    {
      mustSetPassword: true,
      updatedAt: FieldValue.serverTimestamp(),
      passwordResetSentAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { email: userRecord.email };
}

export async function deleteManagedUser(uid: string) {
  const cleanUid = uid.trim();
  if (!cleanUid) throw new Error("uid is required");

  await adminAuth.deleteUser(cleanUid);
  await adminDb.collection("users").doc(cleanUid).delete();
}
