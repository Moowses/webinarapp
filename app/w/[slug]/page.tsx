import Link from "next/link";
import { notFound } from "next/navigation";
import { getWebinarBySlugAction } from "@/app/actions/webinar-actions";
import RegistrationClient from "./RegistrationClient";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    invalid?: string;
    expired?: string;
    late?: string;
    embed?: string;
    popup?: string;
    preview?: string;
  }>;
};

export default async function WebinarRegistrationPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const qs = await searchParams;
  const webinar = await getWebinarBySlugAction(slug);

  if (!webinar) {
    notFound();
  }

  return (
    <>
      {(qs.embed === "1" || qs.popup === "1") ? (
        <style>{`
          html, body {
            background: #ffffff !important;
            margin: 0;
            padding: 0;
            min-height: 0;
            height: auto;
          }
        `}</style>
      ) : null}
      <main
        className={
          qs.popup === "1"
            ? "bg-white p-0"
            : qs.embed === "1"
            ? "bg-white px-0 py-0"
            : "min-h-screen bg-[#f6f1eb] px-4 py-6 sm:px-6"
        }
      >
      <div className="mx-auto max-w-4xl">
        {qs.invalid === "1" ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            That access link is invalid. Please register again.
          </p>
        ) : null}
        {qs.expired === "1" ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            That access link has expired. Please register again.
          </p>
        ) : null}
        {qs.late === "1" ? (
          <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            The live webinar already passed the late-entry grace period for first-time attendees.
            If you joined earlier, use your same confirmation link to re-enter.
          </p>
        ) : null}

        <RegistrationClient
          slug={webinar.slug}
          title={webinar.title}
          schedule={webinar.schedule}
          registrationPage={webinar.registrationPage}
          embed={qs.embed === "1"}
          popup={qs.popup === "1"}
          preview={qs.preview === "1"}
        />

        {!qs.popup && !qs.embed ? (
          <p className="mt-6 text-center text-xs text-slate-500">
            Dev helper: <Link href="/live-test">open live chat test</Link>
          </p>
        ) : null}
      </div>
      </main>
    </>
  );
}
