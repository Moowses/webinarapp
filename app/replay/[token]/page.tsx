import { redirect } from "next/navigation";
import LiveRoom from "@/components/live/LiveRoom";
import { getRegistrationByTokenAction } from "@/app/actions/registration-actions";
import { getWebinarBySlugAction } from "@/app/actions/webinar-actions";
import { getOrCreateSessionAction } from "@/app/actions/session-actions";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ReplayPage({ params }: Props) {
  const { token } = await params;
  const registration = await getRegistrationByTokenAction(token);

  if (!registration) {
    redirect("/w/demo?invalid=1");
  }

  const webinar = await getWebinarBySlugAction(registration.webinarSlug);
  if (!webinar) {
    redirect("/w/demo?invalid=1");
  }

  const now = new Date(registration.evaluatedAtISO).getTime();
  const replayBaseMs = new Date(
    registration.liveWindowEndISO ?? registration.scheduledEndISO
  ).getTime();
  const replayExpiryMs = replayBaseMs + webinar.replayExpiryHours * 60 * 60 * 1000;
  if (!Number.isFinite(replayBaseMs) || now > replayExpiryMs) {
    if (webinar.redirect?.enabled && webinar.redirect.url) {
      redirect(webinar.redirect.url);
    }
    redirect(`/w/${registration.webinarSlug}?expired=1`);
  }

  const displayName = `${registration.firstName} ${registration.lastName}`.trim() || "Guest";

  const { sessionId } = await getOrCreateSessionAction({
    webinarId: registration.webinarId,
    timezoneGroupKey: registration.timezoneGroupKey,
    scheduledStartISO: registration.scheduledStartISO,
  });

  return (
    <LiveRoom
      accessToken={token}
      webinarId={registration.webinarId}
      sessionId={sessionId}
      webinarTitle={webinar.title}
      videoPublicPath={webinar.videoPublicPath}
      webinarSlug={registration.webinarSlug}
      timezoneGroupKey={registration.timezoneGroupKey}
      scheduledStartISO={registration.scheduledStartISO}
      initialPlaybackSec={0}
      durationSec={webinar.durationSec}
      displayName={displayName}
      replayMode
      leaveHref={
        webinar.redirect?.enabled && webinar.redirect.url
          ? webinar.redirect.url
          : `/w/${registration.webinarSlug}`
      }
    />
  );
}
