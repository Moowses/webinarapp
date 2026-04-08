"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WebinarRecord } from "@/app/actions/webinar-actions";
import AdminCard from "@/components/admin/ui/AdminCard";

type Props = {
  webinar: WebinarRecord;
};

type PredefinedMessage = {
  id: string;
  playbackOffsetSec: number;
  senderName: string;
  text: string;
};

function formatSec(value: number) {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSchedule(days: number[], times: string[]) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days.map((day) => labels[day] ?? day).join(", ")} at ${times.join(", ")}`;
}

export default function WebinarPreviewClient({ webinar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const customJumpRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<PredefinedMessage[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(webinar.durationSec);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [chatDebug, setChatDebug] = useState(true);
  const [audioDebug, setAudioDebug] = useState(true);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      try {
        const response = await fetch(`/api/webinars/${webinar.webinarId}/predefined?uptoSec=999999&pageSize=500`);
        const json = (await response.json()) as { messages?: PredefinedMessage[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error || "Failed to load predefined chat");
        }
        if (!cancelled) {
          setMessages(json.messages ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessagesError(error instanceof Error ? error.message : "Failed to load predefined chat");
        }
      }
    }

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [webinar.webinarId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onLoadedMetadata() {
      setVideoLoaded(true);
      setDuration(Math.ceil(video.duration || webinar.durationSec));
      const audioDetected =
        "mozHasAudio" in video
          ? Boolean((video as HTMLVideoElement & { mozHasAudio?: boolean }).mozHasAudio)
          : "webkitAudioDecodedByteCount" in video
          ? Number(
              (video as HTMLVideoElement & { webkitAudioDecodedByteCount?: number })
                .webkitAudioDecodedByteCount
            ) > 0
          : video.audioTracks
          ? video.audioTracks.length > 0
          : null;
      setHasAudio(audioDetected);
    }

    function onTimeUpdate() {
      setCurrentTime(video.currentTime);
      setIsPlaying(!video.paused && !video.ended);
      setIsMuted(video.muted);
      setVolume(video.volume);
    }

    function onPlay() {
      setIsPlaying(true);
    }

    function onPause() {
      setIsPlaying(false);
    }

    function onVolumeChange() {
      setIsMuted(video.muted);
      setVolume(video.volume);
    }

    function onError() {
      setVideoError("Video failed to load");
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("error", onError);
    };
  }, [webinar.durationSec]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.playbackOffsetSec <= currentTime),
    [messages, currentTime]
  );

  const botArmed = webinar.bot.enabled && currentTime >= webinar.bot.activationDelaySec;

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(video.currentTime);
  }

  function restartPreview() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {});
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function onVolumeInput(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    if (next > 0) video.muted = false;
    setVolume(next);
    setIsMuted(video.muted);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]">
      <div className="space-y-6">
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#2F6FA3]">
                  Preview Mode
                </span>
                <span className="rounded-full bg-[#FFE7D1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#F58220]">
                  Admin Only
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-[#1F2A37]">{webinar.title}</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Simulate attendee experience without creating registrations, sessions, or webhook side effects.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/w/${webinar.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
              >
                Simulate attendee experience
              </a>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#1F2A37]">Video Playback QA</h3>
              <p className="mt-1 text-sm text-[#6B7280]">Validate load, controls, audio, and playback state.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[10, 30, 60].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => seekTo(value)}
                  className="rounded-lg border border-[#2F6FA3] bg-white px-3 py-1.5 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
                >
                  Jump to {value}s
                </button>
              ))}
              <button
                type="button"
                onClick={restartPreview}
                className="rounded-lg bg-[#2F6FA3] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#3E82BD]"
              >
                Restart preview
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF]">
            <video
              ref={videoRef}
              className="aspect-video w-full bg-black object-contain"
              src={webinar.videoPublicPath}
              controls
              muted
              playsInline
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusPill label="Video loaded" value={videoLoaded ? "Yes" : "No"} />
            <StatusPill label="Playback" value={isPlaying ? "Playing" : "Paused"} />
            <StatusPill label="Mute state" value={isMuted ? "Muted" : "Unmuted"} />
            <StatusPill label="Audio track" value={hasAudio === null ? "Unknown" : hasAudio ? "Detected" : "No"} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="rounded-2xl border border-[#E6EDF3] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#1F2A37]">Current time</span>
                <span className="font-mono text-sm text-[#2F6FA3]">{formatSec(currentTime)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  ref={customJumpRef}
                  type="number"
                  min={0}
                  max={duration}
                  placeholder="Custom sec"
                  className="w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
                />
                <button
                  type="button"
                  onClick={() => seekTo(Number(customJumpRef.current?.value || 0))}
                  className="rounded-lg bg-[#F58220] px-3 py-2 text-sm font-semibold text-white hover:bg-[#E46F12]"
                >
                  Jump
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6EDF3] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#1F2A37]">Volume</span>
                <span className="font-mono text-sm text-[#2F6FA3]">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => onVolumeInput(Number(event.target.value))}
                className="mt-3 w-full accent-[#2F6FA3]"
              />
              <button
                type="button"
                onClick={toggleMute}
                className="mt-3 w-full rounded-lg border border-[#2F6FA3] bg-white px-3 py-2 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
              >
                {isMuted ? "Test Audio / Unmute" : "Mute"}
              </button>
            </div>
          </div>

          {videoError ? <p className="mt-4 text-sm text-[#F58220]">{videoError}</p> : null}
        </AdminCard>

        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#1F2A37]">Predefined Chat Replay</h3>
              <p className="mt-1 text-sm text-[#6B7280]">Messages should stay synced with the preview video timeline.</p>
            </div>
            <button
              type="button"
              onClick={() => setChatDebug((value) => !value)}
              className="rounded-lg border border-[#2F6FA3] bg-white px-3 py-1.5 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
            >
              {chatDebug ? "Hide chat debug" : "Show chat debug"}
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
            <div className="max-h-[320px] space-y-3 overflow-y-auto">
              {visibleMessages.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No replay chat visible yet for the current timestamp.</p>
              ) : (
                visibleMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-[#E6EDF3] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
                        {formatSec(message.playbackOffsetSec)}
                      </span>
                      <span className="text-xs text-[#6B7280]">{message.senderName}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#1F2A37]">{message.text}</p>
                  </div>
                ))
              )}
            </div>
            {messagesError ? <p className="mt-3 text-sm text-[#F58220]">{messagesError}</p> : null}
            {chatDebug ? (
              <div className="mt-4 rounded-xl bg-white p-3 text-xs text-[#6B7280]">
                Loaded messages: {messages.length} | Visible now: {visibleMessages.length} | Current preview timestamp:{" "}
                <span className="font-mono">{formatSec(currentTime)}</span>
              </div>
            ) : null}
          </div>
        </AdminCard>
      </div>

      <div className="space-y-6">
        <AdminCard>
          <h3 className="text-lg font-semibold text-[#1F2A37]">Webinar Timing Validation</h3>
          <div className="mt-4 space-y-3 text-sm text-[#1F2A37]">
            <InfoRow label="Configured local schedule" value={formatSchedule(webinar.schedule.daysOfWeek, webinar.schedule.times)} />
            <InfoRow label="Webinar duration" value={`${webinar.durationSec}s`} />
            <InfoRow label="Late join grace" value={`${webinar.lateGraceMinutes} min`} />
            <InfoRow label="Live window" value={`${webinar.schedule.liveWindowMinutes} min`} />
            <InfoRow label="Preview timezone" value={timezone} />
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[#1F2A37]">AI Bot Validation</h3>
            <button
              type="button"
              onClick={() => setAudioDebug((value) => !value)}
              className="rounded-lg border border-[#2F6FA3] bg-white px-3 py-1.5 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
            >
              {audioDebug ? "Hide audio debug" : "Show audio debug"}
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm text-[#1F2A37]">
            <InfoRow label="Chatbot enabled" value={webinar.bot.enabled ? "Yes" : "No"} />
            <InfoRow label="Activation delay" value={`${webinar.bot.activationDelaySec}s`} />
            <InfoRow label="Bot armed / ready" value={botArmed ? "Ready" : "Waiting"} />
            <InfoRow label="Bot name" value={webinar.bot.name || "Not configured"} />
          </div>
          {audioDebug ? (
            <div className="mt-4 rounded-xl bg-[#F8FBFF] p-3 text-xs text-[#6B7280]">
              Audio debug: muted={String(isMuted)} volume={Math.round(volume * 100)} loaded={String(videoLoaded)} hasAudio=
              {hasAudio === null ? "unknown" : String(hasAudio)}
            </div>
          ) : null}
        </AdminCard>

        <AdminCard>
          <h3 className="text-lg font-semibold text-[#1F2A37]">Redirect Validation</h3>
          <div className="mt-4 space-y-3 text-sm text-[#1F2A37]">
            <InfoRow label="Redirect enabled" value={webinar.redirect.enabled ? "Yes" : "No"} />
            <InfoRow label="Redirect URL" value={webinar.redirect.url || "Not configured"} mono />
          </div>
          <button
            type="button"
            disabled={!webinar.redirect.enabled || !webinar.redirect.url}
            onClick={() => window.open(webinar.redirect.url, "_blank", "noopener,noreferrer")}
            className="mt-4 w-full rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Test redirect behavior
          </button>
        </AdminCard>

        <AdminCard>
          <h3 className="text-lg font-semibold text-[#1F2A37]">Debug Panel</h3>
          <div className="mt-4 space-y-2 text-sm">
            <InfoRow label="webinarId" value={webinar.webinarId} mono />
            <InfoRow label="title" value={webinar.title} />
            <InfoRow label="slug" value={webinar.slug} mono />
            <InfoRow label="video path" value={webinar.videoPublicPath} mono />
            <InfoRow label="video loaded" value={videoLoaded ? "yes" : "no"} />
            <InfoRow label="predefined chat count" value={String(messages.length)} />
            <InfoRow label="chatbot enabled" value={webinar.bot.enabled ? "yes" : "no"} />
            <InfoRow label="redirect enabled" value={webinar.redirect.enabled ? "yes" : "no"} />
            <InfoRow label="schedule days" value={webinar.schedule.daysOfWeek.join(", ")} mono />
            <InfoRow label="schedule time" value={webinar.schedule.times.join(", ")} mono />
            <InfoRow label="current preview timestamp" value={formatSec(currentTime)} mono />
            <InfoRow label="session timezone used" value={timezone} mono />
            <InfoRow label="playback state" value={isPlaying ? "playing" : "paused"} />
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E6EDF3] bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-[#6B7280]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#1F2A37]">{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-3 py-2.5">
      <span className="text-[#6B7280]">{label}</span>
      <span className={mono ? "font-mono text-[#1F2A37]" : "text-right text-[#1F2A37]"}>{value}</span>
    </div>
  );
}
