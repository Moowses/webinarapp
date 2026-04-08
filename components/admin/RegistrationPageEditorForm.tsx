"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminErrorToast from "@/components/admin/ui/AdminErrorToast";
import AdminLoadingModal from "@/components/admin/ui/AdminLoadingModal";
import AdminSection from "@/components/admin/ui/AdminSection";
import AdminStickySaveBar from "@/components/admin/ui/AdminStickySaveBar";
import AdminSuccessToast from "@/components/admin/ui/AdminSuccessToast";
import type { WebinarRegistrationPageConfig } from "@/types/webinar";

type Props = {
  webinarId: string;
  webinarTitle: string;
  webinarSlug: string;
  initial: WebinarRegistrationPageConfig;
  action: (formData: FormData) => Promise<{ ok: true }>;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#E6EDF3] bg-white px-3 py-2.5 text-sm text-[#1F2A37] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

const textareaClass = `${inputClass} min-h-[110px] resize-y`;
const colorInputClass =
  "h-11 w-14 cursor-pointer rounded-xl border border-[#E6EDF3] bg-white p-1 shadow-sm outline-none transition focus:border-[#2F6FA3] focus:ring-2 focus:ring-[#2F6FA3]/20";

export default function RegistrationPageEditorForm({
  webinarId,
  webinarTitle,
  webinarSlug,
  initial,
  action,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast && !errorToast) return;
    const timer = window.setTimeout(() => {
      setSuccessToast(null);
      setErrorToast(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [successToast, errorToast]);

  const previewHref = useMemo(() => `/w/${webinarSlug}?preview=1`, [webinarSlug]);

  async function handleSave() {
    if (!formRef.current) return;

    setIsSaving(true);
    setErrorToast(null);
    try {
      const formData = new FormData(formRef.current);
      await action(formData);
      setHasUnsavedChanges(false);
      setSuccessToast("Registration page saved successfully");
    } catch (error) {
      setErrorToast(error instanceof Error ? error.message : "Failed to save registration page");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    window.location.reload();
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
              <h1 className="mt-2 text-3xl font-semibold text-[#1F2A37]">Edit Registration Page</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
                Configure the attendee-facing countdown block, popup copy, CTA messaging, and supporting assets for{" "}
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
            <AdminSection
              title="Registration Page Copy"
              description="Top-of-page messaging shown above the countdown and CTA."
              accent="bg-[#2F6FA3]"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm text-[#1F2A37]">
                  Eyebrow
                  <input name="registrationPage.eyebrow" defaultValue={initial.eyebrow} className={inputClass} />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Heading
                  <input name="registrationPage.heading" defaultValue={initial.heading} className={inputClass} />
                </label>
              </div>

              <label className="mt-5 block text-sm text-[#1F2A37]">
                Description
                <textarea
                  name="registrationPage.description"
                  defaultValue={initial.description}
                  rows={4}
                  className={textareaClass}
                />
              </label>
            </AdminSection>

            <AdminSection
              title="CTA Content"
              description="Control the call-to-action copy and popup form labels."
              accent="bg-[#F58220]"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm text-[#1F2A37]">
                  CTA Label
                  <input name="registrationPage.ctaLabel" defaultValue={initial.ctaLabel} className={inputClass} />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  CTA Sub-label
                  <input
                    name="registrationPage.ctaSubLabel"
                    defaultValue={initial.ctaSubLabel}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Modal Heading
                  <input
                    name="registrationPage.modalHeading"
                    defaultValue={initial.modalHeading}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Submit Button Label
                  <input
                    name="registrationPage.submitLabel"
                    defaultValue={initial.submitLabel}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="mt-5 block text-sm text-[#1F2A37]">
                Disclaimer Text
                <input
                  name="registrationPage.disclaimerText"
                  defaultValue={initial.disclaimerText}
                  className={inputClass}
                />
              </label>
            </AdminSection>

            <AdminSection
              title="Phone Incentive Content"
              description="Set the bonus image, phone pitch, and supporting callout content."
              accent="bg-[#2F6FA3]"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm text-[#1F2A37]">
                  Phone Pitch Title
                  <input
                    name="registrationPage.phonePitchTitle"
                    defaultValue={initial.phonePitchTitle}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-[#1F2A37]">
                  Arrow Image URL
                  <input
                    name="registrationPage.arrowImageUrl"
                    type="url"
                    defaultValue={initial.arrowImageUrl}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="mt-5 block text-sm text-[#1F2A37]">
                Phone Pitch Body
                <textarea
                  name="registrationPage.phonePitchBody"
                  defaultValue={initial.phonePitchBody}
                  rows={4}
                  className={textareaClass}
                />
              </label>
            </AdminSection>
          </div>

          <div className="space-y-6">
            <AdminSection
              title="Optional Assets"
              description="Visual details and color accents for the registration experience."
              accent="bg-[#F58220]"
            >
              <div className="grid gap-5">
                <label className="block text-sm text-[#1F2A37]">
                  Bonus Image URL
                  <input
                    name="registrationPage.bonusImageUrl"
                    type="url"
                    defaultValue={initial.bonusImageUrl}
                    className={inputClass}
                  />
                </label>
                <ColorField
                  label="Accent Color"
                  name="registrationPage.accentColor"
                  defaultValue={initial.accentColor}
                  placeholder="#F58220"
                />
                <ColorField
                  label="Heading Color"
                  name="registrationPage.headingColor"
                  defaultValue={initial.headingColor}
                  placeholder="#2F6FA3"
                />
              </div>
            </AdminSection>

            <AdminCard>
              <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280]">Preview Details</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1F2A37]">Safe admin preview</h2>
              <p className="mt-2 text-sm text-[#6B7280]">
                Preview opens the attendee registration page in preview mode so you can validate the heading, CTA,
                popup form, arrow image, and phone pitch without creating a real registrant or triggering production
                webhooks.
              </p>
              <div className="mt-4 rounded-2xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-4 text-sm text-[#6B7280]">
                Preview URL
                <div className="mt-2 break-all font-mono text-xs text-[#1F2A37]">{previewHref}</div>
              </div>
            </AdminCard>
          </div>
        </div>
      </form>

      <AdminLoadingModal open={isSaving} message="Saving registration page..." />
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
