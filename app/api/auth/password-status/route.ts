import { NextResponse } from "next/server";
import { clearMustSetPasswordFlag, getCurrentSessionUser } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST() {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  await clearMustSetPasswordFlag(sessionUser.uid);
  return NextResponse.json({ ok: true });
}
