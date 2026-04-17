"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import type {
  ActiveLiveSessionRow,
  ActiveLiveViewerRow,
} from "@/app/actions/admin-registration-actions";
import { db } from "@/lib/firebase/client";

type Props = {
  sessions: ActiveLiveSessionRow[];
  viewers: ActiveLiveViewerRow[];
};

type SessionMessage = {
  id: string;
  senderName: string;
  text: string;
  type: "user" | "ai" | "system" | "predefined";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatClock(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function sendAdminSessionMessage(input: {
  webinarId: string;
  sessionId: string;
  timezoneGroupKey: string;
  senderName: string;
  text: string;
}) {
  const response = await fetch("/api/admin/live-chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Failed to send message");
  }
}

export default function AdminLiveMonitor({ sessions, viewers }: Props) {
  const [liveSessions, setLiveSessions] = useState(sessions);
  const [liveViewers, setLiveViewers] = useState(viewers);
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.sessionId ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setLiveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    setLiveViewers(viewers);
  }, [viewers]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/live-overview", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          sessions?: ActiveLiveSessionRow[];
          viewers?: ActiveLiveViewerRow[];
        };
        if (!response.ok || cancelled) return;
        setLiveSessions(payload.sessions ?? []);
        setLiveViewers(payload.viewers ?? []);
      } catch {
        // Keep the last successful snapshot in the UI.
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const effectiveSelectedSessionId = useMemo(() => {
    if (liveSessions.some((row) => row.sessionId === selectedSessionId)) {
      return selectedSessionId;
    }
    return liveSessions[0]?.sessionId ?? "";
  }, [liveSessions, selectedSessionId]);
  const selectedSession = useMemo(
    () =>
      liveSessions.find((row) => row.sessionId === effectiveSelectedSessionId) ??
      liveSessions[0] ??
      null,
    [effectiveSelectedSessionId, liveSessions]
  );

  if (!selectedSession) {
    return (
      <section className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1F2A37]">Live Monitor</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          No webinar sessions with live attendees are active right now.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Live Monitor</p>
          <h2 className="text-2xl font-semibold text-[#1F2A37]">Active Webinar Sessions</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Click a live session card here to monitor the video, viewers, and chat.
          </p>
        </div>
        <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">
          {liveSessions.length} live
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liveSessions.map((session) => {
            const active = session.sessionId === selectedSession.sessionId;
            return (
              <div
                key={session.sessionId}
                className={`rounded-2xl border p-4 transition ${
                  active
                    ? "border-[#B9D7EF] bg-[#E8F5FF]"
                    : "border-[#E6EDF3] bg-[#F8FBFF] hover:border-[#B9D7EF] hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(session.sessionId);
                    setIsModalOpen(true);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#1F2A37]">{session.webinarTitle}</div>
                      <div className="mt-1 text-xs text-[#6B7280]">{session.timezoneGroupKey}</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#2F6FA3] shadow-sm">
                      {session.attendeeCount} viewers
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-[#6B7280]">
                    Start {formatClock(session.scheduledStartISO)}
                  </div>
                  <div className="mt-2 text-xs font-medium text-[#2F6FA3]">Click here to monitor</div>
                </button>
                <SessionQuickReply
                  session={session}
                  onOpenMonitor={() => {
                    setSelectedSessionId(session.sessionId);
                    setIsModalOpen(true);
                  }}
                />
              </div>
            );
          })}
      </div>

      {isModalOpen ? (
        <MonitorModal
          session={selectedSession}
          viewers={liveViewers.filter((viewer) => viewer.sessionId === selectedSession.sessionId)}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

function SessionQuickReply({
  session,
  onOpenMonitor,
}: {
  session: ActiveLiveSessionRow;
  onOpenMonitor: () => void;
}) {
  const [name, setName] = useState("Host");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function sendReply() {
    const senderName = name.trim();
    const message = text.trim();

    if (!senderName) {
      setStatus("Sender name is required.");
      return;
    }
    if (!message) {
      setStatus("Reply text is required.");
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      await sendAdminSessionMessage({
        webinarId: session.webinarId,
        sessionId: session.sessionId,
        timezoneGroupKey: session.timezoneGroupKey,
        senderName,
        text: message,
      });
      setText("");
      setStatus("Reply sent to this session.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#D8E7F4] bg-white/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F6FA3]">
          Session Reply
        </div>
        <button
          type="button"
          onClick={onOpenMonitor}
          className="text-xs font-medium text-[#2F6FA3] hover:text-[#24577f]"
        >
          Open monitor
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Host"
          className="rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
        />
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Reply to this live session..."
            className="flex-1 rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void sendReply();
              }
            }}
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => void sendReply()}
            className="rounded-xl bg-[#2F6FA3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3E82BD] disabled:opacity-50"
          >
            {sending ? "Sending..." : "Reply"}
          </button>
        </div>
      </div>
      {status ? <p className="mt-2 text-xs text-[#6B7280]">{status}</p> : null}
    </div>
  );
}

function MonitorModal({
  session,
  viewers,
  onClose,
}: {
  session: ActiveLiveSessionRow;
  viewers: ActiveLiveViewerRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[#1F2A37]/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] max-w-7xl flex-col overflow-hidden rounded-3xl border border-[#E6EDF3] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#E6EDF3] px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Live Session</div>
            <div className="mt-1 text-xl font-semibold text-[#1F2A37]">{session.webinarTitle}</div>
            <div className="mt-1 text-sm text-[#6B7280]">{session.timezoneGroupKey}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-2 text-sm font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
          <MonitorStage session={session} viewers={viewers} />
        </div>
      </div>
    </div>
  );
}

function MonitorStage({
  session,
  viewers,
}: {
  session: ActiveLiveSessionRow;
  viewers: ActiveLiveViewerRow[];
}) {
  const [playbackSec, setPlaybackSec] = useState(0);
  const [videoStatus, setVideoStatus] = useState<{
    sourceKey: string;
    ready: boolean;
    error: string | null;
    stalled: boolean;
  }>({
    sourceKey: "",
    ready: false,
    error: null,
    stalled: false,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loadTimerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const sourceKey = `${session.sessionId}:${session.videoPublicPath}`;
  const videoReady = videoStatus.sourceKey === sourceKey && videoStatus.ready;
  const videoError = videoStatus.sourceKey === sourceKey ? videoStatus.error : null;
  const videoStalled = videoStatus.sourceKey === sourceKey && videoStatus.stalled;

  useEffect(() => {
    const tick = () => {
      const startMs = Date.parse(session.scheduledStartISO);
      const next = clamp(Math.floor((Date.now() - startMs) / 1000), 0, session.durationSec);
      setPlaybackSec(next);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session.durationSec, session.scheduledStartISO, session.sessionId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      if (!videoReady || videoError) return;
      const target = clamp(playbackSec, 0, Math.max(0, session.durationSec - 1));
      syncingRef.current = true;
      if (Math.abs(video.currentTime - target) > 1.5) {
        video.currentTime = target;
      }
      void video.play().catch(() => {});
      window.setTimeout(() => {
        syncingRef.current = false;
      }, 0);
    };

    sync();
  }, [playbackSec, session.durationSec, session.sessionId, videoError, videoReady]);

  useEffect(() => {
    return () => {
      if (loadTimerRef.current !== null) {
        window.clearTimeout(loadTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="grid min-h-0 gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white">
        <div className="flex items-center gap-2 border-b border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-xs text-[#6B7280]">
          <span className="rounded-full bg-[#F58220] px-2 py-0.5 font-semibold uppercase tracking-[0.18em] text-white">
            Live
          </span>
          <span>{session.webinarTitle}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[#2F6FA3] shadow-sm">{session.timezoneGroupKey}</span>
          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[#2F6FA3] shadow-sm">{session.attendeeCount} viewers</span>
        </div>
        <div className="relative min-h-0 flex-1 bg-[#F8FBFF]">
          <video
            key={sourceKey}
            ref={videoRef}
            className="h-full w-full bg-[#F8FBFF] object-contain"
            src={session.videoPublicPath}
            autoPlay
            playsInline
            muted
            preload="metadata"
            controls={false}
            onLoadStart={() => {
              if (loadTimerRef.current !== null) {
                window.clearTimeout(loadTimerRef.current);
              }
              setVideoStatus({
                sourceKey,
                ready: false,
                error: null,
                stalled: false,
              });
              loadTimerRef.current = window.setTimeout(() => {
                setVideoStatus((current) =>
                  current.sourceKey !== sourceKey || current.ready || current.error
                    ? current
                    : { ...current, stalled: true }
                );
              }, 4000);
            }}
            onLoadedMetadata={() => {
              if (loadTimerRef.current !== null) {
                window.clearTimeout(loadTimerRef.current);
              }
              setVideoStatus({
                sourceKey,
                ready: true,
                error: null,
                stalled: false,
              });
            }}
            onLoadedData={() => {
              if (loadTimerRef.current !== null) {
                window.clearTimeout(loadTimerRef.current);
              }
              setVideoStatus({
                sourceKey,
                ready: true,
                error: null,
                stalled: false,
              });
            }}
            onCanPlay={() => {
              if (loadTimerRef.current !== null) {
                window.clearTimeout(loadTimerRef.current);
              }
              setVideoStatus({
                sourceKey,
                ready: true,
                error: null,
                stalled: false,
              });
            }}
            onPause={(event) => {
              if (event.currentTarget.ended) return;
              void event.currentTarget.play().catch(() => {});
            }}
            onSeeking={(event) => {
              if (syncingRef.current) return;
              const target = clamp(playbackSec, 0, Math.max(0, session.durationSec - 1));
              if (Math.abs(event.currentTarget.currentTime - target) > 0.5) {
                event.currentTarget.currentTime = target;
              }
            }}
            onError={() => {
              if (loadTimerRef.current !== null) {
                window.clearTimeout(loadTimerRef.current);
              }
              setVideoStatus({
                sourceKey,
                ready: false,
                error: session.videoPublicPath
                  ? "Video failed to load."
                  : "No video is configured for this webinar.",
                stalled: false,
              });
            }}
            disablePictureInPicture
          />
          {!session.videoPublicPath ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-[#FFD7B3] bg-[#FFE7D1] px-5 py-4 text-sm text-[#F58220] shadow-sm">
                No video is configured for this webinar yet.
              </div>
            </div>
          ) : null}
          {videoError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-[#FFD7B3] bg-[#FFE7D1] px-5 py-4 text-sm text-[#F58220] shadow-sm">
                {videoError}
                <div className="mt-2 break-all font-mono text-xs text-[#1F2A37]">
                  {session.videoPublicPath}
                </div>
              </div>
            </div>
          ) : null}
          {!videoError && session.videoPublicPath && !videoReady && !videoStalled ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-[#E6EDF3] bg-white px-5 py-4 text-sm text-[#6B7280] shadow-sm">
                Loading live video...
              </div>
            </div>
          ) : null}
          {!videoError && session.videoPublicPath && !videoReady && videoStalled ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-[#FFD7B3] bg-[#FFE7D1] px-5 py-4 text-sm text-[#F58220] shadow-sm">
                Video is taking longer than expected to load.
                <div className="mt-2 break-all font-mono text-xs text-[#1F2A37]">
                  {session.videoPublicPath}
                </div>
              </div>
            </div>
          ) : null}
          <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-[#1F2A37]/70 px-3 py-1 text-xs text-white">
            Playback {playbackSec}s
          </div>
        </div>
      </div>

      <div className="grid min-h-0 gap-4 lg:h-full lg:grid-rows-[240px_minmax(0,1fr)] xl:grid-rows-[280px_minmax(0,1fr)]">
        <AdminViewerList viewers={viewers} />
        <AdminSessionChat session={session} />
      </div>
    </div>
  );
}

function AdminViewerList({ viewers }: { viewers: ActiveLiveViewerRow[] }) {
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function kickViewer(registrationId: string, fullName: string) {
    setKickingId(registrationId);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/live-viewers/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to kick viewer");
      }
      setStatus(`${fullName} removed from live session.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to kick viewer");
    } finally {
      setKickingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
      <div className="border-b border-[#E6EDF3] px-4 py-3">
        <div className="text-sm font-semibold text-[#1F2A37]">Active Viewers</div>
        <p className="mt-1 text-xs text-[#6B7280]">Currently watching this timezone live session.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] px-4 py-4">
        {viewers.map((viewer) => (
          <div key={viewer.registrationId} className="rounded-xl border border-[#E6EDF3] bg-white px-3 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#1F2A37]">{viewer.fullName}</div>
                <div className="text-xs text-[#6B7280]">{viewer.email || "No email"}</div>
              </div>
              <button
                type="button"
                onClick={() => kickViewer(viewer.registrationId, viewer.fullName)}
                disabled={kickingId === viewer.registrationId}
                className="rounded-lg border border-[#F58220] bg-[#FFE7D1] px-3 py-1.5 text-xs font-semibold text-[#F58220] disabled:opacity-50"
              >
                {kickingId === viewer.registrationId ? "Removing..." : "Kick"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#6B7280]">
              <span className="rounded-full bg-[#F8FBFF] px-2 py-1">
                Watched {viewer.watchedMinutes} min
              </span>
              <span className="rounded-full bg-[#F8FBFF] px-2 py-1">
                Last seen {formatClock(viewer.lastSeenAtISO)}
              </span>
            </div>
          </div>
        ))}
        {viewers.length === 0 ? <div className="text-sm text-[#6B7280]">No active viewers.</div> : null}
      </div>
      {status ? <div className="border-t border-[#E6EDF3] px-4 py-2 text-xs text-[#6B7280]">{status}</div> : null}
    </div>
  );
}

function AdminSessionChat({ session }: { session: ActiveLiveSessionRow }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "sessions", session.sessionId, "messages"),
      orderBy("createdAt", "asc"),
      limit(300)
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          senderName: String(data.senderName ?? "Guest"),
          text: String(data.text ?? ""),
          type:
            data.type === "ai" || data.type === "system" || data.type === "predefined"
              ? data.type
              : "user",
        } satisfies SessionMessage;
      });
      setMessages(rows);
    });

    return () => unsub();
  }, [session.sessionId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, [messages.length]);

  async function send() {
    let cleanName = name.trim();
    const cleanText = text.trim();
    if (!cleanName) {
      const promptedName = window.prompt("Enter the host name before sending a message:", "Host");
      cleanName = promptedName?.trim() ?? "";
      if (!cleanName) {
        setSendError("Host name is required before sending a message.");
        return;
      }
      setName(cleanName);
    }
    if (!cleanText) {
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      await sendAdminSessionMessage({
          webinarId: session.webinarId,
          sessionId: session.sessionId,
          timezoneGroupKey: session.timezoneGroupKey,
          senderName: cleanName,
          text: cleanText,
      });
      setText("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
      <div className="border-b border-[#E6EDF3] px-4 py-3">
        <div className="text-sm font-semibold text-[#1F2A37]">Admin Chat Monitor</div>
        <p className="mt-1 text-xs text-[#6B7280]">Chat into this live timezone session using any sender name.</p>
      </div>
      <div className="border-b border-[#E6EDF3] px-4 py-3">
        <label className="block text-xs text-[#6B7280]">
          Sender name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Host"
            className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
          />
        </label>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] px-4 py-4">
        {messages.map((message) => (
          <div key={message.id} className="rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 shadow-sm">
            <div className="text-sm font-semibold text-[#1F2A37]">{message.senderName}</div>
            <div className={message.type === "system" ? "text-sm text-[#6B7280]" : "text-sm text-[#1F2A37]"}>
              {message.text}
            </div>
          </div>
        ))}
        {messages.length === 0 ? <div className="text-sm text-[#6B7280]">No chat yet.</div> : null}
      </div>
      <div className="border-t border-[#E6EDF3] px-4 py-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
          />
          <button
            type="button"
            disabled={sending}
            onClick={send}
            className="rounded-xl bg-[#2F6FA3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3E82BD] disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {sendError ? <p className="mt-2 text-xs text-[#F58220]">{sendError}</p> : null}
      </div>
    </div>
  );
}
