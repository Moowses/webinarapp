import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import { getAdminLiveOverview } from "@/lib/services/admin-live-overview";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAdminRequestPermission("view_admin");
    if (!auth.ok) return auth.response;

    const overview = await getAdminLiveOverview();
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "failed to load live overview" }, { status: 500 });
  }
}
