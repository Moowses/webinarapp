"use client";

type Props = {
  isChatOpen: boolean;
  onToggleChat: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
  className?: string;
};

export default function ZoomBottomBar({
  isChatOpen,
  onToggleChat,
  isMuted,
  onToggleMute,
  onLeave,
  className,
}: Props) {
  return (
    <footer
        className={`absolute bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[rgba(15,23,42,0.88)] px-3 py-2.5 text-slate-100 backdrop-blur transition-opacity duration-300 ${
          className ?? ""
        }`}
      >
      <div className="mx-auto flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute webinar audio" : "Mute webinar audio"}
            title={isMuted ? "Unmute" : "Mute"}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
              isMuted
                ? "border-white/15 bg-white/5 text-slate-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
                <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
                <path d="m16 9 5 5" />
                <path d="m21 9-5 5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
                <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onToggleChat}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              isChatOpen
                ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                : "border-white/15 bg-white/5 text-slate-200"
            }`}
          >
            {isChatOpen ? "Chat open" : "Open chat"}
          </button>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Leave
        </button>
      </div>
    </footer>
  );
}
