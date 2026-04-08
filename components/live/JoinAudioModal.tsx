"use client";

type Props = {
  open: boolean;
  onJoinAudio: () => void;
  autoJoinEnabled: boolean;
  setAutoJoinEnabled: (value: boolean) => void;
  onClose?: () => void;
};

export default function JoinAudioModal({
  open,
  onJoinAudio,
  autoJoinEnabled,
  setAutoJoinEnabled,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#1f2937] p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Join Audio</h2>
            <p className="mt-1 text-sm text-slate-300">
              Connect your computer audio to hear the webinar clearly.
            </p>
          </div>
          <span className="rounded-full border border-slate-600 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
            Webinar
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
          <p className="text-sm font-medium text-white">Computer Audio</p>
          <p className="mt-1 text-sm text-slate-300">
            Recommended for attendees. Use your current speaker and device volume.
          </p>
        </div>

        <button
          type="button"
          onClick={onJoinAudio}
          className="mt-5 w-full rounded-xl bg-[#0e72ed] px-4 py-3 text-sm font-semibold text-white"
        >
          Join with Computer Audio
        </button>

        <button
          type="button"
          disabled
          className="mt-3 w-full rounded-xl border border-slate-700 bg-transparent px-4 py-3 text-sm text-slate-400 disabled:cursor-not-allowed"
        >
          Test Speaker and Microphone
        </button>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={autoJoinEnabled}
            onChange={(e) => setAutoJoinEnabled(e.target.checked)}
          />
          Automatically join audio by computer when joining a webinar
        </label>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
