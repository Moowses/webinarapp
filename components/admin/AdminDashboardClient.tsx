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
import {
  addDaysYMD,
  getZonedParts,
  parseLocalTimeHHMM,
  zonedDateTimeToUtcDate,
} from "@/lib/utils/timezone";

type Props = {
  webinars: WebinarListItem[];
  registrants: AdminRegistrantRow[];
  activeSessions: ActiveLiveSessionRow[];
  activeViewers: ActiveLiveViewerRow[];
};

type SectionKey =
  | "dashboard"
  | "scheduled-webinars"
  | "activity-log"
  | "live-monitor"
  | "webinars"
  | "registrants";

type ScheduledWebinarRow = {
  webinarId: string;
  webinarTitle: string;
  webinarSlug: string;
  scheduledAtISO: string;
  scheduleTimeZone: string;
  status: "Scheduled" | "Live" | "Completed";
  registrants: Array<{
    registrationId: string;
    fullName: string;
    email: string;
  }>;
};

type ActivityLogRow = {
  id: string;
  webinarId: string;
  webinarSlug: string;
  webinarTitle: string;
  scheduledAtISO: string;
  startedAtISO: string | null;
  completedAtISO: string | null;
  status: "Scheduled" | "Live" | "Completed";
  totalRegistrants: number;
  totalAttended: number;
  totalNoShows: number;
  totalViewers: number;
  viewers: Array<{
    registrationId: string;
    fullName: string;
    email: string;
    accessToken: string | null;
    watchedMinutes: number | null;
    status: "Registered" | "Attended" | "No-show";
  }>;
};

const navItems: Array<{ key: SectionKey; label: string; eyebrow: string }> = [
  { key: "dashboard", label: "Dashboard", eyebrow: "Control center" },
  { key: "activity-log", label: "Activity Log", eyebrow: "Attendance" },
  { key: "live-monitor", label: "Live Monitor", eyebrow: "Observe sessions" },
  { key: "webinars", label: "Webinars", eyebrow: "Manage library" },
  { key: "registrants", label: "Registrants", eyebrow: "Attendance and leads" },
];
const ADMIN_DISPLAY_TIMEZONE = "America/Toronto";

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateTime(iso: string | null, timeZone?: string) {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone ?? ADMIN_DISPLAY_TIMEZONE,
  }).format(date);
}

function getRegistrantLifecycleStatus(
  row: Pick<AdminRegistrantRow, "attendedLive" | "isWatchingNow" | "liveWindowEndISO">,
  nowMs: number
): "Registered" | "Attended" | "No-show" {
  const liveWindowEndMs = row.liveWindowEndISO ? Date.parse(row.liveWindowEndISO) : NaN;
  if (row.isWatchingNow || row.attendedLive) return "Attended";
  if (Number.isFinite(liveWindowEndMs) && nowMs > liveWindowEndMs) return "No-show";
  return "Registered";
}

function getScheduleEntries(schedule: WebinarListItem["schedule"]) {
  if (Array.isArray(schedule.dayTimes) && schedule.dayTimes.length > 0) {
    return schedule.dayTimes
      .map((entry) => {
        const parsed = parseLocalTimeHHMM(entry.time);
        return parsed ? { dayOfWeek: entry.dayOfWeek, parsed } : null;
      })
      .filter((entry): entry is { dayOfWeek: number; parsed: { hour: number; minute: number } } => Boolean(entry));
  }
  const days = [...new Set(schedule.daysOfWeek)].sort((a, b) => a - b);
  const times = [...new Set(schedule.times)]
    .map((time) => parseLocalTimeHHMM(time))
    .filter((time): time is { hour: number; minute: number } => Boolean(time));
  if (days.length === 0 || times.length === 0) return [];
  return days.map((dayOfWeek, index) => ({
    dayOfWeek,
    parsed: times[Math.min(index, times.length - 1)],
  }));
}

function candidateDate(now: Date, timeZone: string, dayOfWeek: number, hour: number, minute: number, offsetDays: number) {
  const parts = getZonedParts(now, timeZone);
  const delta = (dayOfWeek - parts.weekday + 7) % 7;
  const target = addDaysYMD(parts.year, parts.month, parts.day, delta + offsetDays);
  return zonedDateTimeToUtcDate({
    timeZone,
    year: target.year,
    month: target.month,
    day: target.day,
    hour,
    minute,
    second: 0,
  });
}

function computeScheduledRows(webinars: WebinarListItem[], registrants: AdminRegistrantRow[]): ScheduledWebinarRow[] {
  const now = new Date();
  const webinarMap = new Map(webinars.map((webinar) => [webinar.webinarId, webinar]));
  const realUpcomingRows = new Map<string, ScheduledWebinarRow>();

  for (const registrant of registrants) {
    if (!registrant.webinarId || !registrant.scheduledStartISO) continue;
    const scheduledMs = Date.parse(registrant.scheduledStartISO);
    if (!Number.isFinite(scheduledMs) || scheduledMs < now.getTime()) continue;

    const webinar = webinarMap.get(registrant.webinarId);
    const scheduleTimeZone = ADMIN_DISPLAY_TIMEZONE;
    const key = `${registrant.webinarId}__${registrant.scheduledStartISO}`;
    if (!realUpcomingRows.has(key)) {
      realUpcomingRows.set(key, {
        webinarId: registrant.webinarId,
        webinarTitle: registrant.webinarTitle || webinar?.title || "(Untitled webinar)",
        webinarSlug: registrant.webinarSlug || webinar?.slug || "",
        scheduledAtISO: registrant.scheduledStartISO,
        scheduleTimeZone,
        status: "Scheduled",
        registrants: [],
      });
    }

    realUpcomingRows.get(key)?.registrants.push({
      registrationId: registrant.registrationId,
      fullName: registrant.fullName,
      email: registrant.email,
    });
  }

  const fallbackRows = webinars
    .map((webinar) => {
      const timeZone = ADMIN_DISPLAY_TIMEZONE;
      const entries = getScheduleEntries(webinar.schedule);
      if (entries.length === 0) return null;
      let live: Date | null = null;
      let upcoming: Date | null = null;
      let completed: Date | null = null;

      for (const entry of entries) {
        for (const offset of [-7, 0, 7]) {
          const start = candidateDate(now, timeZone, entry.dayOfWeek, entry.parsed.hour, entry.parsed.minute, offset);
          const end = new Date(start.getTime() + Math.max(1, webinar.durationSec) * 1000);
          if (start <= now && now <= end) {
            if (!live || start > live) live = start;
          } else if (start > now) {
            if (!upcoming || start < upcoming) upcoming = start;
          } else {
            if (!completed || start > completed) completed = start;
          }
        }
      }

      const status = live ? "Live" : upcoming ? "Scheduled" : "Completed";
      const scheduledAtISO = (live ?? upcoming ?? completed)?.toISOString();
      if (!scheduledAtISO) return null;
      return {
        webinarId: webinar.webinarId,
        webinarTitle: webinar.title || "(Untitled webinar)",
        webinarSlug: webinar.slug,
        scheduledAtISO,
        scheduleTimeZone: timeZone,
        status,
        registrants: [],
      } satisfies ScheduledWebinarRow;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => ![...realUpcomingRows.values()].some((existing) => existing.webinarId === row.webinarId));

  return [...realUpcomingRows.values(), ...fallbackRows].sort((a, b) => {
    const weight = { Live: 0, Scheduled: 1, Completed: 2 };
    return weight[a.status] - weight[b.status] || Date.parse(a.scheduledAtISO) - Date.parse(b.scheduledAtISO);
  });
}

function computeActivityRows(registrants: AdminRegistrantRow[], activeSessions: ActiveLiveSessionRow[]): ActivityLogRow[] {
  const nowMs = Date.now();
  const liveKeys = new Set(activeSessions.map((s) => `${s.webinarId}__${s.scheduledStartISO}`));
  const map = new Map<string, ActivityLogRow>();

  for (const row of registrants) {
    if (!row.webinarId || !row.scheduledStartISO) continue;
    const key = `${row.webinarId}__${row.scheduledStartISO}`;
    const scheduledMs = Date.parse(row.scheduledStartISO);
    const endMs = row.scheduledEndISO ? Date.parse(row.scheduledEndISO) : NaN;
    const isLive = liveKeys.has(key);
    const status: ActivityLogRow["status"] =
      isLive ? "Live" : Number.isFinite(scheduledMs) && scheduledMs > nowMs ? "Scheduled" : "Completed";

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        webinarId: row.webinarId,
        webinarSlug: row.webinarSlug,
        webinarTitle: row.webinarTitle,
        scheduledAtISO: row.scheduledStartISO,
        startedAtISO: row.attendedAtISO ?? (Number.isFinite(scheduledMs) && scheduledMs <= nowMs ? row.scheduledStartISO : null),
        completedAtISO: !isLive && Number.isFinite(endMs) && endMs <= nowMs ? row.scheduledEndISO : null,
        status,
        totalRegistrants: 0,
        totalAttended: 0,
        totalNoShows: 0,
        totalViewers: 0,
        viewers: [],
      });
    }

    const current = map.get(key)!;
    const viewerStatus = getRegistrantLifecycleStatus(row, nowMs);
    current.totalRegistrants += 1;
    current.viewers.push({
      registrationId: row.registrationId,
      fullName: row.fullName,
      email: row.email,
      accessToken: row.accessToken,
      watchedMinutes: row.watchedMinutesEstimate,
      status: viewerStatus,
    });
    if (row.attendedLive) {
      current.totalAttended += 1;
    }
    if (row.attendedLive || row.watchedMinutesEstimate !== null || row.isWatchingNow) {
      current.totalViewers += 1;
    }
    if (row.attendedAtISO && (!current.startedAtISO || Date.parse(row.attendedAtISO) < Date.parse(current.startedAtISO))) {
      current.startedAtISO = row.attendedAtISO;
    }
    if (current.status !== "Live" && row.scheduledEndISO) {
      current.completedAtISO = row.scheduledEndISO;
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      totalNoShows: row.status === "Completed" ? Math.max(row.totalRegistrants - row.totalAttended, 0) : 0,
    }))
    .map((row) => ({ ...row, viewers: [...row.viewers].sort((a, b) => a.fullName.localeCompare(b.fullName)) }))
    .sort((a, b) => Date.parse(b.scheduledAtISO) - Date.parse(a.scheduledAtISO));
}

export default function AdminDashboardClient({ webinars, registrants, activeSessions, activeViewers }: Props) {
  const [active, setActive] = useState<SectionKey>("dashboard");
  const [selectedWebinar, setSelectedWebinar] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusSort, setStatusSort] = useState<"default" | "status-asc" | "status-desc">("default");
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [expandedScheduledId, setExpandedScheduledId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewNowMs] = useState(() => Date.now());

  const latestUpdate = webinars[0]?.updatedAt ?? null;
  const attendedCount = registrants.filter((r) => r.attendedLive).length;
  const scheduledRows = useMemo(
    () =>
      computeScheduledRows(webinars, registrants).map((row) => ({
        ...row,
        registrants: [...row.registrants].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      })),
    [webinars, registrants]
  );
  const activityRows = useMemo(() => computeActivityRows(registrants, activeSessions), [registrants, activeSessions]);

  const webinarOptions = useMemo(() => {
    const set = new Set<string>();
    registrants.forEach((r) => r.webinarTitle && set.add(r.webinarTitle));
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [registrants]);

  const filteredRegistrants = useMemo(
    () =>
      registrants.filter((row) => {
        if (selectedWebinar !== "all" && row.webinarTitle !== selectedWebinar) return false;
        const created = row.createdAt ? new Date(row.createdAt).getTime() : null;
        if (dateFrom) {
          if (created === null) return false;
          if (created < new Date(`${dateFrom}T00:00:00.000Z`).getTime()) return false;
        }
        if (dateTo) {
          if (created === null) return false;
          if (created > new Date(`${dateTo}T23:59:59.999Z`).getTime()) return false;
        }
        return true;
      }),
    [dateFrom, dateTo, registrants, selectedWebinar]
  );

  const visibleRegistrants = useMemo(() => {
    const rows = [...filteredRegistrants];
    const statusWeight = (row: AdminRegistrantRow) => {
      const status = getRegistrantLifecycleStatus(row, viewNowMs);
      if (row.isWatchingNow) return 0;
      if (status === "Attended") return 1;
      if (status === "No-show") return 2;
      return 3;
    };

    if (statusSort === "status-asc") {
      rows.sort((a, b) => statusWeight(a) - statusWeight(b) || a.fullName.localeCompare(b.fullName));
    } else if (statusSort === "status-desc") {
      rows.sort((a, b) => statusWeight(b) - statusWeight(a) || a.fullName.localeCompare(b.fullName));
    }

    return rows.slice(0, 20);
  }, [filteredRegistrants, statusSort, viewNowMs]);

  async function copyText(value: string, successLabel: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successLabel);
      window.setTimeout(() => setMessage(null), 1800);
    } catch {
      setMessage("Copy failed");
      window.setTimeout(() => setMessage(null), 1800);
    }
  }

  function getBaseUrl() {
    const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    if (envBase) return envBase.replace(/\/$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }

  function getConfirmationLink(token: string | null) {
    if (!token) return null;
    return `${getBaseUrl()}/confirm/${token}`;
  }

  function getLiveLink(token: string | null) {
    if (!token) return null;
    return `${getBaseUrl()}/live/${token}`;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-[#E6EDF3] bg-white p-5 shadow-sm">
        <div className="border-b border-[#E6EDF3] pb-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">WebinarAPP</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Admin Navigation</h2>
          <p className="mt-2 text-sm text-[#6B7280]">Monitor operations, manage webinar assets, and review attendee activity.</p>
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
                  isActive ? "border-[#D6EAF8] bg-[#E8F5FF] text-[#2F6FA3]" : "border-transparent bg-white text-[#1F2A37] hover:bg-[#F8FBFF]"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">{item.eyebrow}</div>
                <div className="mt-1 text-sm font-semibold">{item.label}</div>
              </button>
            );
          })}
          <Link href="/admin/settings" className="block w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-left text-[#1F2A37] transition hover:bg-[#F8FBFF]">
            <div className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Branding and tab</div>
            <div className="mt-1 text-sm font-semibold">Settings</div>
          </Link>
        </div>
      </aside>

      <section className="space-y-6">
        {active === "dashboard" ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
            <div className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">Recent Webinars</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Latest webinar activity</h2>
                  <p className="mt-2 text-sm text-[#6B7280]">Updated {formatDateTime(latestUpdate)}.</p>
                </div>
                <button type="button" onClick={() => setActive("webinars")} className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]">
                  View all webinars
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {webinars.slice(0, 5).map((webinar) => (
                  <div key={webinar.webinarId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-[#1F2A37]">{webinar.title || "(Untitled webinar)"}</p>
                      <p className="mt-1 text-xs text-[#6B7280]">/{webinar.slug} | Updated {formatDateTime(webinar.updatedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/webinars/${webinar.webinarId}`} className="rounded-lg bg-[#2F6FA3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3E82BD]">Edit</Link>
                      <Link href={`/admin/webinars/${webinar.webinarId}/preview`} className="rounded-lg border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]">Preview</Link>
                    </div>
                  </div>
                ))}
                {webinars.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E6EDF3] bg-[#F8FBFF] px-4 py-8 text-sm text-[#6B7280]">No webinars yet. Create your first webinar to start using the dashboard.</div> : null}
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">Quick Actions</p>
                <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Move faster</h2>
                <div className="mt-5 grid gap-3">
                  <QuickAction title="Create webinar" description="Set up a new registration and live experience." href="/admin/webinars/new" variant="primary" />
                  <QuickAction title="Open activity log" description="Review scheduled, live, and completed webinar sessions." onClick={() => setActive("activity-log")} />
                  <QuickAction title="Open live monitor" description="Inspect active sessions, viewers, and real-time chat." onClick={() => setActive("live-monitor")} />
                  <QuickAction title="View registrants" description="Filter attendee records by webinar and date." onClick={() => setActive("registrants")} variant="accent" />
                </div>
              </section>
              <section className="rounded-2xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-[#6B7280]">System Status</p>
                <h2 className="mt-2 text-xl font-semibold text-[#1F2A37]">Readiness snapshot</h2>
                <div className="mt-5 space-y-3">
                  <StatusRow label="Live sessions" value={activeSessions.length ? `${activeSessions.length} running` : "No live sessions"} />
                  <StatusRow label="Upcoming webinars" value={`${scheduledRows.filter((row) => row.status !== "Completed").length} tracked`} />
                  <StatusRow label="Latest update" value={formatDateTime(latestUpdate)} />
                  <StatusRow label="Registrants requiring follow-up" value={`${Math.max(registrants.length - attendedCount, 0)} not yet attended`} />
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {active === "scheduled-webinars" ? (
          <section className="rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
            <div className="border-b border-[#E6EDF3] bg-[#F8FBFF] px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1F2A37]">Scheduled Webinars</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Upcoming and currently live webinars sorted by nearest scheduled time.</p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F8FBFF] text-left text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Webinar Name</th>
                    <th className="px-6 py-3 font-semibold">Scheduled Date</th>
                    <th className="px-6 py-3 font-semibold">Scheduled Time</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Registrants</th>
                    <th className="px-6 py-3 font-semibold">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledRows.map((row) => {
                    const date = new Date(row.scheduledAtISO);
                    const isExpanded = expandedScheduledId === row.webinarId;
                    return (
                      <>
                        <tr key={row.webinarId} className="border-t border-[#E6EDF3]">
                          <td className="px-6 py-4"><div className="font-medium text-[#1F2A37]">{row.webinarTitle}</div><div className="font-mono text-xs text-[#6B7280]">/{row.webinarSlug}</div></td>
                          <td className="px-6 py-4 text-[#6B7280]">{new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: row.scheduleTimeZone }).format(date)}</td>
                          <td className="px-6 py-4 text-[#6B7280]">{new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: row.scheduleTimeZone }).format(date)} <span className="text-xs text-[#9CA3AF]">{row.scheduleTimeZone}</span></td>
                          <td className="px-6 py-4"><StatusPill status={row.status} /></td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => setExpandedScheduledId((current) => (current === row.webinarId ? null : row.webinarId))}
                              className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]"
                            >
                              {row.registrants.length} registrant{row.registrants.length === 1 ? "" : "s"}
                            </button>
                          </td>
                          <td className="px-6 py-4"><Link href={`/admin/webinars/${row.webinarId}`} className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]">Open webinar</Link></td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-t border-[#E6EDF3] bg-[#FCFDFE]">
                            <td className="px-6 py-5" colSpan={6}>
                              <div className="overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white">
                                <div className="border-b border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold text-[#1F2A37]">Registrant Details</div>
                                <table className="min-w-full text-sm">
                                  <thead className="bg-white text-left text-[#6B7280]">
                                    <tr>
                                      <th className="px-4 py-3 font-semibold">Full Name</th>
                                      <th className="px-4 py-3 font-semibold">Email Address</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.registrants.map((registrant) => (
                                      <tr key={registrant.registrationId} className="border-t border-[#E6EDF3]">
                                        <td className="px-4 py-3 text-[#1F2A37]">{registrant.fullName}</td>
                                        <td className="px-4 py-3 text-[#6B7280]">{registrant.email || "-"}</td>
                                      </tr>
                                    ))}
                                    {row.registrants.length === 0 ? (
                                      <tr>
                                        <td className="px-4 py-3 text-[#6B7280]" colSpan={2}>No registrants yet for this session.</td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    );
                  })}
                  {scheduledRows.length === 0 ? <tr><td className="px-6 py-8 text-[#6B7280]" colSpan={6}>No scheduled webinars found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {active === "activity-log" ? (
          <section className="rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
            <div className="border-b border-[#E6EDF3] bg-[#F8FBFF] px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1F2A37]">Activity Log</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Track scheduled, live, and completed webinar sessions plus attendance data.</p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F8FBFF] text-left text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Webinar Name</th>
                    <th className="px-6 py-3 font-semibold">Webinar Scheduled</th>
                    <th className="px-6 py-3 font-semibold">Webinar Started</th>
                    <th className="px-6 py-3 font-semibold">Webinar Completed</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Registrants</th>
                    <th className="px-6 py-3 font-semibold">Attended</th>
                    <th className="px-6 py-3 font-semibold">No-Show</th>
                  </tr>
                </thead>
                <tbody>
	                  {activityRows.map((row) => (
	                    <ActivityRow
	                      key={row.id}
	                      row={row}
	                      expanded={expandedActivityId === row.id}
	                      onToggle={() => setExpandedActivityId((current) => (current === row.id ? null : row.id))}
                        onCopy={copyText}
                        getConfirmationLink={getConfirmationLink}
                        getLiveLink={getLiveLink}
	                    />
	                  ))}
                  {activityRows.length === 0 ? <tr><td className="px-6 py-8 text-[#6B7280]" colSpan={8}>No webinar activity has been recorded yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {active === "live-monitor" ? <AdminLiveMonitor sessions={activeSessions} viewers={activeViewers} /> : null}
        {active === "webinars" ? <WebinarTable webinars={webinars} /> : null}

        {active === "registrants" ? (
          <section className="rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
            <div className="border-b border-[#E6EDF3] bg-[#F8FBFF] px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1F2A37]">Registrants</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Filter by webinar and date range. Includes live attendance status.</p>
            </div>
            <div className="grid gap-4 border-b border-[#E6EDF3] px-6 py-5 md:grid-cols-4">
              <label className="text-sm text-[#1F2A37]">Webinar
                <select value={selectedWebinar} onChange={(e) => setSelectedWebinar(e.target.value)} className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20">
                  {webinarOptions.map((opt) => <option key={opt} value={opt}>{opt === "all" ? "All webinars" : opt}</option>)}
                </select>
              </label>
              <label className="text-sm text-[#1F2A37]">Date from
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20" />
              </label>
              <label className="text-sm text-[#1F2A37]">Date to
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20" />
              </label>
              <label className="text-sm text-[#1F2A37]">Sort status
                <select value={statusSort} onChange={(e) => setStatusSort(e.target.value as "default" | "status-asc" | "status-desc")} className="mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm text-[#1F2A37] outline-none focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20">
                  <option value="default">Default</option>
                  <option value="status-asc">Watching -&gt; Attended -&gt; No-show -&gt; Registered</option>
                  <option value="status-desc">Registered -&gt; No-show -&gt; Attended -&gt; Watching</option>
                </select>
              </label>
              <div className="flex items-end gap-3">
                <button type="button" onClick={() => { setSelectedWebinar("all"); setDateFrom(""); setDateTo(""); setStatusSort("default"); }} className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]">Reset</button>
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
                    <th className="px-6 py-3 font-semibold">Links</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRegistrants.map((row) => (
                    <tr key={row.registrationId} className="border-t border-[#E6EDF3]">
                      <td className="px-6 py-4"><div className="font-medium text-[#1F2A37]">{row.fullName}</div><div className="text-xs text-[#6B7280]">{row.email || "-"}</div></td>
                      <td className="px-6 py-4"><div className="font-medium text-[#1F2A37]">{row.webinarTitle}</div>{row.webinarSlug ? <div className="font-mono text-xs text-[#6B7280]">/{row.webinarSlug}</div> : null}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{row.createdAt ? toDateInputValue(row.createdAt) : "-"}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{row.watchedMinutesEstimate !== null ? `${row.watchedMinutesEstimate} min` : "-"}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!row.accessToken}
                            onClick={() => copyText(getConfirmationLink(row.accessToken) ?? "", "Confirmation link copied")}
                            className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Copy Confirm
                          </button>
                          <button
                            type="button"
                            disabled={!row.accessToken}
                            onClick={() => copyText(getLiveLink(row.accessToken) ?? "", "Live link copied")}
                            className="rounded-xl border border-[#F58220] bg-white px-3 py-1.5 text-xs font-semibold text-[#F58220] hover:bg-[#FFF4EA] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Copy Live
                          </button>
                          {!row.accessToken ? <span className="text-xs text-[#9CA3AF]">Unavailable for older registrations</span> : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {row.isWatchingNow ? (
                          <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">
                            Watching now
                          </span>
                        ) : getRegistrantLifecycleStatus(row, viewNowMs) === "Attended" ? (
                          <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">
                            Attended
                          </span>
                        ) : getRegistrantLifecycleStatus(row, viewNowMs) === "No-show" ? (
                          <span className="rounded-full bg-[#FFF4EA] px-3 py-1 text-xs font-medium text-[#F58220]">
                            No-show
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#4B5563]">
                            Registered
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {row.attendedLive ? <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">Attended {row.attendedAtISO ? `(${toDateInputValue(row.attendedAtISO)})` : ""}</span> : <span className="rounded-full bg-[#FFE7D1] px-3 py-1 text-xs font-medium text-[#F58220]">Not yet</span>}
                        {row.isWatchingNow ? <div className="mt-2"><span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-medium text-[#2F6FA3]">Watching now</span></div> : null}
                      </td>
                    </tr>
                  ))}
                  {filteredRegistrants.length === 0 ? <tr><td className="px-6 py-8 text-[#6B7280]" colSpan={7}>No registrants found for the current filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
      {message ? <div className="fixed bottom-6 right-6 rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm font-medium text-[#1F2A37] shadow-lg">{message}</div> : null}
    </div>
  );
}

function ActivityRow({
  row,
  expanded,
  onToggle,
  onCopy,
  getConfirmationLink,
  getLiveLink,
}: {
  row: ActivityLogRow;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (value: string, successLabel: string) => Promise<void>;
  getConfirmationLink: (token: string | null) => string | null;
  getLiveLink: (token: string | null) => string | null;
}) {
  const countLabel = row.status === "Scheduled" ? "registrant" : "viewer";
  const countValue = row.status === "Scheduled" ? row.totalRegistrants : row.totalViewers;
  return (
    <>
      <tr className="border-t border-[#E6EDF3]">
        <td className="px-6 py-4"><div className="font-medium text-[#1F2A37]">{row.webinarTitle}</div><div className="font-mono text-xs text-[#6B7280]">/{row.webinarSlug}</div></td>
        <td className="px-6 py-4 text-[#6B7280]">{formatDateTime(row.scheduledAtISO)}</td>
        <td className="px-6 py-4 text-[#6B7280]">{formatDateTime(row.startedAtISO)}</td>
        <td className="px-6 py-4 text-[#6B7280]">{formatDateTime(row.completedAtISO)}</td>
        <td className="px-6 py-4"><StatusPill status={row.status} /></td>
        <td className="px-6 py-4"><button type="button" onClick={onToggle} className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF]">{countValue} {countLabel}{countValue === 1 ? "" : "s"}</button></td>
        <td className="px-6 py-4 text-[#6B7280]">{row.totalAttended}</td>
        <td className="px-6 py-4 text-[#6B7280]">{row.totalNoShows}</td>
      </tr>
      {expanded ? (
        <tr className="border-t border-[#E6EDF3] bg-[#FCFDFE]">
          <td className="px-6 py-5" colSpan={8}>
            <div className="overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white">
              <div className="border-b border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold text-[#1F2A37]">Registrant Details</div>
	              <table className="min-w-full text-sm">
	                <thead className="bg-white text-left text-[#6B7280]">
	                  <tr>
	                    <th className="px-4 py-3 font-semibold">Full Name</th>
	                    <th className="px-4 py-3 font-semibold">Email Address</th>
	                    <th className="px-4 py-3 font-semibold">Status</th>
	                    <th className="px-4 py-3 font-semibold">Duration Attended</th>
                        <th className="px-4 py-3 font-semibold">Links</th>
	                  </tr>
	                </thead>
	                <tbody>
	                  {row.viewers.map((viewer) => (
	                    <tr key={viewer.registrationId} className="border-t border-[#E6EDF3]">
	                      <td className="px-4 py-3 text-[#1F2A37]">{viewer.fullName}</td>
	                      <td className="px-4 py-3 text-[#6B7280]">{viewer.email || "-"}</td>
	                      <td className="px-4 py-3 text-[#6B7280]">{viewer.status}</td>
	                      <td className="px-4 py-3 text-[#6B7280]">{viewer.watchedMinutes !== null ? `${viewer.watchedMinutes} min` : "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!viewer.accessToken || viewer.status !== "Registered"}
                                onClick={() =>
                                  onCopy(
                                    getConfirmationLink(viewer.accessToken) ?? "",
                                    "Confirmation link copied"
                                  )
                                }
                                className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] hover:bg-[#F0F7FF] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Copy Confirm
                              </button>
                              <button
                                type="button"
                                disabled={!viewer.accessToken || viewer.status !== "Registered"}
                                onClick={() =>
                                  onCopy(getLiveLink(viewer.accessToken) ?? "", "Live link copied")
                                }
                                className="rounded-xl border border-[#F58220] bg-white px-3 py-1.5 text-xs font-semibold text-[#F58220] hover:bg-[#FFF4EA] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Copy Live
                              </button>
                              {!viewer.accessToken ? (
                                <span className="text-xs text-[#9CA3AF]">Unavailable for older registrations</span>
                              ) : null}
                            </div>
                          </td>
	                    </tr>
	                  ))}
	                </tbody>
              </table>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function QuickAction({ title, description, href, onClick, variant = "secondary" }: { title: string; description: string; href?: string; onClick?: () => void; variant?: "primary" | "secondary" | "accent" }) {
  const className = variant === "primary"
    ? "border-[#2F6FA3] bg-[#2F6FA3] text-white hover:bg-[#3E82BD]"
    : variant === "accent"
    ? "border-[#F58220] bg-[#F58220] text-white hover:bg-[#E46F12]"
    : "border-[#E6EDF3] bg-white text-[#1F2A37] hover:bg-[#F8FBFF]";
  const content = <><div className="text-sm font-semibold">{title}</div><div className={`mt-1 text-xs ${variant === "secondary" ? "text-[#6B7280]" : "text-white/85"}`}>{description}</div></>;
  if (href) return <Link href={href} className={`rounded-2xl border px-4 py-4 text-left transition ${className}`}>{content}</Link>;
  return <button type="button" onClick={onClick} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${className}`}>{content}</button>;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3"><span className="text-sm text-[#6B7280]">{label}</span><span className="text-sm font-medium text-[#1F2A37]">{value}</span></div>;
}

function StatusPill({ status }: { status: "Scheduled" | "Live" | "Completed" }) {
  const className = status === "Live" ? "bg-[#E8F5FF] text-[#2F6FA3]" : status === "Completed" ? "bg-[#FFF4EA] text-[#F58220]" : "bg-[#F3F4F6] text-[#4B5563]";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>{status}</span>;
}
