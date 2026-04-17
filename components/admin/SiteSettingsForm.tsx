"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminErrorToast from "@/components/admin/ui/AdminErrorToast";
import AdminLoadingModal from "@/components/admin/ui/AdminLoadingModal";
import AdminSection from "@/components/admin/ui/AdminSection";
import AdminStickySaveBar from "@/components/admin/ui/AdminStickySaveBar";
import AdminSuccessToast from "@/components/admin/ui/AdminSuccessToast";
import type { SiteSettings } from "@/lib/site-settings";
import type { SystemLogEntry } from "@/lib/system-log";

type Props = {
  initial: SiteSettings;
  logs: SystemLogEntry[];
  action: (formData: FormData) => Promise<{ ok: true }>;
  canManageUsers: boolean;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

export default function SiteSettingsForm({ initial, logs, action, canManageUsers }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const seoImageInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "logs">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState(initial.faviconUrl);
  const [seoImageUrl, setSeoImageUrl] = useState(initial.seoImageUrl);
  const [selectedFaviconFile, setSelectedFaviconFile] = useState<File | null>(null);
  const [selectedSeoImageFile, setSelectedSeoImageFile] = useState<File | null>(null);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [faviconUploadProgress, setFaviconUploadProgress] = useState(0);
  const [faviconUploadStatus, setFaviconUploadStatus] = useState<string | null>(null);
  const [isUploadingSeoImage, setIsUploadingSeoImage] = useState(false);
  const [seoImageUploadProgress, setSeoImageUploadProgress] = useState(0);
  const [seoImageUploadStatus, setSeoImageUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast && !errorToast) return;
    const timer = window.setTimeout(() => {
      setSuccessToast(null);
      setErrorToast(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [successToast, errorToast]);

  async function handleSave() {
    if (!formRef.current) return;
    if (isUploadingFavicon || isUploadingSeoImage) {
      setErrorToast("Wait for uploads to finish before saving.");
      return;
    }

    setIsSaving(true);
    setErrorToast(null);
    try {
      const formData = new FormData(formRef.current);
      await action(formData);
      setHasUnsavedChanges(false);
      setSuccessToast("Site settings saved successfully");
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Failed to save site settings");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    window.location.reload();
  }

  async function handleUploadFavicon() {
    if (!selectedFaviconFile) {
      setErrorToast("Choose a favicon file first.");
      return;
    }

    setIsUploadingFavicon(true);
    setFaviconUploadProgress(0);
    setFaviconUploadStatus("Uploading favicon...");
    setErrorToast(null);

    const payload = new FormData();
    payload.append("file", selectedFaviconFile);

    try {
      const result = await uploadFavicon(payload, (progress) => setFaviconUploadProgress(progress));
      setFaviconUrl(result.publicPath);
      setSelectedFaviconFile(null);
      setHasUnsavedChanges(true);
      setFaviconUploadStatus("Favicon uploaded successfully");
      setSuccessToast("Favicon uploaded successfully");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    } catch (error) {
      setFaviconUploadStatus("Upload failed");
      setErrorToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingFavicon(false);
    }
  }

  async function handleUploadSeoImage() {
    if (!selectedSeoImageFile) {
      setErrorToast("Choose a share image file first.");
      return;
    }

    setIsUploadingSeoImage(true);
    setSeoImageUploadProgress(0);
    setSeoImageUploadStatus("Uploading share image...");
    setErrorToast(null);

    const payload = new FormData();
    payload.append("file", selectedSeoImageFile);

    try {
      const result = await uploadSeoImage(payload, (progress) => setSeoImageUploadProgress(progress));
      setSeoImageUrl(result.publicPath);
      setSelectedSeoImageFile(null);
      setHasUnsavedChanges(true);
      setSeoImageUploadStatus("Share image uploaded successfully");
      setSuccessToast("Share image uploaded successfully");
      if (seoImageInputRef.current) seoImageInputRef.current.value = "";
    } catch (error) {
      setSeoImageUploadStatus("Upload failed");
      setErrorToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingSeoImage(false);
    }
  }

  const visibleLogs = logs.filter(
    (log) => !(log.actorType === "breakglass" && log.action === "logout")
  );

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(event) => event.preventDefault()}
        onChangeCapture={() => {
          if (activeTab === "general") setHasUnsavedChanges(true);
        }}
        className="space-y-6"
      >
        <section className="rounded-3xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#6B7280]">Admin</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#1F2A37]">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
                Manage branding assets and review system activity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "general"
                    ? "border-[#2F6FA3] bg-[#E8F5FF] text-[#1E5685]"
                    : "border-[#D7E2EC] bg-white text-[#1F2A37] hover:bg-[#F8FBFF]"
                }`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "logs"
                    ? "border-[#2F6FA3] bg-[#E8F5FF] text-[#1E5685]"
                    : "border-[#D7E2EC] bg-white text-[#1F2A37] hover:bg-[#F8FBFF]"
                }`}
              >
                System Logs
              </button>
              {canManageUsers ? (
                <Link
                  href="/admin/settings/users"
                  className="rounded-xl border border-[#D7E2EC] bg-white px-4 py-2 text-sm font-semibold text-[#1F2A37] transition hover:bg-[#F8FBFF]"
                >
                  User management
                </Link>
              ) : null}
              {activeTab === "general" ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-xl bg-[#2F6FA3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3E82BD] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              ) : null}
              <Link
                href="/admin"
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
              >
                Back
              </Link>
            </div>
          </div>
        </section>

        {activeTab === "general" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
            <div className="space-y-6">
              <AdminSection
                title="SEO"
                description="Global metadata used for search engines and social sharing."
                accent="bg-[#2F6FA3]"
              >
                <div className="grid gap-5">
                  <label className="block text-sm text-[#1F2A37]">
                    Site Title
                    <input
                      name="siteTitle"
                      defaultValue={initial.siteTitle}
                      placeholder="Online broadcast pro"
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm text-[#1F2A37]">
                    Site Description
                    <input
                      name="siteDescription"
                      defaultValue={initial.siteDescription}
                      placeholder="Online broadcast pro webinar platform"
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm text-[#1F2A37]">
                    Meta Keywords
                    <input
                      name="seoKeywords"
                      defaultValue={initial.seoKeywords}
                      placeholder="webinar, online broadcast, live training"
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm text-[#1F2A37]">
                    SEO / Share Image URL
                    <input
                      name="seoImageUrl"
                      value={seoImageUrl}
                      onChange={(event) => setSeoImageUrl(event.target.value)}
                      placeholder="/uploads/site/share-image.png"
                      className={inputClass}
                    />
                  </label>
                  <UploadPanel
                    title="Upload share image"
                    subtitle="Best for social previews: 1200x630 PNG, JPG, or WEBP."
                    inputRef={seoImageInputRef}
                    accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
                    selectedFile={selectedSeoImageFile}
                    onFileChange={(file) => setSelectedSeoImageFile(file)}
                    isUploading={isUploadingSeoImage}
                    progress={seoImageUploadProgress}
                    success={seoImageUploadStatus === "Share image uploaded successfully"}
                    status={seoImageUploadStatus}
                    onUpload={handleUploadSeoImage}
                    buttonLabel="Upload Share Image"
                  />
                </div>
              </AdminSection>

              <AdminSection
                title="Favicon"
                description="Upload a favicon for the browser tab or paste a root-relative URL."
                accent="bg-[#F58220]"
              >
                <div className="grid gap-5">
                  <label className="block text-sm text-[#1F2A37]">
                    Favicon URL
                    <input
                      name="faviconUrl"
                      value={faviconUrl}
                      onChange={(event) => setFaviconUrl(event.target.value)}
                      placeholder="/uploads/site/favicon.png"
                      className={inputClass}
                    />
                  </label>
                  <UploadPanel
                    title="Upload favicon"
                    subtitle="Allowed types: PNG, ICO, SVG, WEBP."
                    inputRef={faviconInputRef}
                    accept=".png,.ico,.svg,.webp,image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                    selectedFile={selectedFaviconFile}
                    onFileChange={(file) => setSelectedFaviconFile(file)}
                    isUploading={isUploadingFavicon}
                    progress={faviconUploadProgress}
                    success={faviconUploadStatus === "Favicon uploaded successfully"}
                    status={faviconUploadStatus}
                    onUpload={handleUploadFavicon}
                    buttonLabel="Upload Favicon"
                  />
                </div>
              </AdminSection>
            </div>

            <div className="space-y-6">
              <AdminCard>
                <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Preview</p>
                <h2 className="mt-2 text-lg font-semibold text-[#1F2A37]">Current assets</h2>
                <AssetPreview
                  label={faviconUrl || "No favicon selected"}
                  note="Save changes after upload to apply it globally."
                  imageUrl={faviconUrl}
                  imageAlt="Favicon preview"
                  imageClassName="h-12 w-12 rounded-lg border border-[#E6EDF3] bg-white object-contain p-1"
                  placeholderClassName="h-12 w-12"
                />
                <AssetPreview
                  label={seoImageUrl || "No share image selected"}
                  note="Save changes after upload to apply it to Open Graph and Twitter cards."
                  imageUrl={seoImageUrl}
                  imageAlt="SEO image preview"
                  imageClassName="h-16 w-24 rounded-lg border border-[#E6EDF3] bg-white object-cover"
                  placeholderClassName="h-16 w-24"
                />
              </AdminCard>
            </div>
          </div>
        ) : (
          <section className="rounded-3xl border border-[#E6EDF3] bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">System Logs</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1F2A37]">Recent activity and errors</h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              This includes admin actions, API failures, caught server-side errors, and browser runtime errors reported by users.
            </p>
            <div className="mt-6 max-h-[720px] space-y-3 overflow-auto pr-1">
              {visibleLogs.length ? (
                visibleLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#1F2A37]">{log.summary}</div>
                        <div className="mt-1 text-xs text-[#6B7280]">
                          {log.actorType === "breakglass" ? "Break Glass Account" : log.actorEmail || "System"}{" "}
                          • {log.action} •{" "}
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "Pending"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.actorType === "breakglass" ? (
                          <span className="rounded-full bg-[#101828] px-2.5 py-1 text-[11px] font-semibold uppercase text-white">
                            Break Glass
                          </span>
                        ) : null}
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                          log.level === "error"
                            ? "bg-[#FFF1EA] text-[#B45309]"
                            : log.level === "warn"
                              ? "bg-[#FFF7E6] text-[#B54708]"
                              : "bg-[#E8F5FF] text-[#1E5685]"
                        }`}>
                          {log.level}
                        </span>
                      </div>
                    </div>
                    {log.targetType || log.targetId ? (
                      <div className="mt-2 text-xs text-[#6B7280]">
                        Target: {[log.targetType, log.targetId].filter(Boolean).join(" / ")}
                      </div>
                    ) : null}
                    {log.details ? (
                      <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-[#6B7280]">
                        {log.details}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#D7E2EC] bg-[#F8FBFF] px-4 py-6 text-sm text-[#6B7280]">
                  No system logs yet.
                </div>
              )}
            </div>
          </section>
        )}
      </form>

      <AdminLoadingModal open={isSaving} message="Saving site settings..." />
      <AdminSuccessToast message={successToast} />
      <AdminErrorToast message={errorToast} />
      <AdminStickySaveBar
        visible={activeTab === "general" && hasUnsavedChanges}
        saving={isSaving}
        disabled={false}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </>
  );
}

function UploadPanel({
  title,
  subtitle,
  inputRef,
  accept,
  selectedFile,
  onFileChange,
  isUploading,
  progress,
  success,
  status,
  onUpload,
  buttonLabel,
}: {
  title: string;
  subtitle: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  isUploading: boolean;
  progress: number;
  success: boolean;
  status: string | null;
  onUpload: () => Promise<void>;
  buttonLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
      <p className="text-sm font-semibold text-[#1F2A37]">{title}</p>
      <p className="mt-1 text-xs text-[#6B7280]">{subtitle}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F58220] file:px-3 file:py-1.5 file:text-white`}
      />
      {selectedFile ? <p className="mt-2 text-xs text-[#6B7280]">Selected: {selectedFile.name}</p> : null}
      {isUploading || progress > 0 || success ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-[#6B7280]">
            <span>{isUploading ? "Uploading..." : "Upload complete"}</span>
            <span>{success ? "100%" : `${progress}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E6EDF3]">
            <div
              className="h-full rounded-full bg-[#F58220] transition-all"
              style={{ width: `${success ? 100 : progress}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void onUpload()}
          disabled={!selectedFile || isUploading}
          className="rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : buttonLabel}
        </button>
        {status ? <span className="text-sm text-[#6B7280]">{status}</span> : null}
      </div>
    </div>
  );
}

function AssetPreview({
  label,
  note,
  imageUrl,
  imageAlt,
  imageClassName,
  placeholderClassName,
}: {
  label: string;
  note: string;
  imageUrl: string;
  imageAlt: string;
  imageClassName: string;
  placeholderClassName: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={imageAlt} className={imageClassName} />
      ) : (
        <div className={`flex items-center justify-center rounded-lg border border-dashed border-[#E6EDF3] bg-white text-xs text-[#6B7280] ${placeholderClassName}`}>
          None
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#1F2A37]">{label}</p>
        <p className="mt-1 text-xs text-[#6B7280]">{note}</p>
      </div>
    </div>
  );
}

function uploadFavicon(
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<{ publicPath: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload-site-favicon");

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

function uploadSeoImage(
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<{ publicPath: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload-site-image");

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
