import { access, rm } from "fs/promises";
import { join, normalize } from "path";
import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";

export const runtime = "nodejs";

function resolveVideoPath(publicPath: string) {
  if (!publicPath.startsWith("/uploads/webinars/")) {
    throw new Error("invalid video path");
  }

  const normalized = normalize(publicPath).replace(/^([\\/])+/, "");
  if (!normalized.startsWith("uploads\\webinars") && !normalized.startsWith("uploads/webinars")) {
    throw new Error("invalid video path");
  }

  return join(process.cwd(), "public", normalized);
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestPermission("webinar_edit_video");
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as { publicPath?: string };
    const publicPath = String(body.publicPath ?? "").trim();
    if (!publicPath) {
      return NextResponse.json({ error: "publicPath is required" }, { status: 400 });
    }

    const filePath = resolveVideoPath(publicPath);
    await access(filePath);
    await rm(filePath, { force: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
