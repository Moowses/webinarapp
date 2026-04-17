"use client";

import Link from "next/link";
import { useState } from "react";
import type { WebinarListItem } from "@/app/actions/webinar-actions";

type Props = {
  webinars: WebinarListItem[];
};

function getBaseUrl() {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function buildRegistrationLink(slug: string) {
  return `${getBaseUrl()}/w/${slug}`;
}

function buildEmbedLink(slug: string) {
  return `${buildRegistrationLink(slug)}?embed=1`;
}

function buildIframeCode(slug: string) {
  const baseUrl = getBaseUrl();
  const src = buildEmbedLink(slug);
  return `<div id="webinar-iframe-wrap" style="position:relative;width:100%;background:#fff;padding:0;margin:0;">
  <iframe
    id="webinar-registration-frame"
    src="${src}"
    width="100%"
    height="400"
    style="border:0;max-width:100%;overflow:hidden;display:block;background:#fff;"
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
</div>

<div
  id="cf-webinar-modal"
  style="display:none;position:fixed;z-index:999999;inset:0;background:rgba(0,0,0,.6);justify-content:center;align-items:center;padding:16px;"
>
  <div
    id="cf-webinar-modal-card"
    style="background:#fff;border-radius:10px;max-width:600px;width:95%;position:relative;box-sizing:border-box;max-height:90vh;overflow:auto;"
  >
    <button
      id="cf-webinar-modal-close"
      type="button"
      style="position:absolute;top:10px;right:15px;background:transparent;border:none;font-size:24px;cursor:pointer;z-index:2;"
    >&times;</button>

    <iframe
      id="cf-webinar-modal-frame"
      src=""
      width="100%"
      height="760"
      style="border:0;display:block;border-radius:10px;"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
  </div>
</div>

<script>
(function () {
  var allowedOrigin = "${baseUrl}";
  var modal = document.getElementById("cf-webinar-modal");
  var modalFrame = document.getElementById("cf-webinar-modal-frame");
  var closeBtn = document.getElementById("cf-webinar-modal-close");

  function openModal(url) {
    modalFrame.src = url;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.style.display = "none";
    modalFrame.src = "";
    document.body.style.overflow = "";
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== allowedOrigin) return;
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "OPEN_WEBINAR_MODAL" && event.data.url) {
      openModal(event.data.url);
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: "OPEN_WEBINAR_MODAL_ACK" }, event.origin);
      }
    }

    if (event.data.type === "CLOSE_WEBINAR_MODAL") {
      closeModal();
    }
  });

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
})();
</script>`;
}

export default function WebinarTable({ webinars }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const visibleWebinars = webinars.slice(0, 20);

  async function copyRegistrationLink(slug: string) {
    try {
      await navigator.clipboard.writeText(buildRegistrationLink(slug));
      setMessage("Registration link copied");
      setTimeout(() => setMessage(null), 1600);
    } catch {
      setMessage("Copy failed");
      setTimeout(() => setMessage(null), 1600);
    }
  }

  async function copyIframeCode(slug: string) {
    try {
      await navigator.clipboard.writeText(buildIframeCode(slug));
      setMessage("Iframe code copied");
      setTimeout(() => setMessage(null), 1600);
    } catch {
      setMessage("Copy failed");
      setTimeout(() => setMessage(null), 1600);
    }
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E6EDF3] bg-white shadow-sm">
        <div className="max-h-[620px] overflow-auto">
          <table className="min-w-full text-sm text-[#1F2A37]">
            <thead className="bg-[#F8FBFF] text-left text-[#6B7280]">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Registration Link</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleWebinars.map((webinar) => (
                <tr key={webinar.webinarId} className="border-t border-[#E6EDF3]">
                  <td className="px-4 py-3 font-medium text-[#1F2A37]">{webinar.title || "(Untitled)"}</td>
                  <td className="px-4 py-3 font-mono text-[#6B7280]">{webinar.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyRegistrationLink(webinar.slug)}
                        className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        onClick={() => copyIframeCode(webinar.slug)}
                        className="rounded-xl bg-[#F58220] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#E46F12]"
                      >
                        Copy Iframe
                      </button>
                      <a
                        href={`/w/${webinar.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-[#E6EDF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2A37] transition hover:bg-[#F8FBFF]"
                      >
                        Open
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {webinar.updatedAt ? new Date(webinar.updatedAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/webinars/${webinar.webinarId}`}
                        className="rounded-xl bg-[#2F6FA3] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3E82BD]"
                      >
                        Edit Webinar
                      </Link>
                      <Link
                        href={`/admin/webinars/${webinar.webinarId}/registration-page`}
                        className="rounded-xl border border-[#2F6FA3] bg-white px-3 py-1.5 text-xs font-semibold text-[#2F6FA3] transition hover:bg-[#F0F7FF]"
                      >
                        Edit Reg Page
                      </Link>
                      <Link
                        href={`/admin/webinars/${webinar.webinarId}/confirmation-page`}
                        className="rounded-xl border border-[#F58220] bg-white px-3 py-1.5 text-xs font-semibold text-[#F58220] transition hover:bg-[#FFF4EA]"
                      >
                        Edit Confirm
                      </Link>
                      <Link
                        href={`/confirm-preview/${webinar.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-[#E6EDF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2A37] transition hover:bg-[#F8FBFF]"
                      >
                        View Confirm
                      </Link>
                      <Link
                        href={`/admin/webinars/${webinar.webinarId}/replay-preview`}
                        className="rounded-xl border border-[#F58220] bg-white px-3 py-1.5 text-xs font-semibold text-[#F58220] transition hover:bg-[#FFF4EA]"
                      >
                        Replay Preview
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleWebinars.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[#6B7280]" colSpan={5}>
                    No webinars yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      {message ? (
        <div className="fixed bottom-6 right-6 rounded-xl border border-[#E6EDF3] bg-white px-3 py-2 text-sm font-medium text-[#1F2A37] shadow-lg">
          {message}
        </div>
      ) : null}
    </>
  );
}
