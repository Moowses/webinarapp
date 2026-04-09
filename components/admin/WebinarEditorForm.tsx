"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminErrorToast from "@/components/admin/ui/AdminErrorToast";
import AdminLoadingModal from "@/components/admin/ui/AdminLoadingModal";
import AdminSection from "@/components/admin/ui/AdminSection";
import AdminStickySaveBar from "@/components/admin/ui/AdminStickySaveBar";
import AdminSuccessToast from "@/components/admin/ui/AdminSuccessToast";

type WebinarFormData = {
  webinarId?: string;
  title: string;
  slug: string;
  videoPublicPath: string;
  durationSec: number;
  lateGraceMinutes: number;
  schedule: {
    timezoneBase: string;
    daysOfWeek: number[];
    times: string[];
    dayTimes?: Array<{ dayOfWeek: number; time: string }>;
    liveWindowMinutes: number;
  };
  webhook: {
    enabled: boolean;
    url: string;
  };
  redirect: {
    enabled: boolean;
    url: string;
  };
  bot: {
    enabled: boolean;
    name: string;
    link: string;
    apiKey: string;
    conversationId: string;
    activationDelaySec: number;
  };
};

type Props = {
  mode: "create" | "edit";
  initial: WebinarFormData;
  submitLabel: string;
  action: (formData: FormData) => Promise<{ ok: true; webinarId?: string }>;
  updatedAt?: string | null;
};

const weekdayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const inputClass =
  "mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20 disabled:cursor-not-allowed disabled:opacity-60";

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeFilename(filename: string): string {
  return filename
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSuggestedPath(input: {
  fileName: string;
  slug: string;
  webinarId?: string;
}): string {
  const folder = sanitizeSegment(input.webinarId || input.slug || "draft");
  const name = sanitizeFilename(input.fileName || "video.mp4");
  return `/uploads/webinars/${folder}/${name}`;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export default function WebinarEditorForm({
  mode,
  initial,
  submitLabel,
  action,
  updatedAt,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [videoPublicPath, setVideoPublicPath] = useState(initial.videoPublicPath);
  const [durationSec, setDurationSec] = useState(String(initial.durationSec));
  const [lateGraceMinutes, setLateGraceMinutes] = useState(String(initial.lateGraceMinutes));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [webhookEnabled, setWebhookEnabled] = useState(initial.webhook.enabled);
  const [webhookUrl, setWebhookUrl] = useState(initial.webhook.url);
  const [redirectEnabled, setRedirectEnabled] = useState(initial.redirect.enabled);
  const [redirectUrl, setRedirectUrl] = useState(initial.redirect.url);
  const [botEnabled, setBotEnabled] = useState(initial.bot.enabled);
  const [botName, setBotName] = useState(initial.bot.name);
  const [botLink, setBotLink] = useState(initial.bot.link);
  const [botApiKey, setBotApiKey] = useState(initial.bot.apiKey);
  const [botConversationId, setBotConversationId] = useState(initial.bot.conversationId);
  const [botActivationDelaySec, setBotActivationDelaySec] = useState(
    String(initial.bot.activationDelaySec)
  );
  const [durationReadError, setDurationReadError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [sessionUploadedVideoPath, setSessionUploadedVideoPath] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initial.slug));
  const initialScheduleByDay = useMemo(() => {
    const fromEntries = (initial.schedule.dayTimes ?? []).reduce<Record<number, string>>((acc, entry) => {
      acc[entry.dayOfWeek] = entry.time;
      return acc;
    }, {});
    if (Object.keys(fromEntries).length > 0) return fromEntries;

    const fallbackTimes = initial.schedule.times.length > 0 ? initial.schedule.times : ["20:00"];
    return initial.schedule.daysOfWeek.reduce<Record<number, string>>((acc, day, index) => {
      acc[day] = fallbackTimes[Math.min(index, fallbackTimes.length - 1)] ?? "20:00";
      return acc;
    }, {});
  }, [initial.schedule.dayTimes, initial.schedule.daysOfWeek, initial.schedule.times]);
  const [selectedDays, setSelectedDays] = useState<number[]>(initial.schedule.daysOfWeek);
  const [scheduleTimesByDay, setScheduleTimesByDay] = useState<Record<number, string>>(initialScheduleByDay);

  const mustUploadFirst = Boolean(selectedFile) && uploadStatus !== "Uploaded successfully";
  const uploadButtonDisabled = !selectedFile || isUploading;
  const status = initial.slug && initial.videoPublicPath ? "Active" : "Draft";

  const suggestedPath = useMemo(() => {
    if (!selectedFile) return null;
    return buildSuggestedPath({
      fileName: selectedFile.name,
      slug,
      webinarId: initial.webinarId,
    });
  }, [initial.webinarId, selectedFile, slug]);

  useEffect(() => {
    if (!successToast && !errorToast) return;
    const timer = window.setTimeout(() => {
      setSuccessToast(null);
      setErrorToast(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [successToast, errorToast]);

  useEffect(() => {
    if (slugManuallyEdited) return;
    const nextSlug = sanitizeSegment(title);
    setSlug(nextSlug);
    if (selectedFile && uploadStatus !== "Uploaded successfully") {
      setVideoPublicPath(
        buildSuggestedPath({
          fileName: selectedFile.name,
          slug: nextSlug,
          webinarId: initial.webinarId,
        })
      );
    }
  }, [initial.webinarId, selectedFile, slugManuallyEdited, title, uploadStatus]);

  function markDirty() {
    setHasUnsavedChanges(true);
  }

  function toggleScheduleDay(dayOfWeek: number, checked: boolean) {
    setSelectedDays((current) => {
      if (checked) {
        return [...new Set([...current, dayOfWeek])].sort((a, b) => a - b);
      }
      return current.filter((day) => day !== dayOfWeek);
    });
    setScheduleTimesByDay((current) => {
      if (checked) {
        return {
          ...current,
          [dayOfWeek]: current[dayOfWeek] || initialScheduleByDay[dayOfWeek] || initial.schedule.times[0] || "20:00",
        };
      }
      const next = { ...current };
      delete next[dayOfWeek];
      return next;
    });
    markDirty();
  }

  function updateScheduleDayTime(dayOfWeek: number, value: string) {
    setScheduleTimesByDay((current) => ({
      ...current,
      [dayOfWeek]: value,
    }));
    markDirty();
  }

  function readVideoDuration(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = objectUrl;
    video.onloadedmetadata = () => {
      const duration = Math.ceil(video.duration);
      if (Number.isFinite(duration) && duration > 0) {
        setDurationSec(String(duration));
        setDurationReadError(null);
      } else {
        setDurationReadError("Unable to read duration");
      }
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => {
      setDurationReadError("Unable to read duration");
      URL.revokeObjectURL(objectUrl);
    };
  }

  function onFileSelect(file: File | null) {
    setSelectedFile(file);
    setUploadStatus(null);
    setUploadProgress(0);
    setDurationReadError(null);
    markDirty();

    if (!file) return;

    setVideoPublicPath(
      buildSuggestedPath({
        fileName: file.name,
        slug,
        webinarId: initial.webinarId,
      })
    );
    readVideoDuration(file);
  }

  async function uploadVideo(): Promise<string | null> {
    if (!selectedFile) return null;
    if (!initial.webinarId && !sanitizeSegment(slug)) {
      setErrorToast("Enter a slug before uploading the video.");
      return null;
    }

    setLoadingMessage("Uploading video...");
    setIsUploading(true);
    setUploadStatus("Uploading video...");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (initial.webinarId) {
      formData.append("webinarId", initial.webinarId);
    } else {
      formData.append("slug", slug);
    }

    try {
      const payload = await uploadVideoWithProgress(formData, (progress) => {
        setUploadProgress(progress);
      });
      setVideoPublicPath(payload.publicPath);
      setSessionUploadedVideoPath(payload.publicPath);
      setUploadStatus("Video uploaded successfully");
      setSuccessToast("Video uploaded successfully");
      setSelectedFile(null);
      setHasUnsavedChanges(true);
      return payload.publicPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadStatus(message);
      setErrorToast(message);
      return null;
    } finally {
      setIsUploading(false);
      setLoadingMessage(null);
    }
  }

  async function handleSave() {
    if (!formRef.current) return;
    if (isUploading) {
      setErrorToast("Wait for the video upload to finish before saving.");
      return;
    }

    let uploadedPathForSave: string | null = null;
    if (mustUploadFirst) {
      uploadedPathForSave = await uploadVideo();
      if (!uploadedPathForSave) return;
    }

    setIsSaving(true);
    setLoadingMessage(mode === "create" ? "Creating webinar..." : "Saving webinar...");
    setErrorToast(null);

    try {
      const formData = new FormData(formRef.current);
      formData.set("videoPublicPath", uploadedPathForSave || videoPublicPath);
      const result = await action(formData);
      setSessionUploadedVideoPath(null);
      setHasUnsavedChanges(false);
      setSuccessToast(mode === "create" ? "Webinar created successfully" : "Webinar saved successfully");
      if (mode === "create" && result.webinarId) {
        router.push(`/admin/webinars/${result.webinarId}?saved=1`);
        router.refresh();
      }
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
      setLoadingMessage(null);
    }
  }

  async function handleCancel() {
    const shouldDeleteUploadedDraft =
      Boolean(sessionUploadedVideoPath) && sessionUploadedVideoPath !== initial.videoPublicPath;

    if (shouldDeleteUploadedDraft) {
      setLoadingMessage("Deleting uploaded draft video...");
      try {
        await deleteUploadedVideo(sessionUploadedVideoPath as string);
        setSessionUploadedVideoPath(null);
      } catch (error) {
        setLoadingMessage(null);
        setErrorToast(error instanceof Error ? error.message : "Failed to delete uploaded draft video");
        return;
      }
      setLoadingMessage(null);
    }

    window.location.reload();
  }

  const topActions = (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isUploading}
        className="rounded-xl bg-[#2F6FA3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Saving..." : submitLabel}
      </button>
      <a
        href={initial.webinarId ? `/admin/webinars/${initial.webinarId}/preview` : "#"}
        className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
        onClick={(event) => {
          if (!initial.webinarId) {
            event.preventDefault();
            setErrorToast("Save the webinar first before opening preview mode.");
          }
        }}
      >
        Preview
      </a>
      <Link
        href="/admin"
        className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
      >
        Back
      </Link>
    </div>
  );

  return (
    <>
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-6" onChangeCapture={markDirty}>
        <section className="rounded-3xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Webinar Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#1F2A37]">
                Webinar: {initial.slug || initial.title || "Untitled"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#6B7280]">
                <span className="rounded-full border border-[#E6EDF3] bg-[#E8F5FF] px-3 py-1 text-[#2F6FA3]">
                  Status: {status}
                </span>
                <span className="rounded-full border border-[#E6EDF3] bg-[#F8FBFF] px-3 py-1">
                  Updated: {formatUpdatedAt(updatedAt)}
                </span>
              </div>
            </div>
            {topActions}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
          <div className="space-y-6">
            <AdminSection title="Basic Info" description="Core webinar metadata and public access fields." accent="bg-[#2F6FA3]">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm text-[#1F2A37]">
                  Title
                  <input
                    name="title"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  Slug
                  <input
                    name="slug"
                    required
                    value={slug}
                    onChange={(event) => {
                      const nextSlug = event.target.value;
                      setSlugManuallyEdited(true);
                      setSlug(nextSlug);
                      if (selectedFile && uploadStatus !== "Uploaded successfully") {
                        setVideoPublicPath(
                          buildSuggestedPath({
                            fileName: selectedFile.name,
                            slug: nextSlug,
                            webinarId: initial.webinarId,
                          })
                        );
                      }
                    }}
                    className={inputClass}
                  />
                </label>
              </div>
            </AdminSection>

            <AdminSection title="Video" description="Upload, replace, and validate the webinar video." accent="bg-[#F58220]">
              <div
                className={`rounded-2xl border border-dashed p-5 transition ${
                  isDragActive ? "border-[#2F6FA3] bg-[#F0F7FF]" : "border-[#E6EDF3] bg-[#F8FBFF]"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                  onFileSelect(event.dataTransfer.files?.[0] ?? null);
                }}
              >
	                <div className="flex flex-wrap items-center justify-between gap-4">
	                  <div>
	                    <p className="text-sm font-semibold text-[#1F2A37]">Video Upload</p>
	                    <p className="mt-1 text-sm text-[#6B7280]">
	                      Drag and drop an MP4/WebM/MOV file or browse from your computer.
	                    </p>
	                    <p className="mt-2 text-xs text-[#6B7280]">
	                      Maximum upload size: 1 GB. If your video is larger than 1 GB, compress it before uploading.
	                    </p>
	                  </div>
	                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
                  >
                    Choose File
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                  onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
                  className="hidden"
                />

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#E6EDF3] bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Selected File</p>
                    <p className="mt-2 text-sm text-[#1F2A37]">{selectedFile?.name ?? "No file selected"}</p>
                    {suggestedPath ? (
                      <p className="mt-2 text-xs text-[#6B7280]">Suggested path: {suggestedPath}</p>
                    ) : null}
                    {durationReadError ? <p className="mt-2 text-xs text-[#F58220]">{durationReadError}</p> : null}
                  </div>

                  <label className="block text-sm text-[#1F2A37]">
                    Video Public Path
                    <input
                      name="videoPublicPath"
                      value={videoPublicPath}
                      onChange={(event) => setVideoPublicPath(event.target.value)}
                      placeholder="/uploads/webinars/slug/video.mp4 (optional while drafting)"
                      className={inputClass}
                    />
                  </label>
                </div>

                {isUploading || uploadProgress > 0 || uploadStatus === "Video uploaded successfully" ? (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-[#6B7280]">
                      <span>
                        {isUploading
                          ? "Uploading video..."
                          : uploadStatus === "Video uploaded successfully"
                          ? "Upload complete"
                          : "Upload status"}
                      </span>
                      <span>{uploadStatus === "Video uploaded successfully" ? "100%" : `${uploadProgress}%`}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#E6EDF3]">
                      <div
                        className="h-full rounded-full bg-[#F58220] transition-all"
                        style={{
                          width: `${uploadStatus === "Video uploaded successfully" ? 100 : uploadProgress}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={uploadVideo}
                    disabled={uploadButtonDisabled}
                    className="rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading ? "Uploading..." : "Upload Video"}
                  </button>
                  {uploadStatus ? (
                    <span
                      className={`text-sm font-medium ${
                        uploadStatus === "Video uploaded successfully" ? "text-[#2F6FA3]" : "text-[#6B7280]"
                      }`}
                    >
                      {uploadStatus}
                    </span>
                  ) : null}
                  {!selectedFile && videoPublicPath ? (
                    <span className="rounded-full bg-[#E8F5FF] px-3 py-1 text-xs font-semibold text-[#2F6FA3]">
                      Video ready
                    </span>
                  ) : null}
                </div>
              </div>
            </AdminSection>

            <AdminSection title="Automation" description="Control webhook delivery for external workflows." accent="bg-[#2F6FA3]">
              <input type="hidden" name="webhook.enabled" value="false" />
              <label className="inline-flex items-center gap-3 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-sm text-[#1F2A37]">
                <input
                  type="checkbox"
                  name="webhook.enabled"
                  value="true"
                  checked={webhookEnabled}
                  onChange={(event) => setWebhookEnabled(event.target.checked)}
                />
                Webhook enabled
              </label>
              <label className="mt-5 block text-sm text-[#1F2A37]">
                Webhook URL
                <input
                  name="webhook.url"
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  required={webhookEnabled}
                  placeholder="https://hooks.zapier.com/..."
                  className={inputClass}
                />
                <span className="mt-2 block text-xs text-[#6B7280]">POST registration payloads to Zapier or GHL.</span>
              </label>
            </AdminSection>

            <AdminSection title="Schedule" description="Configure local-time sessions and live access windows." accent="bg-[#F58220]">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="text-sm text-[#1F2A37]">
                  Registrant Local Time
                  <input
                    value="Uses each registrant's own timezone"
                    readOnly
                    className={`${inputClass} cursor-not-allowed opacity-80`}
                  />
                  <input type="hidden" name="schedule.timezoneBase" value={initial.schedule.timezoneBase} />
                  <p className="mt-2 text-xs text-[#6B7280]">
                    Each registrant sees the webinar at the selected local time in their own timezone.
                  </p>
                </div>

                <label className="block text-sm text-[#1F2A37]">
                  Live Window (minutes)
                  <input
                    name="schedule.liveWindowMinutes"
                    type="number"
                    min={1}
                    required
                    defaultValue={initial.schedule.liveWindowMinutes}
                    className={inputClass}
                  />
                </label>
              </div>

              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-[#1F2A37]">Days</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {weekdayOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-3 py-2 text-sm text-[#1F2A37]"
                    >
                      <input
                        type="checkbox"
                        name="schedule.daysOfWeek"
                        value={String(opt.value)}
                        checked={selectedDays.includes(opt.value)}
                        onChange={(event) => toggleScheduleDay(opt.value, event.target.checked)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-5 space-y-4">
                <div className="text-sm font-medium text-[#1F2A37]">Schedule times by day</div>
                {selectedDays.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedDays.map((dayOfWeek) => {
                      const option = weekdayOptions.find((item) => item.value === dayOfWeek);
                      return (
                        <label key={dayOfWeek} className="block text-sm text-[#1F2A37]">
                          {option?.label ?? `Day ${dayOfWeek}`} time
                          <input
                            type="time"
                            name={`schedule.dayTimes.${dayOfWeek}`}
                            required
                            value={scheduleTimesByDay[dayOfWeek] ?? ""}
                            onChange={(event) => updateScheduleDayTime(dayOfWeek, event.target.value)}
                            className={inputClass}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-sm text-[#6B7280]">
                    Select at least one day to assign a local start time.
                  </div>
                )}
              </div>
            </AdminSection>
          </div>

          <div className="space-y-6">
            <AdminSection title="AI Chat Bot" description="Configure automated responses during the session." accent="bg-[#2F6FA3]">
              <input type="hidden" name="bot.enabled" value="false" />
              <label className="inline-flex items-center gap-3 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-sm text-[#1F2A37]">
                <input
                  type="checkbox"
                  name="bot.enabled"
                  value="true"
                  checked={botEnabled}
                  onChange={(event) => setBotEnabled(event.target.checked)}
                />
                Enable AI chat bot
              </label>

              <div className="mt-5 grid gap-5">
                <label className="block text-sm text-[#1F2A37]">
                  Bot Name
                  <input
                    name="bot.name"
                    value={botName}
                    onChange={(event) => setBotName(event.target.value)}
                    required={botEnabled}
                    placeholder="Alex"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  Bot Link
                  <input
                    name="bot.link"
                    type="url"
                    value={botLink}
                    onChange={(event) => setBotLink(event.target.value)}
                    placeholder="https://your-bot.example.com"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  API Key
                  <input
                    name="bot.apiKey"
                    value={botApiKey}
                    onChange={(event) => setBotApiKey(event.target.value)}
                    required={botEnabled}
                    placeholder="sk-..."
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  Conversation ID
                  <input
                    name="bot.conversationId"
                    value={botConversationId}
                    onChange={(event) => setBotConversationId(event.target.value)}
                    required={botEnabled}
                    placeholder="conversation-id"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  Delay (seconds)
                  <input
                    name="bot.activationDelaySec"
                    type="number"
                    min={1}
                    value={botActivationDelaySec}
                    onChange={(event) => setBotActivationDelaySec(event.target.value)}
                    required={botEnabled}
                    className={inputClass}
                  />
                </label>
              </div>
            </AdminSection>

            <AdminSection title="Advanced" description="Handle duration, late joins, and post-webinar redirects." accent="bg-[#F58220]">
              <div className="grid gap-5">
                <label className="block text-sm text-[#1F2A37]">
                  Duration (seconds)
                  <input
                    name="durationSec"
                    type="number"
                    min={1}
                    required
                    value={durationSec}
                    onChange={(event) => setDurationSec(event.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  Late Join Grace (minutes)
                  <input
                    name="lateGraceMinutes"
                    type="number"
                    min={1}
                    required
                    value={lateGraceMinutes}
                    onChange={(event) => setLateGraceMinutes(event.target.value)}
                    className={inputClass}
                  />
                </label>

                <input type="hidden" name="redirect.enabled" value="false" />
                <label className="inline-flex items-center gap-3 rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-3 text-sm text-[#1F2A37]">
                  <input
                    type="checkbox"
                    name="redirect.enabled"
                    value="true"
                    checked={redirectEnabled}
                    onChange={(event) => setRedirectEnabled(event.target.checked)}
                  />
                  Redirect after webinar ends
                </label>

                <label className="block text-sm text-[#1F2A37]">
                  Redirect URL
                  <input
                    name="redirect.url"
                    type="url"
                    value={redirectUrl}
                    onChange={(event) => setRedirectUrl(event.target.value)}
                    required={redirectEnabled}
                    placeholder="https://your-offer.example.com/thank-you"
                    className={inputClass}
                  />
                </label>
              </div>
            </AdminSection>
          </div>
        </div>
      </form>

	      <AdminLoadingModal
	        open={Boolean(loadingMessage)}
	        message={loadingMessage ?? ""}
	        progress={isUploading ? uploadProgress : null}
	        progressLabel={isUploading ? uploadStatus || "Uploading video..." : null}
	      />
      <AdminSuccessToast message={successToast} />
      <AdminErrorToast message={errorToast} />
      <AdminStickySaveBar
        visible={hasUnsavedChanges}
        saving={isSaving}
        disabled={isUploading}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </>
  );
}

function uploadVideoWithProgress(
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<{ publicPath: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload-video");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.max(5, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}") as {
          publicPath?: string;
          error?: string;
        };
        if (xhr.status < 200 || xhr.status >= 300 || !payload.publicPath) {
          reject(new Error(payload.error || "Upload failed"));
          return;
        }
        onProgress(100);
        resolve({ publicPath: payload.publicPath });
      } catch {
        reject(new Error("Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

async function deleteUploadedVideo(publicPath: string): Promise<void> {
  const response = await fetch("/api/admin/delete-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicPath }),
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Failed to delete uploaded video");
  }
}
