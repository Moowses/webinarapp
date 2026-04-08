"use client";

type Props = {
  message: string | null;
};

export default function AdminSuccessToast({ message }: Props) {
  if (!message) return null;

  return (
    <div className="fixed right-6 top-6 z-[90] rounded-2xl border border-[#D6EAF8] bg-[#E8F5FF] px-4 py-3 text-sm text-[#2F6FA3] shadow-sm">
      <span className="font-semibold">Success:</span> {message}
    </div>
  );
}
