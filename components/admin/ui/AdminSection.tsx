"use client";

import type { ReactNode } from "react";
import AdminCard from "./AdminCard";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
};

export default function AdminSection({
  title,
  description,
  children,
  defaultOpen = true,
  accent = "bg-[#2F6FA3]",
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-[#E6EDF3] bg-white transition hover:border-[#D7E5F1]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-3">
          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${accent}`} />
          <div>
            <h2 className="text-lg font-semibold text-[#1F2A37]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[#6B7280]">{description}</p> : null}
          </div>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-[#6B7280] transition group-open:rotate-180">
          v
        </span>
      </summary>
      <div className="px-4 pb-4">
        <AdminCard>{children}</AdminCard>
      </div>
    </details>
  );
}
