"use server";

import "server-only";
import { requireAdminUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/services/firebase-admin";

const DELETE_BATCH_SIZE = 400;

export async function clearPredefinedChatAction(webinarId: string) {
  await requireAdminUser("webinar_edit_predefined_chat", `/admin/webinars/${webinarId}`);
  const cleanWebinarId = webinarId.trim();
  if (!cleanWebinarId) {
    throw new Error("webinarId is required");
  }

  const collectionRef = adminDb
    .collection("webinars")
    .doc(cleanWebinarId)
    .collection("predefinedMessages");

  let deleted = 0;

  while (true) {
    const snap = await collectionRef.limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = adminDb.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();
  }

  return { deleted };
}
