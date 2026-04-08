import { NextResponse } from "next/server";
import { getAdminLiveOverview } from "@/lib/services/admin-live-overview";

export const runtime = "nodejs";

export async function GET() {
  try {
    const overview = await getAdminLiveOverview();
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "failed to load live overview" }, { status: 500 });
  }
}
