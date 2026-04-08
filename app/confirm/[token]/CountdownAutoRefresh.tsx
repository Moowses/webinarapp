"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  targetISO: string;
  token: string;
};

function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function CountdownAutoRefresh({ targetISO, token }: Props) {
  const router = useRouter();
  const targetMs = useMemo(() => new Date(targetISO).getTime(), [targetISO]);
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
      setRemainingSec(next);

      if (next === 0) {
        clearInterval(timer);
        router.replace(`/confirm/${token}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [router, targetMs, token]);

  return (
    <div className="mt-4 rounded-lg border bg-slate-50 p-4">
      <p className="text-sm text-slate-600">Your webinar starts in</p>
      <p className="mt-1 font-mono text-3xl font-semibold">
        {formatSeconds(remainingSec)}
      </p>
    </div>
  );
}
