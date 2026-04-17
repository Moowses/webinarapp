import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import { NextResponse } from "next/server";
import { requireAdminRequestPermission } from "@/lib/auth/server";
import { logSystemEvent } from "@/lib/system-log";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestPermission("webinar_edit_confirmation_page");
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");
    const webinarId = String(formData.get("webinarId") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "file is empty" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "file is too large" }, { status: 413 });
    }

    const folderKey = sanitizeSegment(webinarId || slug);
    if (!folderKey) {
      return NextResponse.json({ error: "slug or webinarId is required" }, { status: 400 });
    }

    const originalName = sanitizeFilename(file.name || "media");
    const ext = extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "unsupported format. use mp4, webm, mov, m4v, jpg, jpeg, png, webp, or gif" },
        { status: 400 }
      );
    }

    const baseName = originalName.slice(0, -ext.length) || "media";
    const uniqueName = `${baseName}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const targetDir = join(process.cwd(), "public", "uploads", "webinars", folderKey, "confirmation");

    await mkdir(targetDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(targetDir, uniqueName), buffer);

    const publicPath = `/uploads/webinars/${folderKey}/confirmation/${uniqueName}`;
    const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
    await logSystemEvent({
      level: "info",
      action: "confirmation_media_uploaded",
      summary: "Confirmation page media uploaded.",
      actorType: auth.user.isBreakglass ? "breakglass" : "user",
      actorUid: auth.user.uid,
      actorEmail: auth.user.email,
      targetType: "confirmation_media",
      targetId: webinarId || slug || folderKey,
      details: publicPath,
    });

    return NextResponse.json({ publicPath, mediaType });
  } catch (error) {
    await logSystemEvent({
      level: "error",
      action: "confirmation_media_upload_failed",
      summary: "Confirmation page media upload failed.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
