"use client";

import { useCallback, useEffect, useState } from "react";
import AdminErrorToast from "@/components/admin/ui/AdminErrorToast";
import AdminLoadingModal from "@/components/admin/ui/AdminLoadingModal";
import AdminSection from "@/components/admin/ui/AdminSection";
import AdminSuccessToast from "@/components/admin/ui/AdminSuccessToast";

type Props = {
  webinarId: string;
  webinarTitle: string;
  clearAction: () => Promise<{ ok: true; deleted: number }>;
};

type PreviewMessage = {
  id: string;
  playbackOffsetSec: number;
  senderName: string;
  text: string;
};

const textareaClass =
  "mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

export default function UploadChatCsv({ webinarId, webinarTitle, clearAction }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [chatText, setChatText] = useState("");
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (!successToast && !errorToast) return;
    const timer = window.setTimeout(() => {
      setSuccessToast(null);
      setErrorToast(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [successToast, errorToast]);

  const loadPreview = useCallback(async function loadPreviewInternal() {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/webinars/${webinarId}/predefined?uptoSec=999999&pageSize=8`);
      const json = (await response.json()) as {
        messages?: PreviewMessage[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error || "Failed to load preview");
      }
      setPreviewMessages(json.messages ?? []);
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Failed to load preview");
    } finally {
      setIsLoadingPreview(false);
    }
  }, [webinarId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function onUpload() {
    if (!file && !chatText.trim()) {
      setErrorToast("Select a TXT/CSV file or paste chat transcript first.");
      return;
    }

    setIsUploading(true);
    setLoadingMessage("Uploading predefined chat...");

    try {
      const payload = new FormData();
      payload.append("webinarId", webinarId);
      if (file) {
        payload.append("file", file);
      } else {
        const blob = new Blob([chatText], { type: "text/plain" });
        payload.append("file", new File([blob], "pasted-chat.txt", { type: "text/plain" }));
      }

      const response = await fetch("/api/admin/upload-predefined-chat", {
        method: "POST",
        body: payload,
      });
      const json = (await response.json()) as {
        inserted?: number;
        skipped?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error || "Upload failed");
      }

      setSuccessToast(`Chat uploaded. Inserted ${json.inserted ?? 0}, skipped ${json.skipped ?? 0}.`);
      setFile(null);
      setChatText("");
      await loadPreview();
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setLoadingMessage(null);
    }
  }

  async function onClear() {
    const confirmed = window.confirm(`Clear all predefined chat messages for ${webinarTitle}?`);
    if (!confirmed) return;

    setLoadingMessage("Clearing predefined chat...");
    try {
      const result = await clearAction();
      setSuccessToast(`Predefined chat cleared. Deleted ${result.deleted} messages.`);
      await loadPreview();
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Clear failed");
    } finally {
      setLoadingMessage(null);
    }
  }

  return (
    <>
      <AdminSection
        title="Predefined Chat"
        description="Upload TXT or CSV scripted messages and preview the current imported timeline."
        accent="bg-[#F58220]"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div>
            <label className="block text-sm text-[#1F2A37]">
              Upload TXT or CSV File
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className={`${textareaClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F58220] file:px-3 file:py-1.5 file:text-white`}
              />
            </label>

            <label className="mt-5 block text-sm text-[#1F2A37]">
              Paste Chat Content
              <textarea
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                placeholder={`00:00:20\nQueen queenbrunidor:\nHello Everyone!`}
                rows={10}
                className={textareaClass}
              />
              <p className="mt-2 text-xs text-[#6B7280]">
                Supported TXT format: timestamp on one line, sender ending with a colon on the next line, then the
                message on the following line.
              </p>
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onUpload}
                disabled={isUploading}
                className="rounded-xl bg-[#F58220] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#E46F12] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading ? "Uploading..." : "Upload Chat"}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-xl border border-[#F58220] bg-[#FFE7D1] px-4 py-2 text-sm font-semibold text-[#F58220] transition hover:bg-[#FFD8B3]"
              >
                Clear predefined chat
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1F2A37]">Preview Messages</p>
                <p className="mt-1 text-xs text-[#6B7280]">Showing the first few imported chat lines.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadPreview()}
                className="rounded-lg border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs text-[#2F6FA3]"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {isLoadingPreview ? (
                <p className="text-sm text-[#6B7280]">Loading preview...</p>
              ) : previewMessages.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No predefined messages uploaded yet.</p>
              ) : (
                previewMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-[#E6EDF3] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
                        {formatSec(message.playbackOffsetSec)}
                      </span>
                      <span className="text-xs text-[#6B7280]">{message.senderName}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#1F2A37]">{message.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminSection>

      <AdminLoadingModal open={Boolean(loadingMessage)} message={loadingMessage ?? ""} />
      <AdminSuccessToast message={successToast} />
      <AdminErrorToast message={errorToast} />
    </>
  );
}

function formatSec(value: number) {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
