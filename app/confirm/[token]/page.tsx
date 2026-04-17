import { redirect } from "next/navigation";
import { getRegistrationByTokenAction } from "@/app/actions/registration-actions";
import { getWebinarBySlugAction } from "@/app/actions/webinar-actions";
import ConfirmationPageClient from "@/components/confirm/ConfirmationPageClient";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ConfirmPage({ params }: Props) {
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
  const startMs = new Date(registration.scheduledStartISO).getTime();
  const endMs = new Date(
    registration.liveWindowEndISO ?? registration.scheduledEndISO
  ).getTime();
  const lateGraceDeadlineMs = startMs + webinar.lateGraceMinutes * 60 * 1000;

  if (now > endMs) {
    redirect(`/replay/${token}`);
  }
  if (!registration.attendedLive && now > lateGraceDeadlineMs) {
    redirect(`/w/${registration.webinarSlug}?late=1`);
  }

  return (
    <ConfirmationPageClient
      title={webinar.title}
      slug={webinar.slug}
      durationSec={webinar.durationSec}
      confirmationPage={webinar.confirmationPage}
      joinHref={`/live/${token}`}
      firstName={registration.firstName}
      scheduledStartISO={registration.scheduledStartISO}
      scheduledEndISO={registration.liveWindowEndISO ?? registration.scheduledEndISO}
    />
  );
}
