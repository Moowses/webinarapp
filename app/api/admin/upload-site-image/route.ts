import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

const MAX_BYTES = 2 * 1024 * 1024;

function safeSlugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const extension =
      ALLOWED_TYPES.get(file.type) ||
      (() => {
        const ext = path.extname(file.name).toLowerCase();
        return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
          ? ext === ".jpeg"
            ? ".jpg"
            : ext
          : "";
      })();

    if (!extension) {
      return NextResponse.json(
        { error: "Only PNG, JPG, WEBP, and GIF image files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "SEO image file must be 2 MB or smaller" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "site");
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${safeSlugPart(path.basename(file.name, path.extname(file.name))) || "share-image"}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
    const targetPath = path.join(uploadsDir, fileName);
    await writeFile(targetPath, bytes);

    return NextResponse.json({
      ok: true,
      publicPath: `/uploads/site/${fileName}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to upload SEO image" }, { status: 500 });
  }
}
