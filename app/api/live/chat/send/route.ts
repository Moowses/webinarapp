import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/services/firebase-admin";
import { completeChatbotKitConversation } from "@/lib/services/chatbotkit";
import { hashToken } from "@/lib/utils/tokens";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 40;
const MIN_MESSAGE_INTERVAL_MS = 3000;
const MIN_WORDS_FOR_BOT = 4;
const BOT_HISTORY_LIMIT = 20;

function cleanText(value: unknown, maxLength: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildSessionId(input: {
  webinarId: string;
  timezoneGroupKey: string;
  scheduledStartISO: string;
}): string {
  const sessionKey = `${input.webinarId}__${input.timezoneGroupKey}__${input.scheduledStartISO}`;
  return hashToken(sessionKey).slice(0, 40);
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
      token?: unknown;
      sessionId?: unknown;
      senderName?: unknown;
      text?: unknown;
    };

    const token = cleanText(body.token, 256);
    const sessionId = cleanText(body.sessionId, 80);
    const senderName = cleanText(body.senderName, MAX_NAME_LENGTH) || "Guest";
    const text = cleanText(body.text, MAX_MESSAGE_LENGTH);

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "message text is required" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const registrationSnap = await adminDb
      .collection("registrations")
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get();

    if (registrationSnap.empty) {
      return NextResponse.json({ error: "invalid access token" }, { status: 403 });
    }

    const registrationDoc = registrationSnap.docs[0];
    const registration = registrationDoc.data();
    const webinarId = String(registration.webinarId ?? "").trim();
    const timezoneGroupKey = String(registration.timezoneGroupKey ?? "").trim();
    const scheduledStartISO = String(registration.scheduledStartISO ?? "").trim();
    const scheduledEndISO = String(
      registration.liveWindowEndISO ?? registration.scheduledEndISO ?? ""
    ).trim();

    if (!webinarId || !timezoneGroupKey || !scheduledStartISO || !scheduledEndISO) {
      return NextResponse.json({ error: "registration is incomplete" }, { status: 400 });
    }

    const expectedSessionId = buildSessionId({
      webinarId,
      timezoneGroupKey,
      scheduledStartISO,
    });
    if (expectedSessionId !== sessionId) {
      return NextResponse.json({ error: "session mismatch" }, { status: 403 });
    }

    const nowMs = Date.now();
    const startMs = Date.parse(scheduledStartISO);
    const endMs = Date.parse(scheduledEndISO);
    console.log("[live-chat] message received", {
      sessionId,
      registrationId: registrationDoc.id,
      webinarId,
      timezoneGroupKey,
      senderName,
      textLength: text.length,
    });
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return NextResponse.json({ error: "registration schedule is invalid" }, { status: 400 });
    }
    if (nowMs < startMs) {
      return NextResponse.json({ error: "chat is not open yet" }, { status: 403 });
    }
    if (nowMs > endMs) {
      return NextResponse.json({ error: "chat access has expired" }, { status: 403 });
    }

    const sessionRef = adminDb.collection("sessions").doc(sessionId);
    const messageRef = sessionRef.collection("messages").doc();
    const registrationRef = registrationDoc.ref;

    await adminDb.runTransaction(async (tx) => {
      const [sessionDoc, latestRegistrationDoc] = await Promise.all([
        tx.get(sessionRef),
        tx.get(registrationRef),
      ]);

      if (!sessionDoc.exists) {
        throw new Error("session not found");
      }

      const session = sessionDoc.data() ?? {};
      if (
        String(session.webinarId ?? "") !== webinarId ||
        String(session.timezoneGroupKey ?? "") !== timezoneGroupKey ||
        String(session.scheduledStartISO ?? "") !== scheduledStartISO
      ) {
        throw new Error("session validation failed");
      }

      const latestRegistration = latestRegistrationDoc.data() ?? {};
      const lastMessageAtMs = toMillis(latestRegistration.lastChatMessageAt);
      if (lastMessageAtMs !== null && nowMs - lastMessageAtMs < MIN_MESSAGE_INTERVAL_MS) {
        throw new Error("rate_limited");
      }

      tx.set(messageRef, {
        type: "user",
        text,
        senderName,
        registrationId: registrationDoc.id,
        webinarId,
        timezoneGroupKey,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(registrationRef, {
        lastChatMessageAt: new Date(nowMs).toISOString(),
      });
    });

    const playbackSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const webinarDoc = await adminDb.collection("webinars").doc(webinarId).get();
    const webinarData = webinarDoc.data() ?? {};
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

    console.log("[live-chat] bot evaluation", {
      sessionId,
      webinarId,
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
      try {
        const history = await loadBotHistory(sessionId);
        const prompt = buildBotPrompt(history);
        console.log("[live-chat] sending bot request", {
          sessionId,
          webinarId,
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
            timezoneGroupKey,
            createdAt: FieldValue.serverTimestamp(),
          });
          console.log("[live-chat] bot reply stored", {
            sessionId,
            webinarId,
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
      } catch (botError) {
        const errorMessage = botError instanceof Error ? botError.message : "Unknown bot error";
        console.error("Chat bot reply failed", {
          webinarId,
          sessionId,
          registrationId: registrationDoc.id,
          botName,
          error: botError,
        });
        botResult = {
          status: "failed",
          error: errorMessage,
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
      console.log("[live-chat] bot skipped", {
        sessionId,
        webinarId,
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
    if (error instanceof Error) {
      if (error.message === "rate_limited") {
        return NextResponse.json(
          { error: "You're sending messages too quickly. Please wait a moment." },
          { status: 429 }
        );
      }
      if (error.message === "session not found" || error.message === "session validation failed") {
        return NextResponse.json({ error: "chat session is invalid" }, { status: 403 });
      }
    }

    return NextResponse.json({ error: "failed to send message" }, { status: 500 });
  }
}
