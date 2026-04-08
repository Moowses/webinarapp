"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deleteWebinarAction,
  listWebinarsForAdminAction,
  type AdminWebinarView,
  upsertWebinarAction,
} from "@/app/actions/admin-webinar-actions";

type Props = {
  initialWebinars: AdminWebinarView[];
};

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function blankForm() {
  return {
    id: "",
    slug: "",
    title: "",
    videoPublicPath: "",
    durationSec: 600,
    scheduleType: "weekly" as const,
    scheduleLocalTime: "18:00",
    scheduleWeekday: 3,
  };
}

export default function WebinarForm({ initialWebinars }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialWebinars);
  const [selectedId, setSelectedId] = useState(initialWebinars[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(() => {
    const first = initialWebinars[0];
    if (!first) return blankForm();
    return {
      id: first.id,
      slug: first.slug,
      title: first.title,
      videoPublicPath: first.videoPublicPath,
      durationSec: first.durationSec,
      scheduleType: first.scheduleType,
      scheduleLocalTime: first.scheduleLocalTime || "18:00",
      scheduleWeekday: first.scheduleWeekday ?? 3,
    };
  });

  const selectedWebinar = useMemo(
    () => rows.find((item) => item.id === selectedId) ?? null,
    [rows, selectedId]
  );

  function hydrateFromRow(row: AdminWebinarView | null) {
    if (!row) {
      setForm(blankForm());
      return;
    }

    setForm({
      id: row.id,
      slug: row.slug,
      title: row.title,
      videoPublicPath: row.videoPublicPath,
      durationSec: row.durationSec,
      scheduleType: row.scheduleType,
      scheduleLocalTime: row.scheduleLocalTime || "18:00",
      scheduleWeekday: row.scheduleWeekday ?? 3,
    });
  }

  function refreshRows(nextSelectedId?: string) {
    startTransition(async () => {
      try {
        const latest = await listWebinarsForAdminAction();
        setRows(latest);

        if (nextSelectedId) {
          setSelectedId(nextSelectedId);
          hydrateFromRow(latest.find((x) => x.id === nextSelectedId) ?? null);
          return;
        }

        if (!latest.length) {
          setSelectedId("");
          hydrateFromRow(null);
          return;
        }

        const keepId = latest.some((x) => x.id === selectedId) ? selectedId : latest[0].id;
        setSelectedId(keepId);
        hydrateFromRow(latest.find((x) => x.id === keepId) ?? null);
      } catch {
        setError("Failed to refresh webinars.");
      }
    });
  }

  function onSelectChange(nextId: string) {
    setSelectedId(nextId);
    const row = rows.find((item) => item.id === nextId) ?? null;
    hydrateFromRow(row);
    setError(null);
    setSuccess(null);
  }

  function onCreateNew() {
    setSelectedId("");
    hydrateFromRow(null);
    setError(null);
    setSuccess(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const result = await upsertWebinarAction({
          id: form.id,
          slug: form.slug,
          title: form.title,
          videoPublicPath: form.videoPublicPath,
          durationSec: form.durationSec,
          scheduleType: form.scheduleType,
          scheduleLocalTime: form.scheduleLocalTime,
          scheduleWeekday: form.scheduleType === "weekly" ? form.scheduleWeekday : undefined,
        });

        setSuccess("Webinar saved.");
        refreshRows(result.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save webinar.";
        setError(message);
      }
    });
  }

  function onDeleteCurrent() {
    if (!selectedWebinar) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await deleteWebinarAction(selectedWebinar.id);
        setSuccess("Webinar deleted.");
        refreshRows();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete webinar.";
        setError(message);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Webinars</h2>
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
        >
          New Webinar
        </button>

        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectChange(row.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                row.id === selectedId ? "border-black bg-slate-50" : ""
              }`}
            >
              <div className="font-medium">{row.title || "(Untitled)"}</div>
              <div className="font-mono text-xs text-slate-500">{row.id}</div>
            </button>
          ))}
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-slate-500">
              No webinars yet.
            </div>
          ) : null}
        </div>
      </aside>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create / Edit Webinar</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            required
            value={form.id}
            onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))}
            placeholder="Document id (e.g. demo-webinar)"
            className="w-full rounded-lg border px-3 py-2"
          />
          <input
            required
            value={form.slug}
            onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
            placeholder="Slug (e.g. demo)"
            className="w-full rounded-lg border px-3 py-2"
          />
          <input
            required
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            placeholder="Title"
            className="w-full rounded-lg border px-3 py-2"
          />
          <input
            required
            value={form.videoPublicPath}
            onChange={(e) => setForm((s) => ({ ...s, videoPublicPath: e.target.value }))}
            placeholder="/webinars/demo/video.mp4"
            className="w-full rounded-lg border px-3 py-2"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              type="number"
              min={1}
              value={form.durationSec}
              onChange={(e) =>
                setForm((s) => ({ ...s, durationSec: Number(e.target.value || 0) }))
              }
              placeholder="Duration (seconds)"
              className="w-full rounded-lg border px-3 py-2"
            />
            <select
              value={form.scheduleType}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  scheduleType: e.target.value === "daily" ? "daily" : "weekly",
                }))
              }
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              value={form.scheduleLocalTime}
              onChange={(e) => setForm((s) => ({ ...s, scheduleLocalTime: e.target.value }))}
              placeholder="HH:mm (24h)"
              className="w-full rounded-lg border px-3 py-2"
            />
            <select
              value={form.scheduleWeekday}
              disabled={form.scheduleType !== "weekly"}
              onChange={(e) =>
                setForm((s) => ({ ...s, scheduleWeekday: Number(e.target.value) }))
              }
              className="w-full rounded-lg border px-3 py-2 disabled:bg-slate-100"
            >
              {weekdayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Webinar"}
            </button>
            <button
              type="button"
              onClick={onDeleteCurrent}
              disabled={isPending || !selectedWebinar}
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
