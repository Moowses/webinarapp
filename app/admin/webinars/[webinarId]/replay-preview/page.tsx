import { notFound } from "next/navigation";
import LiveRoom from "@/components/live/LiveRoom";
import { getWebinarAction } from "@/app/actions/webinar-actions";
import { getOrCreateSessionAction } from "@/app/actions/session-actions";
import { requireAdminUser } from "@/lib/auth/server";

type Props = {
  params: Promise<{ webinarId: string }>;
};

export const dynamic = "force-dynamic";

export default async function WebinarReplayPreviewPage({ params }: Props) {
  await requireAdminUser("view_admin", "/admin");
  const { webinarId } = await params;
  const webinar = await getWebinarAction(webinarId);

  if (!webinar) notFound();

  const previewScheduledStartISO = "2026-01-01T00:00:00.000Z";
  const { sessionId } = await getOrCreateSessionAction({
    webinarId,
    timezoneGroupKey: "admin-replay-preview",
    scheduledStartISO: previewScheduledStartISO,
  });

  return (
    <LiveRoom
      accessToken="admin-replay-preview"
      webinarId={webinarId}
      sessionId={sessionId}
      webinarTitle={webinar.title}
      videoPublicPath={webinar.videoPublicPath}
      webinarSlug={webinar.slug}
      timezoneGroupKey="admin-replay-preview"
      scheduledStartISO={previewScheduledStartISO}
      initialPlaybackSec={0}
      durationSec={webinar.durationSec}
      displayName="Admin Preview"
      replayMode
      leaveHref={`/admin/webinars/${webinarId}`}
    />
  );
}
