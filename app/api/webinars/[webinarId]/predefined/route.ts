import { FieldPath } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params;
    const cleanWebinarId = webinarId.trim();
    if (!cleanWebinarId) {
      return NextResponse.json({ error: "webinarId is required" }, { status: 400 });
    }

    const url = new URL(request.url);
    const uptoSecRaw = Number(url.searchParams.get("uptoSec") ?? "0");
    const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? "200");
    const cursorSecRaw = url.searchParams.get("cursorSec");
    const cursorIdRaw = url.searchParams.get("cursorId");

    const uptoSec = Number.isFinite(uptoSecRaw) ? Math.max(0, Math.floor(uptoSecRaw)) : 0;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(500, Math.max(1, Math.floor(pageSizeRaw)))
      : 200;

    let q = adminDb
      .collection("webinars")
      .doc(cleanWebinarId)
      .collection("predefinedMessages")
      .where("playbackOffsetSec", "<=", uptoSec)
      .orderBy("playbackOffsetSec", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(pageSize);

    if (cursorSecRaw && cursorIdRaw) {
      const cursorSec = Number(cursorSecRaw);
      if (Number.isFinite(cursorSec)) {
        q = q.startAfter(Math.floor(cursorSec), cursorIdRaw);
      }
    }

    const snap = await q.get();
    const messages = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        playbackOffsetSec: Number(data.playbackOffsetSec ?? 0),
        senderName: String(data.senderName ?? "Host"),
        text: String(data.text ?? ""),
      };
    });

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc
      ? {
          cursorSec: Number(lastDoc.data().playbackOffsetSec ?? 0),
          cursorId: lastDoc.id,
        }
      : null;

    let hasMore = snap.size === pageSize;
    if (!hasMore) {
      const futureSnap = await adminDb
        .collection("webinars")
        .doc(cleanWebinarId)
        .collection("predefinedMessages")
        .where("playbackOffsetSec", ">", uptoSec)
        .limit(1)
        .get();
      hasMore = !futureSnap.empty;
    }

    return NextResponse.json({
      messages,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("Failed to fetch predefined messages", error);
    return NextResponse.json({ error: "failed to fetch predefined messages" }, { status: 500 });
  }
}
