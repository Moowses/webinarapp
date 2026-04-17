import Link from "next/link";
import { notFound } from "next/navigation";
import { getWebinarAction } from "@/app/actions/webinar-actions";
import WebinarPreviewClient from "@/components/admin/WebinarPreviewClient";
import { requireAdminUser } from "@/lib/auth/server";

type Props = {
  params: Promise<{ webinarId: string }>;
};

export const dynamic = "force-dynamic";

export default async function WebinarPreviewPage({ params }: Props) {
  await requireAdminUser("view_admin", "/admin");
  const { webinarId } = await params;
  const webinar = await getWebinarAction(webinarId);

  if (!webinar) notFound();

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-[#E6EDF3] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">Admin Preview</p>
              <h1 className="mt-1 text-2xl font-semibold">{webinar.title || webinar.slug}</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/admin/webinars/${webinarId}`}
                className="rounded-xl border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
              >
                Back to edit
              </Link>
              <span className="rounded-xl border border-[#E6EDF3] bg-[#F8FBFF] px-4 py-2 text-sm text-[#6B7280]">
                Open live page
              </span>
            </div>
          </div>
        </div>

        <WebinarPreviewClient webinar={webinar} />
      </div>
    </main>
  );
}
