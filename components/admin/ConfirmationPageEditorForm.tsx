"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminErrorToast from "@/components/admin/ui/AdminErrorToast";
import AdminLoadingModal from "@/components/admin/ui/AdminLoadingModal";
import AdminSection from "@/components/admin/ui/AdminSection";
import AdminStickySaveBar from "@/components/admin/ui/AdminStickySaveBar";
import AdminSuccessToast from "@/components/admin/ui/AdminSuccessToast";
import type { WebinarConfirmationPageConfig } from "@/types/webinar";

type Props = {
  webinarId: string;
  webinarTitle: string;
  webinarSlug: string;
  initial: WebinarConfirmationPageConfig;
  action: (formData: FormData) => Promise<{ ok: true }>;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

const textareaClass = `${inputClass} min-h-[110px] resize-y`;
const colorInputClass =
  "h-11 w-14 cursor-pointer rounded-xl border border-[#E6EDF3] bg-white p-1 shadow-sm outline-none transition focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

export default function ConfirmationPageEditorForm({
  webinarId,
  webinarTitle,
  webinarSlug,
  initial,
  action,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [mediaSource, setMediaSource] = useState(initial.mediaSource);
  const [mediaType, setMediaType] = useState(initial.mediaType);
  const [mediaUrl, setMediaUrl] = useState(initial.mediaUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast && !errorToast) return;
    const timer = window.setTimeout(() => {
      setSuccessToast(null);
      setErrorToast(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [successToast, errorToast]);

  const previewHref = useMemo(() => `/confirm-preview/${webinarSlug}`, [webinarSlug]);

  async function handleSave() {
    if (!formRef.current) return;
    if (isUploading) {
      setErrorToast("Wait for the media upload to finish before saving.");
      return;
    }
    setIsSaving(true);
    setErrorToast(null);
    try {
      const formData = new FormData(formRef.current);
      await action(formData);
      setHasUnsavedChanges(false);
      setSuccessToast("Confirmation page saved successfully");
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Failed to save confirmation page");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    window.location.reload();
  }

  async function handleUploadMedia() {
    if (!selectedFile) {
      setErrorToast("Choose an image or video file first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Uploading media...");
    setErrorToast(null);

    const payload = new FormData();
    payload.append("file", selectedFile);
    payload.append("webinarId", webinarId);
    payload.append("slug", webinarSlug);

    try {
      const result = await uploadConfirmationMedia(payload, (progress) => setUploadProgress(progress));
      setMediaUrl(result.publicPath);
      setMediaType(result.mediaType === "image" ? "image" : "video");
      setUploadStatus("Media uploaded successfully");
      setSelectedFile(null);
      setHasUnsavedChanges(true);
      setSuccessToast("Confirmation media uploaded successfully");
    } catch (error) {
      setUploadStatus("Upload failed");
      setErrorToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(event) => event.preventDefault()}
        onChangeCapture={() => setHasUnsavedChanges(true)}
        className="space-y-6"
      >
        <section className="rounded-3xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Admin</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#1F2A37]">Edit Confirmation Page</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
                Configure the attendee confirmation experience for{" "}
                <span className="font-medium text-[#1F2A37]">{webinarTitle || "(Untitled webinar)"}</span>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#6B7280]">
                <span className="rounded-full border border-[#E6EDF3] bg-[#F8FBFF] px-3 py-1">
                  Slug: <span className="font-mono text-[#1F2A37]">/{webinarSlug}</span>
                </span>
                <span className="rounded-full border border-[#E6EDF3] bg-[#F8FBFF] px-3 py-1">
                  ID: <span className="font-mono text-[#1F2A37]">{webinarId}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-[#2F6FA3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
              <Link
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
              >
                Preview
              </Link>
              <Link
                href={`/admin/webinars/${webinarId}`}
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
              >
                Back
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <AdminSection title="Headline" description="Top headline and step banner." accent="bg-[#2F6FA3]">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm text-[#1F2A37]">
                  Headline
                  <textarea
                    name="confirmationPage.headline"
                    defaultValue={initial.headline}
                    rows={3}
                    className={textareaClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Step Banner Text
                  <input
                    name="confirmationPage.stepBannerText"
                    defaultValue={initial.stepBannerText}
                    className={inputClass}
                  />
                </label>
              </div>
            </AdminSection>

            <AdminSection title="Schedule Panel" description="Text and CTA content for the schedule card." accent="bg-[#F58220]">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm text-[#1F2A37]">
                  Intro Text
                  <textarea
                    name="confirmationPage.introText"
                    defaultValue={initial.introText}
                    rows={3}
                    className={textareaClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Schedule Heading
                  <textarea
                    name="confirmationPage.scheduleHeading"
                    defaultValue={initial.scheduleHeading}
                    rows={3}
                    className={textareaClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Scheduled Time Label
                  <input
                    name="confirmationPage.scheduledTimeLabel"
                    defaultValue={initial.scheduledTimeLabel}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Countdown Label
                  <input
                    name="confirmationPage.countdownLabel"
                    defaultValue={initial.countdownLabel}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Join Button Label
                  <input
                    name="confirmationPage.joinButtonLabel"
                    defaultValue={initial.joinButtonLabel}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Add To Calendar Label
                  <input
                    name="confirmationPage.addToCalendarLabel"
                    defaultValue={initial.addToCalendarLabel}
                    className={inputClass}
                  />
                </label>
              </div>
            </AdminSection>
          </div>

          <div className="space-y-6">
            <AdminSection title="Media & Layout" description="Choose whether to show a video or image and where it sits." accent="bg-[#2F6FA3]">
              <div className="grid gap-5">
                <label className="block text-sm text-[#1F2A37]">
                  Media Source
	                  <select
	                    name="confirmationPage.mediaSource"
	                    value={mediaSource}
	                    onChange={(event) => {
	                      const nextSource =
	                        event.target.value === "external" ? "external" : "self-hosted";
	                      setMediaSource(nextSource);
	                      if (nextSource === "external") {
	                        setMediaType("video");
	                      }
	                    }}
	                    className={inputClass}
	                  >
	                    <option value="self-hosted">Self-hosted Upload</option>
	                    <option value="external">YouTube / Vimeo</option>
	                  </select>
	                </label>
	                {mediaSource === "external" ? (
	                  <p className="text-xs text-[#6B7280]">
	                    External media only supports YouTube and Vimeo video links.
	                  </p>
	                ) : null}
	                <label className="block text-sm text-[#1F2A37]">
	                  Media Type
	                  <select
	                    name="confirmationPage.mediaType"
	                    value={mediaType}
	                    onChange={(event) => setMediaType(event.target.value === "image" ? "image" : "video")}
	                    className={inputClass}
	                    disabled={mediaSource === "external"}
	                  >
	                    <option value="video">Video</option>
	                    {mediaSource === "self-hosted" ? <option value="image">Image</option> : null}
	                  </select>
	                </label>
	                <label className="block text-sm text-[#1F2A37]">
	                  {mediaSource === "external" ? "YouTube or Vimeo URL" : "Media URL Override"}
	                  <input
	                    name="confirmationPage.mediaUrl"
	                    value={mediaUrl}
	                    onChange={(event) => setMediaUrl(event.target.value)}
                    placeholder={
                      mediaSource === "external"
                        ? "https://youtube.com/watch?v=... or https://vimeo.com/..."
                        : "Upload media or paste a direct file URL"
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Media Position
                  <select
                    name="confirmationPage.mediaPosition"
                    defaultValue={initial.mediaPosition}
                    className={inputClass}
                  >
                    <option value="left">Media Left</option>
                    <option value="right">Media Right</option>
                  </select>
                </label>
                {mediaSource === "self-hosted" ? (
                  <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
                    <p className="text-sm font-semibold text-[#1F2A37]">Upload Media</p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Upload an image or video for the confirmation page and fill the media URL automatically.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v,.jpg,.jpeg,.png,.webp,.gif"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F58220] file:px-3 file:py-1.5 file:text-white`}
                    />
                    {selectedFile ? (
                      <p className="mt-2 text-xs text-[#6B7280]">Selected: {selectedFile.name}</p>
                    ) : null}
                    {isUploading || uploadProgress > 0 || uploadStatus === "Media uploaded successfully" ? (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs text-[#6B7280]">
                          <span>{isUploading ? "Uploading media..." : "Upload complete"}</span>
                          <span>{uploadStatus === "Media uploaded successfully" ? "100%" : `${uploadProgress}%`}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#E6EDF3]">
                          <div
                            className="h-full rounded-full bg-[#F58220] transition-all"
                            style={{ width: `${uploadStatus === "Media uploaded successfully" ? 100 : uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleUploadMedia}
                        disabled={!selectedFile || isUploading}
                        className="rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUploading ? "Uploading..." : "Upload Media"}
                      </button>
                      {uploadStatus ? <span className="text-sm text-[#6B7280]">{uploadStatus}</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </AdminSection>

            <AdminSection title="Secondary CTA & Styling" description="Messenger button and page colors." accent="bg-[#F58220]">
              <div className="grid gap-5">
                <label className="block text-sm text-[#1F2A37]">
                  Messenger Button Label
                  <input
                    name="confirmationPage.messengerButtonLabel"
                    defaultValue={initial.messengerButtonLabel}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Messenger URL
                  <input
                    name="confirmationPage.messengerUrl"
                    defaultValue={initial.messengerUrl}
                    className={inputClass}
                  />
                </label>
                <ColorField
                  label="Headline Color"
                  name="confirmationPage.headlineColor"
                  defaultValue={initial.headlineColor}
                  placeholder="#1F2A37"
                />
                <ColorField
                  label="Banner Color"
                  name="confirmationPage.bannerColor"
                  defaultValue={initial.bannerColor}
                  placeholder="#FF1A12"
                />
                <ColorField
                  label="Primary Button Color"
                  name="confirmationPage.primaryButtonColor"
                  defaultValue={initial.primaryButtonColor}
                  placeholder="#A3A3A3"
                />
              </div>
            </AdminSection>

            <AdminCard>
              <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Preview Details</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1F2A37]">Safe confirmation preview</h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                Preview opens the confirmation page in admin-safe mode so you can validate the headline, media,
                countdown card, calendar links, and CTA styling without requiring a registrant token.
              </p>
            </AdminCard>
          </div>
        </div>
      </form>

      <AdminLoadingModal open={isSaving} message="Saving confirmation page..." />
      <AdminSuccessToast message={successToast} />
      <AdminErrorToast message={errorToast} />
      <AdminStickySaveBar
        visible={hasUnsavedChanges}
        saving={isSaving}
        disabled={false}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </>
  );
}

function uploadConfirmationMedia(
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<{ publicPath: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload-confirmation-media");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.max(5, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}") as {
          publicPath?: string;
          mediaType?: string;
          error?: string;
        };
        if (xhr.status < 200 || xhr.status >= 300 || !payload.publicPath || !payload.mediaType) {
          reject(new Error(payload.error || "Upload failed"));
          return;
        }
        onProgress(100);
        resolve({ publicPath: payload.publicPath, mediaType: payload.mediaType });
      } catch {
        reject(new Error("Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

function ColorField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue || placeholder);
  const normalizedValue = isValidHexColor(value) ? value : placeholder;

  return (
    <label className="block text-sm text-[#1F2A37]">
      {label}
      <div className="mt-1 flex items-center gap-3">
        <input
          type="color"
          value={normalizedValue}
          onChange={(event) => setValue(event.target.value)}
          className={colorInputClass}
          aria-label={label}
        />
        <input
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20"
        />
      </div>
    </label>
  );
}

function isValidHexColor(value: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value);
}
