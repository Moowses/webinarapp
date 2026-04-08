import { notFound } from "next/navigation";
import { getWebinarBySlugAction } from "@/app/actions/webinar-actions";
import ConfirmationPageClient from "@/components/confirm/ConfirmationPageClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ConfirmationPreviewPage({ params }: Props) {
  const { slug } = await params;
  const webinar = await getWebinarBySlugAction(slug);

  if (!webinar) notFound();

  return (
    <ConfirmationPageClient
      title={webinar.title}
      slug={webinar.slug}
      schedule={webinar.schedule}
      durationSec={webinar.durationSec}
      confirmationPage={webinar.confirmationPage}
      joinHref={`/w/${webinar.slug}`}
      previewMode
    />
  );
}
