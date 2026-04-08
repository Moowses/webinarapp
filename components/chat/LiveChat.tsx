"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  type DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type ChatMessage = {
  id: string;
  type: "user" | "ai" | "system" | "predefined";
  text: string;
  senderName: string;
};

export default function LiveChat({
  sessionId,
  initialDisplayName,
  webinarId,
  playbackSec = 600,
}: {
  sessionId: string;
  initialDisplayName?: string;
  webinarId: string;
  playbackSec?: number;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState(initialDisplayName?.trim() || "Guest");
  const [hasEditedName, setHasEditedName] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  const messagesRef = useMemo(
    () => collection(db, "sessions", sessionId, "messages"),
    [sessionId]
  );

  useEffect(() => {
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as DocumentData;
        return {
          id: d.id,
          type: data.type,
          text: data.text,
          senderName: data.senderName,
        } satisfies ChatMessage;
      });

      setMessages(rows);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    });

    return () => unsub();
  }, [messagesRef]);

  useEffect(() => {
    if (hasEditedName) return;
    const suggested = initialDisplayName?.trim();
    if (suggested) setName(suggested);
  }, [hasEditedName, initialDisplayName]);

  async function send() {
    const clean = text.trim();
    if (!clean) return;

    setSending(true);
    setSendError(null);
    try {
      console.log("[live-test-chat] sending user message", {
        webinarId,
        sessionId,
        senderName: name.trim() || "Guest",
        playbackSec,
        text: clean,
      });
      const response = await fetch("/api/live-test/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webinarId,
          sessionId,
          senderName: name.trim() || "Guest",
          playbackSec,
          text: clean,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      console.log("[live-test-chat] server response", {
        ok: response.ok,
        status: response.status,
        payload,
      });
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message");
      }
      setText("");
    } catch (error) {
      console.error("[live-test-chat] send failed", error);
      setSendError(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="text-sm font-semibold">Live Chat</div>
        <div className="mt-2 flex gap-2">
          <input
            className="w-40 rounded-xl border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => {
              setHasEditedName(true);
              setName(e.target.value);
            }}
            placeholder="Your name"
          />
          <div className="self-center text-xs text-slate-500">
            Session: <span className="font-mono">{sessionId}</span>
          </div>
          <div className="self-center text-xs text-slate-500">
            Webinar: <span className="font-mono">{webinarId}</span>
          </div>
        </div>
      </div>

      <div ref={listRef} className="h-80 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-semibold">{m.senderName}</span>{" "}
            <span className="text-slate-700">{m.text}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-sm text-slate-500">No messages yet.</div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={sending}
            onClick={send}
          >
            Send
          </button>
        </div>
        {sendError ? <p className="mt-2 text-xs text-red-600">{sendError}</p> : null}
      </div>
    </div>
  );
}
