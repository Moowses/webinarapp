"use client";

import { useEffect } from "react";

function sendClientError(payload: {
  source: string;
  message: string;
  details?: string;
}) {
  const body = JSON.stringify({
    ...payload,
    path: typeof window !== "undefined" ? window.location.href : "",
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/system-logs/client-error", blob);
    return;
  }

  void fetch("/api/system-logs/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export default function ClientErrorLogger() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      sendClientError({
        source: "window.error",
        message: event.message || "Client runtime error",
        details: [event.filename, event.lineno, event.colno, event.error?.stack]
          .filter(Boolean)
          .join(" | "),
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      let reason = "Unhandled rejection";

      if (typeof event.reason === "string") {
        reason = event.reason;
      } else if (event.reason instanceof Error) {
        reason = `${event.reason.message}\n${event.reason.stack ?? ""}`;
      } else {
        try {
          reason = JSON.stringify(event.reason);
        } catch {
          reason = String(event.reason);
        }
      }

      sendClientError({
        source: "unhandledrejection",
        message: "Unhandled promise rejection",
        details: reason,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
