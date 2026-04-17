import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import ConfirmationPageEditorForm from "@/components/admin/ConfirmationPageEditorForm";
import { getWebinarAction, updateWebinarAction } from "@/app/actions/webinar-actions";
import { requireAdminUser } from "@/lib/auth/server";

type Props = {
  params: Promise<{ webinarId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditConfirmationPage({ params }: Props) {
  await requireAdminUser("webinar_edit_confirmation_page", "/admin");
  const { webinarId } = await params;
  const webinar = await getWebinarAction(webinarId);

  if (!webinar) notFound();
  const webinarSlug = webinar.slug;

  async function updateAction(formData: FormData) {
    "use server";
    await updateWebinarAction(webinarId, {
      confirmationPage: {
        headline: formData.get("confirmationPage.headline"),
        stepBannerText: formData.get("confirmationPage.stepBannerText"),
        introText: formData.get("confirmationPage.introText"),
        scheduleHeading: formData.get("confirmationPage.scheduleHeading"),
        scheduledTimeLabel: formData.get("confirmationPage.scheduledTimeLabel"),
        countdownLabel: formData.get("confirmationPage.countdownLabel"),
        joinButtonLabel: formData.get("confirmationPage.joinButtonLabel"),
        addToCalendarLabel: formData.get("confirmationPage.addToCalendarLabel"),
        messengerButtonLabel: formData.get("confirmationPage.messengerButtonLabel"),
        messengerUrl: formData.get("confirmationPage.messengerUrl"),
        mediaSource: formData.get("confirmationPage.mediaSource"),
        mediaType: formData.get("confirmationPage.mediaType"),
        mediaUrl: formData.get("confirmationPage.mediaUrl"),
        mediaPosition: formData.get("confirmationPage.mediaPosition"),
        headlineColor: formData.get("confirmationPage.headlineColor"),
        bannerColor: formData.get("confirmationPage.bannerColor"),
        primaryButtonColor: formData.get("confirmationPage.primaryButtonColor"),
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/webinars/${webinarId}`);
    revalidatePath(`/admin/webinars/${webinarId}/confirmation-page`);
    revalidatePath(`/confirm-preview/${webinarSlug}`);
    return { ok: true as const };
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <ConfirmationPageEditorForm
          webinarId={webinar.webinarId}
          webinarTitle={webinar.title}
          webinarSlug={webinar.slug}
          initial={webinar.confirmationPage}
          action={updateAction}
        />
      </div>
    </main>
  );
}
