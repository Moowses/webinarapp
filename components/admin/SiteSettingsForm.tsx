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

type Props = {
  initial: SiteSettings;
  action: (formData: FormData) => Promise<{ ok: true }>;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

export default function SiteSettingsForm({ initial, action }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const seoImageInputRef = useRef<HTMLInputElement | null>(null);
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
      if (faviconInputRef.current) {
        faviconInputRef.current.value = "";
      }
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
      if (seoImageInputRef.current) {
        seoImageInputRef.current.value = "";
      }
    } catch (error) {
      setSeoImageUploadStatus("Upload failed");
      setErrorToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingSeoImage(false);
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
              <h1 className="mt-2 text-3xl font-semibold text-[#1F2A37]">Site Settings</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
                Manage the browser tab title, favicon, and global branding metadata used across the app.
              </p>
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
                href="/admin"
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
              >
                Back
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="space-y-6">
            <AdminSection
              title="Branding"
              description="Control the browser tab title and the default site description."
              accent="bg-[#2F6FA3]"
            >
              <div className="grid gap-5 md:grid-cols-2">
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
              </div>
            </AdminSection>

            <AdminSection
              title="SEO"
              description="Global metadata used for search engines and social sharing."
              accent="bg-[#2F6FA3]"
            >
              <div className="grid gap-5">
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
                <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
                  <p className="text-sm font-semibold text-[#1F2A37]">Upload share image</p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Best for social previews: 1200x630 PNG, JPG, or WEBP.
                  </p>
                  <input
                    ref={seoImageInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => setSelectedSeoImageFile(event.target.files?.[0] ?? null)}
                    className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F58220] file:px-3 file:py-1.5 file:text-white`}
                  />
                  {selectedSeoImageFile ? (
                    <p className="mt-2 text-xs text-[#6B7280]">Selected: {selectedSeoImageFile.name}</p>
                  ) : null}
                  {isUploadingSeoImage ||
                  seoImageUploadProgress > 0 ||
                  seoImageUploadStatus === "Share image uploaded successfully" ? (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-[#6B7280]">
                        <span>{isUploadingSeoImage ? "Uploading share image..." : "Upload complete"}</span>
                        <span>
                          {seoImageUploadStatus === "Share image uploaded successfully"
                            ? "100%"
                            : `${seoImageUploadProgress}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E6EDF3]">
                        <div
                          className="h-full rounded-full bg-[#F58220] transition-all"
                          style={{
                            width: `${seoImageUploadStatus === "Share image uploaded successfully" ? 100 : seoImageUploadProgress}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleUploadSeoImage}
                      disabled={!selectedSeoImageFile || isUploadingSeoImage}
                      className="rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingSeoImage ? "Uploading..." : "Upload Share Image"}
                    </button>
                    {seoImageUploadStatus ? <span className="text-sm text-[#6B7280]">{seoImageUploadStatus}</span> : null}
                  </div>
                </div>
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

                <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
                  <p className="text-sm font-semibold text-[#1F2A37]">Upload favicon</p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Allowed types: PNG, ICO, SVG, WEBP.
                  </p>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept=".png,.ico,.svg,.webp,image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                    onChange={(event) => setSelectedFaviconFile(event.target.files?.[0] ?? null)}
                    className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F58220] file:px-3 file:py-1.5 file:text-white`}
                  />
                  {selectedFaviconFile ? (
                    <p className="mt-2 text-xs text-[#6B7280]">Selected: {selectedFaviconFile.name}</p>
                  ) : null}
                  {isUploadingFavicon ||
                  faviconUploadProgress > 0 ||
                  faviconUploadStatus === "Favicon uploaded successfully" ? (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-[#6B7280]">
                        <span>{isUploadingFavicon ? "Uploading favicon..." : "Upload complete"}</span>
                        <span>
                          {faviconUploadStatus === "Favicon uploaded successfully"
                            ? "100%"
                            : `${faviconUploadProgress}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E6EDF3]">
                        <div
                          className="h-full rounded-full bg-[#F58220] transition-all"
                          style={{
                            width: `${faviconUploadStatus === "Favicon uploaded successfully" ? 100 : faviconUploadProgress}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleUploadFavicon}
                      disabled={!selectedFaviconFile || isUploadingFavicon}
                      className="rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingFavicon ? "Uploading..." : "Upload Favicon"}
                    </button>
                    {faviconUploadStatus ? <span className="text-sm text-[#6B7280]">{faviconUploadStatus}</span> : null}
                  </div>
                </div>
              </div>
            </AdminSection>
          </div>

          <div className="space-y-6">
            <AdminCard>
              <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Instructions</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1F2A37]">Recommended favicon specs</h2>
              <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
                <p>Best size: `32x32` or `48x48` square for browser tabs.</p>
                <p>Preferred types: `PNG` or `ICO`. `SVG` works in many browsers too.</p>
                <p>Recommended file size: under `200 KB` for best performance.</p>
                <p>Upload limit in this app: `512 KB`.</p>
              </div>
            </AdminCard>

            <AdminCard>
              <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">SEO Tips</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1F2A37]">Recommended SEO specs</h2>
              <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
                <p>Meta description: keep it around `140-160` characters.</p>
                <p>Keywords: comma-separated short phrases only if you still want them for organization.</p>
                <p>Share image: use `1200x630` for best Facebook/Open Graph and general social previews.</p>
                <p>Recommended share image size: under `500 KB`.</p>
              </div>
            </AdminCard>

            <AdminCard>
              <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Preview</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1F2A37]">Current assets</h2>
              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
                {faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faviconUrl} alt="Favicon preview" className="h-12 w-12 rounded-lg border border-[#E6EDF3] bg-white object-contain p-1" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-[#E6EDF3] bg-white text-xs text-[#6B7280]">
                    None
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1F2A37]">
                    {faviconUrl || "No favicon selected"}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Save changes after upload to apply it globally.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
                {seoImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seoImageUrl} alt="SEO image preview" className="h-16 w-24 rounded-lg border border-[#E6EDF3] bg-white object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-[#E6EDF3] bg-white text-xs text-[#6B7280]">
                    None
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1F2A37]">
                    {seoImageUrl || "No share image selected"}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Save changes after upload to apply it to Open Graph and Twitter cards.
                  </p>
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      </form>

      <AdminLoadingModal open={isSaving} message="Saving site settings..." />
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
