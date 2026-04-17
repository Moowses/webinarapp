import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/services/firebase-admin";

export type SystemLogLevel = "info" | "warn" | "error";

export type SystemLogEntry = {
  id: string;
  level: SystemLogLevel;
  action: string;
  summary: string;
  actorType: string;
  actorUid: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string | null;
};

function cleanText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function logSystemEvent(input: {
  level: SystemLogLevel;
  action: string;
  summary: string;
  actorType?: string;
  actorUid?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  details?: string;
}) {
  if (input.actorType === "breakglass") {
    return;
  }

  try {
    await adminDb.collection("systemLogs").add({
      level: input.level,
      action: cleanText(input.action, 120),
      summary: cleanText(input.summary, 240),
      actorType: cleanText(input.actorType, 40),
      actorUid: cleanText(input.actorUid, 120),
      actorEmail: cleanText(input.actorEmail, 200),
      targetType: cleanText(input.targetType, 120),
      targetId: cleanText(input.targetId, 200),
      details: cleanText(input.details, 2000),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to write system log", error);
  }
}

export async function listRecentSystemLogs(limitCount = 50): Promise<SystemLogEntry[]> {
  const snap = await adminDb
    .collection("systemLogs")
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();

  return snap.docs.map((doc) => {
    const raw = doc.data();
    return {
      id: doc.id,
      level: raw.level === "warn" || raw.level === "error" ? raw.level : "info",
      action: cleanText(raw.action, 120),
      summary: cleanText(raw.summary, 240),
      actorType: cleanText(raw.actorType, 40),
      actorUid: cleanText(raw.actorUid, 120),
      actorEmail: cleanText(raw.actorEmail, 200),
      targetType: cleanText(raw.targetType, 120),
      targetId: cleanText(raw.targetId, 200),
      details: cleanText(raw.details, 2000),
      createdAt: toIsoOrNull(raw.createdAt),
    };
  });
}
