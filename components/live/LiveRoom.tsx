"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CombinedChatStream from "@/components/chat/CombinedChatStream";
import JoinAudioModal from "@/components/live/JoinAudioModal";
import ZoomBottomBar from "@/components/live/ZoomBottomBar";

type Props = {
  accessToken: string;
  webinarId: string;
  sessionId: string;
  webinarTitle: string;
  videoPublicPath: string;
  webinarSlug: string;
  timezoneGroupKey: string;
  scheduledStartISO: string;
  initialPlaybackSec: number;
  durationSec: number;
  displayName: string;
  initialAccessRevoked?: boolean;
  revokedRedirectUrl?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function readAutoJoinSetting(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("webinar_auto_join_audio") === "true";
}

function shouldDefaultChatOpen(): boolean {
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(max-width: 767px), ((max-height: 500px) and (pointer: coarse))").matches;
}

export default function LiveRoom({
  accessToken,
  webinarId,
  sessionId,
  webinarTitle,
  videoPublicPath,
  webinarSlug,
  timezoneGroupKey,
  scheduledStartISO,
  initialPlaybackSec,
  durationSec,
  displayName,
  initialAccessRevoked = false,
  revokedRedirectUrl = "https://www.google.com",
}: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasInitializedRef = useRef(false);

  const [isAudioJoined, setIsAudioJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(() => shouldDefaultChatOpen());
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(() => readAutoJoinSetting());
  const [joinModalOpen, setJoinModalOpen] = useState(() => !readAutoJoinSetting());
  const [playbackSec, setPlaybackSec] = useState(clamp(initialPlaybackSec, 0, durationSec));
  const [accessRevoked, setAccessRevoked] = useState(initialAccessRevoked);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px), ((max-height: 500px) and (pointer: coarse))");
    const syncViewport = () => setIsMobileViewport(media.matches);

    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!accessRevoked || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      window.location.href = revokedRedirectUrl;
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [accessRevoked, revokedRedirectUrl]);

  const viewerCount = useMemo(() => {
    const seed = hashSeed(`${sessionId}:${webinarId}:${scheduledStartISO}`);
    return 30 + (seed % 91);
  }, [scheduledStartISO, sessionId, webinarId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const body = JSON.stringify({ token: accessToken });

    const heartbeat = () => {
      void fetch("/api/live/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
        .then(async (response) => {
          if (response.status === 403) {
            setAccessRevoked(true);
          }
        })
        .catch(() => {});
    };

    const leave = () => {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/live/leave", blob);
        return;
      }

      void fetch("/api/live/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        heartbeat();
      } else {
        leave();
      }
    };

    heartbeat();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    }, 20_000);

    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      leave();
    };
  }, [accessToken, router, webinarSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("webinar_auto_join_audio", autoJoinEnabled ? "true" : "false");
  }, [autoJoinEnabled]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncToLiveOffset = () => {
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;
      video.currentTime = clamp(initialPlaybackSec, 0, Math.max(0, durationSec - 1));
      void video.play().catch(() => {});
    };

    const onTimeUpdate = () => {
      setPlaybackSec(clamp(Math.floor(video.currentTime), 0, durationSec));
    };

    const onPause = () => {
      if (!video.ended) {
        void video.play().catch(() => {});
      }
    };

    video.muted = isMuted;
    video.addEventListener("loadedmetadata", syncToLiveOffset);
    video.addEventListener("canplay", syncToLiveOffset);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("loadedmetadata", syncToLiveOffset);
      video.removeEventListener("canplay", syncToLiveOffset);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
    };
  }, [durationSec, initialPlaybackSec, isMuted]);

  function joinWithComputerAudio() {
    setIsAudioJoined(true);
    setIsMuted(false);
    setJoinModalOpen(false);
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      void video.play().catch(() => {});
    }
  }

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    const video = videoRef.current;
    if (!video) return;
    if (!isAudioJoined && !next) {
      setIsAudioJoined(true);
    }
    video.muted = next;
  }

  const elapsedLabel = useMemo(() => {
    const min = Math.floor(playbackSec / 60);
    const sec = playbackSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }, [playbackSec]);

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#0b0f19] text-slate-100 md:h-screen">
      {accessRevoked ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-[#121826] p-6 text-center shadow-2xl">
            <div className="text-lg font-semibold text-white">You have been removed</div>
            <p className="mt-2 text-sm text-slate-300">
              An admin has kicked you out of this live webinar session.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Redirecting you now...
            </p>
          </div>
        </div>
      ) : null}

      <JoinAudioModal
        open={joinModalOpen}
        onJoinAudio={joinWithComputerAudio}
        autoJoinEnabled={autoJoinEnabled}
        setAutoJoinEnabled={setAutoJoinEnabled}
      />

      <div className="relative flex h-full min-h-0 flex-col md:flex-row">
        <section
          className={`relative min-h-0 bg-[#111827] ${
            isMobileViewport ? (isChatOpen ? "basis-[50dvh] pb-0" : "flex-1 pb-16") : "flex-1 pb-16"
          }`}
        >
          <video
            ref={videoRef}
            className="h-full w-full bg-black object-contain"
            src={videoPublicPath}
            autoPlay
            playsInline
            muted={isMuted}
            controls={false}
            disablePictureInPicture
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-black/70 px-3 py-2 text-xs font-semibold backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                LIVE
              </span>
              <span className="rounded-full bg-black/50 px-2 py-0.5 text-[11px]">
                {elapsedLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px]">
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-current text-slate-200">
                  <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 7a5 5 0 0 1 10 0H4Zm11-7a2.5 2.5 0 1 0-1.32-4.62 4.5 4.5 0 0 1 0 4.24A2.49 2.49 0 0 0 15 10Zm-1.1 2.2a6.96 6.96 0 0 1 2.1 4.8H19a4 4 0 0 0-5.1-3.8Z" />
                </svg>
                {viewerCount}
              </span>
              <span className="hidden rounded-full bg-black/50 px-2 py-0.5 text-[11px] sm:inline">
                {webinarTitle}
              </span>
            </div>
          </div>
          <div className="absolute bottom-20 right-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
            <span className="rounded-full border border-slate-600 bg-black/60 px-2.5 py-1">
              TZ <span className="font-mono">{timezoneGroupKey}</span>
            </span>
            {!isAudioJoined ? (
              <button
                type="button"
                onClick={() => setJoinModalOpen(true)}
                className="rounded-full border border-blue-500 bg-black/60 px-2.5 py-1 text-blue-300"
              >
                Join Audio
              </button>
            ) : null}
          </div>
        </section>

        {isChatOpen ? (
          <aside
            className={`${
              isMobileViewport
                ? "relative z-30 min-h-0 flex-1 bg-white"
                : "relative z-30 min-h-0 bg-white md:inset-y-0 md:right-0 md:left-auto md:z-20 md:w-[340px] md:flex-none md:border-l md:border-slate-200 lg:relative lg:w-[360px] lg:pb-16"
            }`}
          >
            <CombinedChatStream
              className="h-full"
              accessToken={accessToken}
              webinarId={webinarId}
              sessionId={sessionId}
              scheduledStartISO={scheduledStartISO}
              playbackSec={playbackSec}
              initialDisplayName={displayName}
              title="Chat"
              onRequestClose={() => setIsChatOpen(false)}
              mobileOverlay={false}
            />
          </aside>
        ) : null}
      </div>

      <ZoomBottomBar
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen((v) => !v)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onLeave={() => router.push(`/w/${webinarSlug}`)}
        className={isMobileViewport && isChatOpen ? "hidden" : undefined}
      />
    </main>
  );
}
