"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signOut, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type Props = {
  email: string;
  displayName: string;
  roleLabel: string;
  canAccessAdmin: boolean;
  mustSetPassword: boolean;
  disabled: boolean;
};

export default function AccountClient({
  email,
  displayName,
  roleLabel,
  canAccessAdmin,
  mustSetPassword,
  disabled,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reset" | "logout" | "set-password" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function refreshServerSession() {
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) {
      throw new Error("Your session could not be refreshed. Sign in again.");
    }

    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error("Your secure session could not be refreshed.");
    }
  }

  async function handleResetPassword() {
    setBusy("reset");
    setMessage(null);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password reset failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleLogout() {
    setBusy("logout");
    setMessage(null);
    setError(null);
    try {
      await signOut(auth);
      await fetch("/api/auth/session", { method: "DELETE" });
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Logout failed.");
      setBusy(null);
    }
  }

  async function handleSetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!auth.currentUser) {
      setError("Your session is not ready. Sign in again and retry.");
      return;
    }

    setBusy("set-password");
    setMessage(null);
    setError(null);
    try {
      await updatePassword(auth.currentUser, newPassword);
      await refreshServerSession();
      const response = await fetch("/api/auth/password-status", { method: "POST" });
      if (!response.ok) {
        throw new Error("Password updated but onboarding status could not be completed.");
      }
      setNewPassword("");
      setConfirmPassword("");
      router.replace(canAccessAdmin ? "/admin" : "/account");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Password update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {disabled ? (
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[#E6EDF3] bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Account Disabled</p>
          <h1 className="mt-3 text-3xl font-semibold text-[#1F2A37]">Access disabled</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            This account has been disabled. Contact an administrator if you need access restored.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={busy !== null}
              className="rounded-xl border border-[#D7E2EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2A37] transition hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "logout" ? "Signing out..." : "Sign out"}
            </button>
          </div>

          {message ? <p className="mt-4 rounded-xl bg-[#E8F5FF] px-4 py-3 text-sm text-[#1E5685]">{message}</p> : null}
          {error ? <p className="mt-4 rounded-xl bg-[#FFF1EA] px-4 py-3 text-sm text-[#B45309]">{error}</p> : null}
        </section>
      ) : mustSetPassword ? (
        <section className="mx-auto max-w-xl rounded-[2rem] border border-[#E6EDF3] bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Account Setup</p>
          <h1 className="mt-3 text-3xl font-semibold text-[#1F2A37]">Create your password</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Set your new password to finish first-time access.
          </p>

          <form onSubmit={handleSetPassword} className="mt-6 grid gap-4">
            <label className="block text-sm text-[#1F2A37]">
              Password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D7E2EC] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
              />
            </label>
            <label className="block text-sm text-[#1F2A37]">
              Retype password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D7E2EC] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="rounded-xl bg-[#2F6FA3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "set-password" ? "Saving..." : "Continue"}
            </button>
          </form>

          {error ? <p className="mt-4 rounded-xl bg-[#FFF1EA] px-4 py-3 text-sm text-[#B45309]">{error}</p> : null}
        </section>
      ) : (
      <>
      <section className="rounded-[2rem] border border-[#E6EDF3] bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Profile</p>
        <h1 className="mt-3 text-3xl font-semibold text-[#1F2A37]">{displayName || "Signed-in user"}</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Email</div>
            <div className="mt-2 text-sm font-medium text-[#1F2A37]">{email || "No email"}</div>
          </div>
          <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Role</div>
            <div className="mt-2 text-sm font-medium text-[#1F2A37]">{roleLabel}</div>
          </div>
          <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Dashboard</div>
            <div className="mt-2 text-sm font-medium text-[#1F2A37]">
              {mustSetPassword
                ? "Password setup required"
                : canAccessAdmin
                  ? "Admin access enabled"
                  : "Profile-only access"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#E6EDF3] bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Account Actions</p>
        <h2 className="mt-3 text-2xl font-semibold text-[#1F2A37]">Security and access</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleResetPassword()}
            disabled={busy !== null}
            className="rounded-xl bg-[#2F6FA3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "reset" ? "Sending reset email..." : "Reset password"}
          </button>
          {canAccessAdmin && !mustSetPassword ? (
            <a
              href="/admin"
              className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2.5 text-sm font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
            >
              Open admin dashboard
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={busy !== null}
            className="rounded-xl border border-[#D7E2EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2A37] transition hover:bg-[#F8FBFF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "logout" ? "Signing out..." : "Sign out"}
          </button>
        </div>

        {message ? <p className="mt-4 rounded-xl bg-[#E8F5FF] px-4 py-3 text-sm text-[#1E5685]">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-[#FFF1EA] px-4 py-3 text-sm text-[#B45309]">{error}</p> : null}
      </section>
      </>
      )}
    </div>
  );
}
