import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const WRITE_BATCH_SIZE = 400;

type ParsedRow = {
  playbackOffsetSec: number;
  senderName: string;
  text: string;
};

const TIMESTAMP_LINE_REGEX = /^\d{2}:\d{2}:\d{2}$/;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseTimestampToSec(raw: string): number | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (/^\d+$/.test(clean)) {
    const sec = Number(clean);
    return Number.isFinite(sec) && sec >= 0 ? sec : null;
  }
  const parts = clean.split(":").map((x) => Number(x.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;

  if (parts.length === 2) {
    const [mm, ss] = parts;
    if (!Number.isInteger(mm) || !Number.isInteger(ss) || ss > 59) return null;
    return mm * 60 + ss;
  }

  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    if (
      !Number.isInteger(hh) ||
      !Number.isInteger(mm) ||
      !Number.isInteger(ss) ||
      mm > 59 ||
      ss > 59
    ) {
      return null;
    }
    return hh * 3600 + mm * 60 + ss;
  }

  return null;
}

function normalizeSender(sender: string): string {
  return sender.trim().replace(/:+$/, "").trim();
}

function parseColumns(line: string): { timestamp: string; sender: string; message: string } {
  if (line.includes("|")) {
    const parts = line.split("|").map((x) => x.trim());
    const [timestamp = "", sender = "", ...messageParts] = parts;
    return { timestamp, sender, message: messageParts.join("|").trim() };
  }

  if (line.includes("\t")) {
    const parts = line.split("\t").map((x) => x.trim());
    const [timestamp = "", sender = "", ...messageParts] = parts;
    return { timestamp, sender, message: messageParts.join(" ").trim() };
  }

  const [timestamp = "", sender = "", ...messageParts] = parseCsvLine(line);
  return { timestamp, sender, message: messageParts.join(",").trim() };
}

function parseCsv(text: string): { rows: ParsedRow[]; skipped: number } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const { timestamp, sender, message } = parseColumns(line);

    const maybeHeader =
      i === 0 &&
      (timestamp.toLowerCase().includes("timestamp") || timestamp.toLowerCase().includes("time")) &&
      (sender.toLowerCase().includes("sender") || sender.toLowerCase().includes("user"));
    if (maybeHeader) continue;

    const playbackOffsetSec = parseTimestampToSec(timestamp);
    const senderName = normalizeSender(sender);

    if (playbackOffsetSec === null || playbackOffsetSec < 0 || !senderName || !message) {
      skipped += 1;
      continue;
    }

    rows.push({
      playbackOffsetSec,
      senderName,
      text: message,
    });
  }

  return { rows, skipped };
}

function parseTranscriptTxt(text: string): { rows: ParsedRow[]; skipped: number } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const singleLineRows = lines.filter((line) => line.trim()).every((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const { timestamp, sender, message } = parseColumns(trimmed);
    return TIMESTAMP_LINE_REGEX.test(timestamp) && Boolean(normalizeSender(sender)) && Boolean(message);
  });

  if (singleLineRows) {
    return parseCsv(text);
  }

  const rows: ParsedRow[] = [];
  let skipped = 0;

  let i = 0;
  while (i < lines.length) {
    const timestampLine = lines[i]?.trim() ?? "";
    if (!timestampLine) {
      i += 1;
      continue;
    }

    if (!TIMESTAMP_LINE_REGEX.test(timestampLine)) {
      skipped += 1;
      i += 1;
      continue;
    }

    const playbackOffsetSec = parseTimestampToSec(timestampLine);
    const senderLine = lines[i + 1]?.trim() ?? "";
    const messageLine = lines[i + 2] ?? "";

    if (playbackOffsetSec === null || !senderLine || !senderLine.endsWith(":")) {
      skipped += 1;
      i += 1;
      continue;
    }

    const senderName = normalizeSender(senderLine);
    const textValue = messageLine.trim();

    if (!senderName || !textValue) {
      skipped += 1;
      i += 3;
      continue;
    }

    rows.push({
      playbackOffsetSec,
      senderName,
      text: textValue,
    });

    i += 3;
  }

  return { rows, skipped };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const webinarId = String(formData.get("webinarId") ?? "").trim();
    const file = formData.get("file");

    if (!webinarId) {
      return NextResponse.json({ error: "webinarId is required" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "file is empty" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `file is too large (max ${MAX_UPLOAD_BYTES} bytes)` },
        { status: 413 }
      );
    }

    const fileType = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    const isCsv =
      fileName.endsWith(".csv") ||
      fileType === "text/csv" ||
      fileType === "application/vnd.ms-excel";
    const isTxt = fileName.endsWith(".txt") || fileType === "text/plain";

    if (!isCsv && !isTxt && fileType !== "") {
      return NextResponse.json({ error: "only CSV or TXT files are allowed" }, { status: 400 });
    }

    const text = new TextDecoder("utf-8").decode(Buffer.from(await file.arrayBuffer()));
    const parser = isTxt ? parseTranscriptTxt : parseCsv;
    const { rows, skipped } = parser(text);

    if (rows.length === 0) {
      return NextResponse.json({ inserted: 0, skipped });
    }

    const collectionRef = adminDb
      .collection("webinars")
      .doc(webinarId)
      .collection("predefinedMessages");

    let inserted = 0;

    for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
      const chunk = rows.slice(i, i + WRITE_BATCH_SIZE);
      const batch = adminDb.batch();

      chunk.forEach((row, chunkIndex) => {
        const rowIndex = i + chunkIndex;
        const docRef = collectionRef.doc();
        const orderKey = `${String(row.playbackOffsetSec).padStart(8, "0")}_${String(
          rowIndex
        ).padStart(8, "0")}`;

        batch.set(docRef, {
          playbackOffsetSec: row.playbackOffsetSec,
          senderName: row.senderName,
          text: row.text,
          orderKey,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      inserted += chunk.length;
    }

    return NextResponse.json({ inserted, skipped });
  } catch (error) {
    console.error("Upload predefined chat failed", error);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
