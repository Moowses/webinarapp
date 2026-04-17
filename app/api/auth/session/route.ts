import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
  createSessionCookieFromIdToken,
  syncUserProfile,
} from "@/lib/auth/server";
import { adminAuth } from "@/lib/services/firebase-admin";

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

    return NextResponse.json({
      ok: true,
      user: {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to create session" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
