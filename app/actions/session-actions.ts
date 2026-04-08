"use server";

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/services/firebase-admin";
import { hashToken } from "@/lib/utils/tokens";

export type SessionRecord = {
  id: string;
  sessionKey: string;
  webinarId: string;
  timezoneGroupKey: string;
  scheduledStartISO: string;
};

export async function getOrCreateSessionAction(input: {
  webinarId: string;
  timezoneGroupKey: string;
  scheduledStartISO: string;
}) {
  if (!input.webinarId.trim()) {
    throw new Error("webinarId is required");
  }
  if (!input.timezoneGroupKey.trim()) {
    throw new Error("timezoneGroupKey is required");
  }
  if (!input.scheduledStartISO.trim()) {
    throw new Error("scheduledStartISO is required");
  }

  const sessionKey = `${input.webinarId}__${input.timezoneGroupKey}__${input.scheduledStartISO}`;
  const sessionId = hashToken(sessionKey).slice(0, 40);
  const sessionRef = adminDb.collection("sessions").doc(sessionId);
  const snap = await sessionRef.get();

  if (!snap.exists) {
    await sessionRef.set({
      sessionKey,
      webinarId: input.webinarId,
      timezoneGroupKey: input.timezoneGroupKey,
      scheduledStartISO: input.scheduledStartISO,
      status: "Live",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { sessionId, sessionKey };
}
