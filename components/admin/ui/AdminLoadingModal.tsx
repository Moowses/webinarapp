"use client";

type Props = {
  open: boolean;
  message: string;
  detail?: string;
};

export default function AdminLoadingModal({ open, message, detail = "Please wait" }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2A37]/18 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[#E6EDF3] bg-white p-6 text-center shadow-xl">
        <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-[#E6EDF3] border-t-[#2F6FA3]" />
        <p className="mt-4 text-lg font-semibold text-[#1F2A37]">{message}</p>
        <p className="mt-1 text-sm text-[#6B7280]">{detail}</p>
      </div>
    </div>
  );
}
