"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type SidebarLink = {
  href?: string;
  label: string;
  eyebrow: string;
  active?: boolean;
  onClick?: () => void;
};

type Props = {
  currentPath: string;
  currentUser: {
    displayName: string;
    email: string;
    canManageSettings: boolean;
    canManageUsers: boolean;
  };
  children?: React.ReactNode;
};

export default function AdminSidebar({ currentPath, currentUser, children }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(20);

  const links: SidebarLink[] = [
    {
      href: "/admin",
      label: "Dashboard",
      eyebrow: "Control center",
      active: currentPath === "/admin",
    },
    ...(currentUser.canManageSettings
      ? [
          {
            href: "/admin/settings",
            label: "Settings",
            eyebrow: "Branding and tab",
            active: currentPath === "/admin/settings",
          },
        ]
      : []),
    ...(currentUser.canManageUsers
      ? [
          {
            href: "/admin/settings/users",
            label: "User Management",
            eyebrow: "Roles and access",
            active: currentPath === "/admin/settings/users",
          },
        ]
      : []),
  ];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut(auth);
      await fetch("/api/auth/session", { method: "DELETE" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    if (!showLogoutModal) {
      setLogoutCountdown(20);
      return;
    }

    const timer = window.setInterval(() => {
      setLogoutCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setShowLogoutModal(false);
          return 20;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showLogoutModal]);

  return (
    <aside className="h-fit rounded-2xl border border-[#E6EDF3] bg-white p-5 shadow-sm">
      <div className="border-b border-[#E6EDF3] pb-4">
        <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">WebinarAPP</p>
        <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Admin Navigation</h2>
        <p className="mt-2 text-sm text-[#6B7280]">Access dashboard tools, settings, and account controls.</p>
        <div className="mt-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3">
          <div className="text-sm font-semibold text-[#1F2A37]">
            {currentUser.displayName || currentUser.email || "Signed-in user"}
          </div>
          <div className="mt-1 text-xs text-[#6B7280]">{currentUser.email || "No email on record"}</div>
        </div>
      </div>

      {children ? <div className="mt-4 space-y-2 border-b border-[#E6EDF3] pb-4">{children}</div> : null}

      <div className="mt-4 space-y-2">
        {links.map((link) =>
          link.href ? (
            <Link
              key={link.href}
              href={link.href}
              className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                link.active
                  ? "border-[#D6EAF8] bg-[#E8F5FF] text-[#2F6FA3]"
                  : "border-transparent bg-white text-[#1F2A37] hover:bg-[#F8FBFF]"
              }`}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">{link.eyebrow}</div>
              <div className="mt-1 text-sm font-semibold">{link.label}</div>
            </Link>
          ) : null
        )}

        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          disabled={loggingOut}
          className="block w-full rounded-2xl border border-[#D92D20] bg-[#D92D20] px-4 py-3 text-left text-white transition hover:bg-[#B42318] hover:border-[#B42318] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="text-sm font-semibold">
            {loggingOut ? "Logging out..." : "Log out"}
          </div>
        </button>
      </div>

      {showLogoutModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/55 px-4 py-8">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_32px_80px_rgba(16,24,40,0.28)]">
            <h3 className="text-2xl font-semibold text-[#172B4D]">Log out?</h3>
            <p className="mt-2 text-sm text-[#5E6C84]">
              Are you sure you want to log out? This confirmation will close in {logoutCountdown} seconds.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="rounded-xl bg-[#D92D20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#B42318] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : `Yes (${logoutCountdown})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
