import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";
import { completeChatbotKitConversation } from "@/lib/services/chatbotkit";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 40;
const MIN_WORDS_FOR_BOT = 4;
const BOT_HISTORY_LIMIT = 20;

function cleanText(value: unknown, maxLength: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

async function loadBotHistory(sessionId: string) {
  const snap = await adminDb
    .collection("sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(BOT_HISTORY_LIMIT)
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        senderName: cleanText(data.senderName, MAX_NAME_LENGTH) || "Guest",
        text: cleanText(data.text, MAX_MESSAGE_LENGTH),
        type:
          data.type === "ai" || data.type === "system" || data.type === "predefined"
            ? data.type
            : "user",
      };
    })
    .filter((message) => message.text && message.type !== "predefined")
    .reverse();
}

function buildBotPrompt(history: Array<{ senderName: string; text: string; type: string }>) {
  return history
    .map((message) => `${message.senderName}${message.type === "ai" ? " (bot)" : ""}: ${message.text}`)
    .join("\n");
}

function describeBotSkip(input: {
  botEnabled: boolean;
  hasApiKey: boolean;
  hasConversationId: boolean;
  playbackPassedDelay: boolean;
  enoughWords: boolean;
}) {
  const reasons: string[] = [];
  if (!input.botEnabled) reasons.push("bot disabled");
  if (!input.hasApiKey) reasons.push("missing bot API key");
  if (!input.hasConversationId) reasons.push("missing conversation ID");
  if (!input.playbackPassedDelay) reasons.push("activation delay not reached");
  if (!input.enoughWords) reasons.push("message must contain at least 4 words");
  return reasons.length > 0 ? reasons.join(", ") : "no skip reason";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      webinarId?: unknown;
      sessionId?: unknown;
      senderName?: unknown;
      text?: unknown;
      playbackSec?: unknown;
    };

    const webinarId = cleanText(body.webinarId, 120);
    const sessionId = cleanText(body.sessionId, 120);
    const senderName = cleanText(body.senderName, MAX_NAME_LENGTH) || "Guest";
    const text = cleanText(body.text, MAX_MESSAGE_LENGTH);
    const playbackSec = Math.max(
      0,
      Number.isFinite(Number(body.playbackSec)) ? Math.floor(Number(body.playbackSec)) : 600
    );

    if (!webinarId) {
      return NextResponse.json({ error: "webinarId is required" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "message text is required" }, { status: 400 });
    }

    console.log("[live-test-chat] message received", {
      webinarId,
      sessionId,
      senderName,
      playbackSec,
      textLength: text.length,
    });

    const webinarDoc = await adminDb.collection("webinars").doc(webinarId).get();
    if (!webinarDoc.exists) {
      return NextResponse.json({ error: "webinar not found" }, { status: 404 });
    }

    const webinarData = webinarDoc.data() ?? {};
    const sessionRef = adminDb.collection("sessions").doc(sessionId);
    const messageRef = sessionRef.collection("messages").doc();

    await sessionRef.set(
      {
        webinarId,
        timezoneGroupKey: "live-test",
        scheduledStartISO: new Date(Date.now() - playbackSec * 1000).toISOString(),
        status: "Test",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await messageRef.set({
      type: "user",
      text,
      senderName,
      webinarId,
      timezoneGroupKey: "live-test",
      playbackOffsetSec: playbackSec,
      createdAt: FieldValue.serverTimestamp(),
    });

    const botRaw =
      webinarData.bot && typeof webinarData.bot === "object"
        ? (webinarData.bot as Record<string, unknown>)
        : {};
    const botEnabled = Boolean(botRaw.enabled);
    const botName = cleanText(botRaw.name, MAX_NAME_LENGTH) || "AI Assistant";
    const botApiKey = cleanText(botRaw.apiKey, 256);
    const botConversationId = cleanText(botRaw.conversationId, 120);
    const botActivationDelaySec = Math.max(
      1,
      Number.isFinite(Number(botRaw.activationDelaySec))
        ? Math.floor(Number(botRaw.activationDelaySec))
        : 60
    );
    const enoughWords = countWords(text) >= MIN_WORDS_FOR_BOT;

    console.log("[live-test-chat] bot evaluation", {
      webinarId,
      sessionId,
      botEnabled,
      hasApiKey: Boolean(botApiKey),
      hasConversationId: Boolean(botConversationId),
      playbackSec,
      botActivationDelaySec,
      enoughWords,
    });

    let botResult:
      | {
          status: "skipped";
          skipReason: string;
        }
      | {
          status: "replied";
          botName: string;
          replyLength: number;
        }
      | {
          status: "failed";
          error: string;
        };

    if (
      botEnabled &&
      botApiKey &&
      botConversationId &&
      playbackSec >= botActivationDelaySec &&
      enoughWords
    ) {
      const history = await loadBotHistory(sessionId);
      const prompt = buildBotPrompt(history);
      console.log("[live-test-chat] sending bot request", {
        webinarId,
        sessionId,
        historyCount: history.length,
        preview: prompt.slice(0, 200),
      });

      const completion = await completeChatbotKitConversation({
        apiKey: botApiKey,
        conversationId: botConversationId,
        text: prompt,
      });

      const replyText = completion.text ? `${senderName}, ${completion.text}` : "";
      if (replyText) {
        await sessionRef.collection("messages").add({
          type: "ai",
          text: replyText,
          senderName: botName,
          webinarId,
          timezoneGroupKey: "live-test",
          playbackOffsetSec: playbackSec,
          createdAt: FieldValue.serverTimestamp(),
        });
        console.log("[live-test-chat] bot reply stored", {
          webinarId,
          sessionId,
          botName,
          replyLength: replyText.length,
        });
        botResult = {
          status: "replied",
          botName,
          replyLength: replyText.length,
        };
      } else {
        botResult = {
          status: "failed",
          error: "Chatbot returned an empty reply",
        };
      }
    } else {
      const skipReason = describeBotSkip({
        botEnabled,
        hasApiKey: Boolean(botApiKey),
        hasConversationId: Boolean(botConversationId),
        playbackPassedDelay: playbackSec >= botActivationDelaySec,
        enoughWords,
      });
      console.log("[live-test-chat] bot skipped", {
        webinarId,
        sessionId,
        skipReason,
        reason: {
          botEnabled,
          hasApiKey: Boolean(botApiKey),
          hasConversationId: Boolean(botConversationId),
          playbackPassedDelay: playbackSec >= botActivationDelaySec,
          enoughWords,
        },
      });
      botResult = {
        status: "skipped",
        skipReason,
      };
    }

    return NextResponse.json({ ok: true, bot: botResult });
  } catch (error) {
    console.error("[live-test-chat] failed", error);
    return NextResponse.json({ error: "failed to send message" }, { status: 500 });
  }
}
