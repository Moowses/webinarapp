"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type Props = {
  nextPath: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D7E2EC] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

async function createServerSession() {
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) {
    throw new Error("Unable to create a secure session.");
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Unable to create a secure session.");
  }
}

export default function LoginClient({ nextPath }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busyMode, setBusyMode] = useState<"email" | "reset" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmitEmail = useMemo(() => email.trim() && password.trim(), [email, password]);

  async function finalizeLogin() {
    await createServerSession();
    router.replace(nextPath || "/account");
    router.refresh();
  }

  async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitEmail) return;

    setBusyMode("email");
    setError(null);
    setMessage(null);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await finalizeLogin();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Email sign-in failed.");
    } finally {
      setBusyMode(null);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }

    setBusyMode("reset");
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Password reset email sent.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password reset failed.");
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[#E6EDF3] bg-white p-8 shadow-sm">
      <div className="mx-auto max-w-md">
        <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Authentication</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#1F2A37]">Log In</h1>

        <form onSubmit={handleEmailSignIn} className="mt-6 space-y-4">
          <label className="block text-sm text-[#1F2A37]">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-sm text-[#1F2A37]">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="Enter your password"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmitEmail || busyMode !== null}
            className="w-full rounded-xl bg-[#2F6FA3] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyMode === "email" ? "Signing in..." : "Sign in with email"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void handlePasswordReset()}
          disabled={busyMode !== null}
          className="mt-4 text-sm font-medium text-[#2F6FA3] transition hover:text-[#1E5685] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyMode === "reset" ? "Sending reset email..." : "Send password reset email"}
        </button>

        {message ? <p className="mt-4 rounded-xl bg-[#E8F5FF] px-4 py-3 text-sm text-[#1E5685]">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-[#FFF1EA] px-4 py-3 text-sm text-[#B45309]">{error}</p> : null}
      </div>
    </section>
  );
}
