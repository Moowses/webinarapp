"use client";

type Props = {
  viewerCount: number;
  isChatOpen: boolean;
  onToggleChat: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
  className?: string;
};

export default function ZoomBottomBar({
  viewerCount,
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
            className={`min-w-24 rounded-xl border px-3 py-2 text-xs font-medium ${
              isMuted
                ? "border-white/15 bg-white/5 text-slate-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Security
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            Participants {viewerCount}
          </span>
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
          <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Reactions
          </span>
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
