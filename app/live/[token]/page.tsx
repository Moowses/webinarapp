import { redirect } from "next/navigation";
import LiveRoom from "@/components/live/LiveRoom";
import {
  getRegistrationByTokenAction,
  markRegistrationAttendedAction,
} from "@/app/actions/registration-actions";
import { getWebinarBySlugAction } from "@/app/actions/webinar-actions";
import { getOrCreateSessionAction } from "@/app/actions/session-actions";

type Props = {
  params: Promise<{ token: string }>;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default async function LivePage({ params }: Props) {
  const { token } = await params;
  const registration = await getRegistrationByTokenAction(token);

  if (!registration) {
    redirect("/w/demo?invalid=1");
  }

  const webinar = await getWebinarBySlugAction(registration.webinarSlug);
  if (!webinar) {
    redirect("/w/demo?invalid=1");
  }
  const displayName = `${registration.firstName} ${registration.lastName}`.trim() || "Guest";

  const now = new Date(registration.evaluatedAtISO).getTime();
  const startMs = new Date(registration.scheduledStartISO).getTime();
  const endMs = new Date(registration.liveWindowEndISO ?? registration.scheduledEndISO).getTime();
  const lateGraceDeadlineMs = startMs + webinar.lateGraceMinutes * 60 * 1000;

  if (now < startMs) {
    redirect(`/confirm/${token}`);
  }
  if (!registration.attendedLive && now > lateGraceDeadlineMs) {
    redirect(`/w/${registration.webinarSlug}?late=1`);
  }

  if (now > endMs) {
    redirect(`/replay/${token}`);
  }

  await markRegistrationAttendedAction(registration.id);

  const { sessionId } = await getOrCreateSessionAction({
    webinarId: registration.webinarId,
    timezoneGroupKey: registration.timezoneGroupKey,
    scheduledStartISO: registration.scheduledStartISO,
  });

  const playbackSec = clamp(
    Math.floor((now - startMs) / 1000),
    0,
    webinar.durationSec
  );

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
      initialPlaybackSec={playbackSec}
      durationSec={webinar.durationSec}
      displayName={displayName}
      initialAccessRevoked={Boolean(registration.kickedAtISO)}
      revokedRedirectUrl="https://www.google.com"
    />
  );
}
