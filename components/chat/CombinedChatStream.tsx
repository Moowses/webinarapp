"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type PredefinedMessage = {
  id: string;
  playbackOffsetSec: number;
  senderName: string;
  text: string;
};

type LiveMessage = {
  id: string;
  senderName: string;
  text: string;
  createdAtMs: number | null;
  type: "user" | "ai" | "system" | "predefined";
};

type Props = {
  accessToken: string;
  webinarId: string;
  sessionId: string;
  scheduledStartISO: string;
  playbackSec: number;
  initialDisplayName?: string;
  className?: string;
  title?: string;
  onRequestClose?: () => void;
  mobileOverlay?: boolean;
};

const PAGE_SIZE = 200;
const PREDEFINED_PRELOAD_SEC = 180;
const PREDEFINED_REFETCH_THRESHOLD_SEC = 30;

export default function CombinedChatStream({
  accessToken,
  webinarId,
  sessionId,
  scheduledStartISO,
  playbackSec,
  initialDisplayName,
  className,
  title,
  onRequestClose,
  mobileOverlay = false,
}: Props) {
  const [name, setName] = useState(initialDisplayName?.trim() || "Guest");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [predefinedMessages, setPredefinedMessages] = useState<PredefinedMessage[]>([]);
  const [cursor, setCursor] = useState<{ cursorSec: number; cursorId: string } | null>(null);
  const [hasMorePredefined, setHasMorePredefined] = useState(true);
  const [loadingPredefined, setLoadingPredefined] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const currentPlaybackSec = Math.max(0, Math.floor(playbackSec));
  const highestRequestedUptoSecRef = useRef(-1);

  const scheduledStartMs = useMemo(() => new Date(scheduledStartISO).getTime(), [scheduledStartISO]);
  const timelineNowMs = useMemo(
    () => scheduledStartMs + currentPlaybackSec * 1000,
    [currentPlaybackSec, scheduledStartMs]
  );
  const messagesRef = useMemo(() => collection(db, "sessions", sessionId, "messages"), [sessionId]);

  useEffect(() => {
    const suggested = initialDisplayName?.trim();
    if (suggested) setName(suggested);
  }, [initialDisplayName]);

  const loadPredefinedPage = useCallback(
    async (targetSec: number) => {
      if (loadingPredefined || !hasMorePredefined) return;
      const requestUptoSec = Math.max(0, Math.floor(targetSec + PREDEFINED_PRELOAD_SEC));
      if (cursor && requestUptoSec <= highestRequestedUptoSecRef.current) return;

      setLoadingPredefined(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("uptoSec", String(requestUptoSec));
        qs.set("pageSize", String(PAGE_SIZE));
        if (cursor) {
          qs.set("cursorSec", String(cursor.cursorSec));
          qs.set("cursorId", cursor.cursorId);
        }

        const res = await fetch(`/api/webinars/${webinarId}/predefined?${qs.toString()}`);
        const json = (await res.json()) as {
          messages?: PredefinedMessage[];
          hasMore?: boolean;
          nextCursor?: { cursorSec: number; cursorId: string } | null;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(json.error || "Failed to load predefined chat");
        }

        const incoming = json.messages ?? [];
        highestRequestedUptoSecRef.current = Math.max(highestRequestedUptoSecRef.current, requestUptoSec);
        setPredefinedMessages((prev) => {
          const byId = new Map<string, PredefinedMessage>();
          for (const row of prev) byId.set(row.id, row);
          for (const row of incoming) byId.set(row.id, row);
          return [...byId.values()].sort((a, b) => {
            if (a.playbackOffsetSec !== b.playbackOffsetSec) {
              return a.playbackOffsetSec - b.playbackOffsetSec;
            }
            return a.id.localeCompare(b.id);
          });
        });
        setHasMorePredefined(Boolean(json.hasMore));
        setCursor(json.nextCursor ?? null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load predefined chat");
      } finally {
        setLoadingPredefined(false);
      }
    },
    [cursor, hasMorePredefined, loadingPredefined, webinarId]
  );

  useEffect(() => {
    if (predefinedMessages.length > 0) return;
    void loadPredefinedPage(currentPlaybackSec);
  }, [currentPlaybackSec, loadPredefinedPage, predefinedMessages.length]);

  const maxLoadedPredefinedSec =
    predefinedMessages.length > 0
      ? predefinedMessages[predefinedMessages.length - 1].playbackOffsetSec
      : -1;

  useEffect(() => {
    if (loadingPredefined || !hasMorePredefined) return;
    if (currentPlaybackSec + PREDEFINED_REFETCH_THRESHOLD_SEC <= maxLoadedPredefinedSec) return;
    void loadPredefinedPage(currentPlaybackSec);
  }, [currentPlaybackSec, hasMorePredefined, loadPredefinedPage, loadingPredefined, maxLoadedPredefinedSec]);

  useEffect(() => {
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(300));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        const createdAt = (data.createdAt as Timestamp | undefined)?.toMillis?.() ?? null;
        return {
          id: doc.id,
          senderName: String(data.senderName ?? "Guest"),
          text: String(data.text ?? ""),
          createdAtMs: createdAt,
          type:
            data.type === "ai" || data.type === "system" || data.type === "predefined"
              ? data.type
              : "user",
        } satisfies LiveMessage;
      });
      setLiveMessages(rows);
    });

    return () => unsub();
  }, [messagesRef]);

  const mergedVisibleMessages = useMemo(() => {
    const predefined = predefinedMessages
      .filter((m) => m.playbackOffsetSec <= currentPlaybackSec)
      .map((m) => ({
        key: `p_${m.id}`,
        senderName: m.senderName,
        text: m.text,
        source: "predefined" as const,
        type: "predefined" as const,
        sortMs: scheduledStartMs + m.playbackOffsetSec * 1000,
      }));

    const live = liveMessages
      .map((m) => {
        const sortMs = Math.min(m.createdAtMs ?? timelineNowMs, timelineNowMs);
        return {
          key: `l_${m.id}`,
          senderName: m.senderName,
          text: m.text,
          source: "live" as const,
          type: m.type,
          sortMs,
        };
      })
      .filter((m) => m.sortMs <= timelineNowMs);

    return [...predefined, ...live].sort((a, b) => {
      if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
      if (a.source !== b.source) return a.source === "predefined" ? -1 : 1;
      return a.key.localeCompare(b.key);
    });
  }, [currentPlaybackSec, liveMessages, predefinedMessages, scheduledStartMs, timelineNowMs]);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, [mergedVisibleMessages.length]);

  async function send() {
    const clean = text.trim();
    if (!clean) return;
    setSending(true);
    setSendError(null);
    try {
      console.log("[live-chat] sending user message", {
        webinarId,
        sessionId,
        senderName: name.trim() || "Guest",
        playbackSec: currentPlaybackSec,
        text: clean,
      });
      const response = await fetch("/api/live/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: accessToken,
          sessionId,
          senderName: name.trim() || "Guest",
          text: clean,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      console.log("[live-chat] server response", {
        ok: response.ok,
        status: response.status,
        payload,
      });
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message");
      }
      setText("");
    } catch (error) {
      console.error("[live-chat] send failed", error);
      setSendError(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col ${
        mobileOverlay ? "bg-transparent text-white" : "bg-[#f3f4f6] text-slate-900"
      } ${className ?? ""}`}
    >
      <div
        className={
          mobileOverlay
            ? "rounded-t-3xl border-b border-white/10 bg-[rgba(9,14,28,0.58)] px-4 py-3 text-white backdrop-blur-xl"
            : "border-b border-slate-200 bg-white px-4 py-3"
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className={`text-sm font-semibold ${mobileOverlay ? "text-white" : "text-slate-900"}`}>
              {title ?? "Chat"}
            </div>
            <p className={`mt-0.5 text-xs ${mobileOverlay ? "text-white/70" : "text-slate-500"}`}>
              Messages to Everyone
            </p>
          </div>
          {onRequestClose ? (
            <button
              type="button"
              onClick={onRequestClose}
              className={`rounded px-2 py-0.5 text-xs lg:hidden ${
                mobileOverlay
                  ? "border border-white/20 bg-white/10 text-white"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              X
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
              mobileOverlay ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            Everyone
          </span>
          <span
            className={`rounded-full px-2.5 py-1 ${
              mobileOverlay ? "bg-white/12 text-white/75" : "bg-slate-100 text-slate-500"
            }`}
          >
            Viewing as {name}
          </span>
          <span className={`ml-auto ${mobileOverlay ? "text-white/60" : "text-slate-400"}`}>{currentPlaybackSec}s</span>
        </div>
      </div>

      <div
        ref={listRef}
        className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 ${
          mobileOverlay ? "bg-[linear-gradient(180deg,rgba(9,14,28,0.18),rgba(9,14,28,0.62))]" : ""
        }`}
      >
        {mergedVisibleMessages.map((m) => (
          <div
            key={m.key}
            className={`rounded-xl px-3 py-2.5 ${
              mobileOverlay
                ? "bg-[rgba(15,23,42,0.55)] shadow-[0_8px_24px_rgba(2,6,23,0.25)] backdrop-blur-sm"
                : "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
            }`}
          >
            <div className="flex items-baseline gap-2 text-[13px] leading-5">
              <span
                className={
                  m.type === "ai"
                    ? "font-semibold text-[#0e72ed]"
                    : m.type === "system"
                    ? mobileOverlay
                      ? "font-semibold text-white/65"
                      : "font-semibold text-slate-500"
                    : mobileOverlay
                    ? "font-semibold text-white"
                    : "font-semibold text-slate-900"
                }
              >
                {m.senderName}
              </span>
              <span className={`text-[11px] ${mobileOverlay ? "text-white/45" : "text-slate-400"}`}>
                {timeFormatter.format(new Date(m.sortMs))}
              </span>
            </div>
            <span
              className={`block text-[13px] leading-5 ${
                m.type === "system"
                  ? mobileOverlay
                    ? "text-white/65"
                    : "text-slate-500"
                  : mobileOverlay
                  ? "text-white"
                  : "text-slate-900"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {mergedVisibleMessages.length === 0 ? (
          <div className={`text-sm ${mobileOverlay ? "text-white/65" : "text-slate-500"}`}>No messages yet.</div>
        ) : null}
      </div>

      <div
        className={`p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3 ${
          mobileOverlay
            ? "border-t border-white/10 bg-[rgba(9,14,28,0.72)] backdrop-blur-xl"
            : "sticky bottom-0 border-t border-slate-200 bg-white"
        }`}
      >
        <div className={`mb-2 text-[11px] ${mobileOverlay ? "text-white/65" : "text-slate-500"}`}>
          Send to: <span className={`font-medium ${mobileOverlay ? "text-white" : "text-slate-700"}`}>Everyone</span>
        </div>
        <div className="flex gap-2">
          <input
            className={`flex-1 rounded-xl px-3 py-2 text-sm ${
              mobileOverlay
                ? "border border-white/15 bg-white/10 text-white placeholder:text-white/45"
                : "border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            }`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message here..."
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            className="rounded-xl bg-[#0e72ed] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={sending}
            onClick={send}
          >
            Send
          </button>
        </div>
        {sendError ? <p className="mt-2 text-xs text-red-600">{sendError}</p> : null}
        {loadError ? <p className="mt-2 text-xs text-red-600">{loadError}</p> : null}
      </div>
    </div>
  );
}
