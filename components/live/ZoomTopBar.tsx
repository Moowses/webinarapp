"use client";

type Props = {
  viewerCount: number;
  webinarTitle: string;
  className?: string;
};

export default function ZoomTopBar({
  viewerCount,
  webinarTitle,
  className,
}: Props) {
  return (
    <header
      className={`pointer-events-none absolute left-0 right-0 top-0 z-30 flex h-14 items-center justify-between bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.42))] px-4 text-slate-100 transition-opacity duration-300 ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide text-white">webinarapp</span>
        <span className="text-xs text-slate-300">Webinar Mode</span>
      </div>
      <div className="max-w-[40vw] truncate text-sm font-medium text-slate-100">{webinarTitle}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-200">
          Participants {viewerCount}
        </span>
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-slate-300">
          Speaker View
        </span>
      </div>
    </header>
  );
}
