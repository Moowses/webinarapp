"use client";

type Props = {
  message: string | null;
};

export default function AdminErrorToast({ message }: Props) {
  if (!message) return null;

  return (
    <div className="fixed right-6 top-20 z-[90] rounded-2xl border border-[#FFD7B3] bg-[#FFE7D1] px-4 py-3 text-sm text-[#F58220] shadow-sm">
      <span className="font-semibold">Error:</span> {message}
    </div>
  );
}
