"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { WebinarListItem } from "@/app/actions/webinar-actions";
import type {
  ActiveLiveSessionRow,
  ActiveLiveViewerRow,
  AdminRegistrantRow,
} from "@/app/actions/admin-registration-actions";
import AdminLiveMonitor from "@/components/admin/AdminLiveMonitor";
import WebinarTable from "@/components/admin/WebinarTable";

type Props = {
  webinars: WebinarListItem[];
  registrants: AdminRegistrantRow[];
  activeSessions: ActiveLiveSessionRow[];
  activeViewers: ActiveLiveViewerRow[];
};

type SectionKey = "live-monitor" | "webinars" | "registrants";

const navItems: Array<{ key: SectionKey; label: string; eyebrow: string }> = [
  { key: "live-monitor", label: "Live Monitor", eyebrow: "Observe sessions" },
  { key: "webinars", label: "Webinars", eyebrow: "Manage library" },
  { key: "registrants", label: "Registrants", eyebrow: "Attendance and leads" },
];

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateTime(iso: string | null) {
  if (!iso) return "Not available";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export default function AdminDashboardClient({
  webinars,
  registrants,
  activeSessions,
  activeViewers,
}: Props) {
  const [active, setActive] = useState<SectionKey>("webinars");
  const [selectedWebinar, setSelectedWebinar] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const latestUpdate = webinars[0]?.updatedAt ?? null;
  const attendedCount = registrants.filter((r) => r.attendedLive).length;

  const webinarOptions = useMemo(() => {
    const set = new Set<string>();
    registrants.forEach((r) => {
      if (r.webinarTitle) set.add(r.webinarTitle);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [registrants]);

  const filteredRegistrants = useMemo(() => {
    return registrants.filter((row) => {
      if (selectedWebinar !== "all" && row.webinarTitle !== selectedWebinar) return false;

      const created = row.createdAt ? new Date(row.createdAt).getTime() : null;
      if (dateFrom && created !== null) {
        const from = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
        if (created < from) return false;
      } else if (dateFrom && created === null) {
        return false;
      }

      if (dateTo && created !== null) {
        const to = new Date(`${dateTo}T23:59:59.999Z`).getTime();
        if (created > to) return false;
      } else if (dateTo && created === null) {
        return false;
      }

      return true;
    });
  }, [dateFrom, dateTo, registrants, selectedWebinar]);

  const visibleRegistrants = filteredRegistrants.slice(0, 20);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-[#E6EDF3] bg-white p-5 shadow-sm">
        <div className="border-b border-[#E6EDF3] pb-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">WebinarAPP</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Admin Navigation</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Monitor operations, manage webinar assets, and review attendee activity.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {navItems.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-[#D6EAF8] bg-[#E8F5FF] text-[#2F6FA3]"
                    : "border-transparent bg-white text-[#1F2A37] hover:bg-[#F8FBFF]"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">{item.eyebrow}</div>
                <div className="mt-1 text-sm font-semibold">{item.label}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">Recent Webinars</p>
                <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Latest webinar activity</h2>
                <p className="mt-2 text-sm text-[#6B7280]">Updated {formatDateTime(latestUpdate)}.</p>
              </div>
              <button
                type="button"
                onClick={() => setActive("webinars")}
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]"
              >
                View all webinars
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {webinars.slice(0, 5).map((webinar) => (
                <div
                  key={webinar.webinarId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1F2A37]">{webinar.title || "(Untitled webinar)"}</p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      /{webinar.slug} | Updated {formatDateTime(webinar.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/webinars/${webinar.webinarId}`}
                      className="rounded-lg bg-[#2F6FA3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3E82BD]"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/webinars/${webinar.webinarId}/preview`}
                      className="rounded-lg border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]"
                    >
                      Preview
                    </Link>
                  </div>
                </div>
              ))}
              {webinars.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E6EDF3] bg-[#F8FBFF] px-4 py-8 text-sm text-[#6B7280]">
                  No webinars yet. Create your first webinar to start using the dashboard.
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">Quick Actions</p>
              <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Move faster</h2>
              <div className="mt-5 grid gap-3">
                <QuickAction
                  title="Create webinar"
                  description="Set up a new registration and live experience."
                  href="/admin/webinars/new"
                  variant="primary"
                />
                <QuickAction
                  title="Open live monitor"
                  description="Inspect active sessions, viewers, and real-time chat."
                  onClick={() => setActive("live-monitor")}
                />
                <QuickAction
                  title="View registrants"
                  description="Filter attendee records by webinar and date."
                  onClick={() => setActive("registrants")}
                />
                <QuickAction
                  title="Manage predefined chat"
                  description="Open webinar tools to upload scripted chat replay."
                  onClick={() => setActive("webinars")}
                  variant="accent"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">System Status</p>
              <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Readiness snapshot</h2>
              <div className="mt-5 space-y-3">
                <StatusRow
                  label="Live sessions"
                  value={activeSessions.length ? `${activeSessions.length} running` : "No live sessions"}
                />
                <StatusRow label="Latest update" value={formatDateTime(latestUpdate)} />
                <StatusRow
                  label="Registrants requiring follow-up"
                  value={`${Math.max(registrants.length - attendedCount, 0)} not yet attended`}
                />
              </div>
            </section>
          </div>
        </section>

        {active === "live-monitor" ? (
          <AdminLiveMonitor sessions={activeSessions} viewers={activeViewers} />
        ) : null}

        {active === "webinars" ? <WebinarTable webinars={webinars} /> : null}

        {active === "registrants" ? (
          <section className="rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
            <div className="border-b border-[#E6EDF3] bg-[#F8FBFF] px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1F2A37]">Registrants</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Filter by webinar and date range. Includes live attendance status.
              </p>
            </div>

            <div className="grid gap-4 border-b border-[#E6EDF3] px-6 py-5 md:grid-cols-4">
              <label className="text-sm text-[#1F2A37]">
                Webinar
                <select
                  value={selectedWebinar}
                  onChange={(e) => setSelectedWebinar(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
                >
                  {webinarOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "all" ? "All webinars" : opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-[#1F2A37]">
                Date from
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                  className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
                />
              </label>

              <label className="text-sm text-[#1F2A37]">
                Date to
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
                />
              </label>

              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWebinar("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]"
                >
                  Reset
                </button>
                <span className="text-sm text-[#6B7280]">{filteredRegistrants.length} results</span>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F8FBFF] text-left text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Registered Webinar</th>
                    <th className="px-6 py-3 font-semibold">Registered At</th>
                    <th className="px-6 py-3 font-semibold">Watch Time</th>
                    <th className="px-6 py-3 font-semibold">Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRegistrants.map((row) => (
                    <tr key={row.registrationId} className="border-t border-[#E6EDF3]">
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1F2A37]">{row.fullName}</div>
                        <div className="text-xs text-[#6B7280]">{row.email || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1F2A37]">{row.webinarTitle}</div>
                        {row.webinarSlug ? (
                          <div className="font-mono text-xs text-[#6B7280]">/{row.webinarSlug}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        {row.createdAt ? toDateInputValue(row.createdAt) : "-"}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        {row.watchedMinutesEstimate !== null ? `${row.watchedMinutesEstimate} min` : "-"}
                      </td>
                      <td className="px-6 py-4">
                        {row.attendedLive ? (
                          <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">
                            Attended {row.attendedAtISO ? `(${toDateInputValue(row.attendedAtISO)})` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#FFE7D1] px-3 py-1 text-xs font-medium text-[#F58220]">
                            Not yet
                          </span>
                        )}
                        {row.isWatchingNow ? (
                          <div className="mt-2">
                            <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">
                              Watching now
                            </span>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {visibleRegistrants.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-[#6B7280]" colSpan={5}>
                        No registrants found for the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  onClick,
  variant = "secondary",
}: {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "accent";
}) {
  const className =
    variant === "primary"
      ? "border-[#2F6FA3] bg-[#2F6FA3] text-white hover:bg-[#3E82BD]"
      : variant === "accent"
      ? "border-[#F58220] bg-[#F58220] text-white hover:bg-[#E46F12]"
      : "border-[#E6EDF3] bg-white text-[#1F2A37] hover:bg-[#F8FBFF]";

  const content = (
    <>
      <div className="text-sm font-semibold">{title}</div>
      <div className={`mt-1 text-xs ${variant === "secondary" ? "text-[#6B7280]" : "text-white/85"}`}>
        {description}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`rounded-2xl border px-4 py-4 text-left transition ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${className}`}>
      {content}
    </button>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <span className="text-sm font-medium text-[#1F2A37]">{value}</span>
    </div>
  );
}
