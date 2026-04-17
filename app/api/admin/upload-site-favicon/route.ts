import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import { logSystemEvent } from "@/lib/system-log";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Map<string, string>([
  ["image/png", ".png"],
  ["image/x-icon", ".ico"],
  ["image/vnd.microsoft.icon", ".ico"],
  ["image/svg+xml", ".svg"],
  ["image/webp", ".webp"],
]);

const MAX_BYTES = 512 * 1024;

function safeSlugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestPermission("manage_settings");
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const extension =
      ALLOWED_TYPES.get(file.type) ||
      (() => {
        const ext = path.extname(file.name).toLowerCase();
        return [".png", ".ico", ".svg", ".webp"].includes(ext) ? ext : "";
      })();

    if (!extension) {
      return NextResponse.json(
        { error: "Only PNG, ICO, SVG, and WEBP favicon files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Favicon file must be 512 KB or smaller" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "site");
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${safeSlugPart(path.basename(file.name, path.extname(file.name))) || "favicon"}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
    const targetPath = path.join(uploadsDir, fileName);
    await writeFile(targetPath, bytes);
    const publicPath = `/uploads/site/${fileName}`;
    await logSystemEvent({
      level: "info",
      action: "favicon_uploaded",
      summary: "Favicon uploaded.",
      actorType: auth.user.isBreakglass ? "breakglass" : "user",
      actorUid: auth.user.uid,
      actorEmail: auth.user.email,
      targetType: "site_asset",
      targetId: publicPath,
    });

    return NextResponse.json({
      ok: true,
      publicPath,
    });
  } catch (error) {
    await logSystemEvent({
      level: "error",
      action: "favicon_upload_failed",
      summary: "Favicon upload failed.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to upload favicon" }, { status: 500 });
  }
}
