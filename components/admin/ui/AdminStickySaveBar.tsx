"use client";

type Props = {
  visible: boolean;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
};

export default function AdminStickySaveBar({
  visible,
  saving = false,
  onCancel,
  onSave,
  disabled = false,
}: Props) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[70] w-[min(760px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-[#E6EDF3] bg-white px-5 py-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1F2A37]">Unsaved changes detected</p>
          <p className="text-xs text-[#6B7280]">Review your edits or save them now.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={disabled || saving}
            className="rounded-xl bg-[#2F6FA3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
