"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type PredefinedMessage = {
  id: string;
  playbackOffsetSec: number;
  senderName: string;
  text: string;
  orderKey: string;
};

type Props = {
  webinarId: string;
  playbackSec: number;
  mode?: "predefined-only" | "merged";
};

const PAGE_SIZE = 200;

export default function PredefinedChatStream({ webinarId, playbackSec }: Props) {
  const [messages, setMessages] = useState<PredefinedMessage[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlaybackSec, setCurrentPlaybackSec] = useState(playbackSec);

  const startedAtMsRef = useRef(Date.now());
  const listRef = useRef<HTMLDivElement | null>(null);

  const collectionRef = useMemo(
    () => collection(db, "webinars", webinarId, "predefinedMessages"),
    [webinarId]
  );

  useEffect(() => {
    startedAtMsRef.current = Date.now();
    setCurrentPlaybackSec(playbackSec);
  }, [playbackSec]);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAtMsRef.current) / 1000);
      setCurrentPlaybackSec(playbackSec + elapsedSec);
    }, 1000);
    return () => clearInterval(timer);
  }, [playbackSec]);

  const loadNextPage = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);

    try {
      const q = lastDoc
        ? query(
            collectionRef,
            orderBy("playbackOffsetSec", "asc"),
            orderBy("orderKey", "asc"),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
          )
        : query(
            collectionRef,
            orderBy("playbackOffsetSec", "asc"),
            orderBy("orderKey", "asc"),
            limit(PAGE_SIZE)
          );

      const snap = await getDocs(q);
      const page = snap.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          playbackOffsetSec: Number(data.playbackOffsetSec ?? 0),
          senderName: String(data.senderName ?? "Host"),
          text: String(data.text ?? ""),
          orderKey: String(data.orderKey ?? ""),
        } satisfies PredefinedMessage;
      });

      setMessages((prev) => [...prev, ...page]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.size === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load predefined chat.");
    } finally {
      setLoading(false);
    }
  }, [collectionRef, hasMore, lastDoc, loading]);

  useEffect(() => {
    if (messages.length > 0) return;
    void loadNextPage();
  }, [loadNextPage, messages.length]);

  const highestLoadedOffset =
    messages.length > 0 ? messages[messages.length - 1].playbackOffsetSec : -1;

  useEffect(() => {
    if (!hasMore || loading) return;
    if (currentPlaybackSec <= highestLoadedOffset) return;
    void loadNextPage();
  }, [currentPlaybackSec, hasMore, highestLoadedOffset, loading, loadNextPage]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.playbackOffsetSec <= currentPlaybackSec),
    [messages, currentPlaybackSec]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, [visibleMessages.length]);

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Replay Chat</h2>
        <span className="text-xs text-slate-500">
          Playback: <span className="font-mono">{currentPlaybackSec}s</span>
        </span>
      </div>

      <div ref={listRef} className="mt-3 h-64 space-y-2 overflow-y-auto rounded border bg-slate-50 p-3">
        {visibleMessages.map((message) => (
          <div key={message.id} className="text-sm">
            <span className="font-semibold">{message.senderName}</span>{" "}
            <span className="text-slate-700">{message.text}</span>
          </div>
        ))}
        {visibleMessages.length === 0 ? (
          <p className="text-sm text-slate-500">No predefined messages yet for this playback time.</p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={loading || !hasMore}
          onClick={() => void loadNextPage()}
          className="rounded border px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {loading ? "Loading..." : hasMore ? "Load more" : "All loaded"}
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </section>
  );
}
