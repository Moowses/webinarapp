import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  createSessionCookieFromIdToken,
  getCurrentSessionUser,
  syncUserProfile,
} from "@/lib/auth/server";
import { adminAuth } from "@/lib/services/firebase-admin";
import { logSystemEvent } from "@/lib/system-log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: unknown };
    const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";

    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const sessionCookie = await createSessionCookieFromIdToken(idToken);
    const profile = await syncUserProfile(decoded.uid, decoded);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, buildSessionCookieOptions());
    await logSystemEvent({
      level: "info",
      action: "login_success",
      summary: "User signed in successfully.",
      actorType: profile.isBreakglass ? "breakglass" : "user",
      actorUid: profile.uid,
      actorEmail: profile.email,
      targetType: "session",
    });

    return NextResponse.json({
      ok: true,
      user: {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      },
    });
  } catch (error) {
    await logSystemEvent({
      level: "error",
      action: "login_failed",
      summary: "Failed to create secure session during login.",
      actorType: "user",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to create session" }, { status: 401 });
  }
}

export async function DELETE() {
  const sessionUser = await getCurrentSessionUser();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  if (!sessionUser?.isBreakglass) {
    await logSystemEvent({
      level: "info",
      action: "logout",
      summary: "User signed out.",
      actorType: "user",
      actorUid: sessionUser?.uid,
      actorEmail: sessionUser?.email,
      targetType: "session",
    });
  }
  return NextResponse.json({ ok: true });
}
