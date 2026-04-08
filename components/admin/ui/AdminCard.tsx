"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function AdminCard({ children, className = "" }: Props) {
  return (
    <div
      className={`rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm ${className}`.trim()}
    >
      {children}
    </div>
  );
}
