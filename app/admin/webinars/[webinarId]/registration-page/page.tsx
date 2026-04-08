import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import RegistrationPageEditorForm from "@/components/admin/RegistrationPageEditorForm";
import { getWebinarAction, updateWebinarAction } from "@/app/actions/webinar-actions";

type Props = {
  params: Promise<{ webinarId: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditRegistrationPage({ params }: Props) {
  const { webinarId } = await params;
  const webinar = await getWebinarAction(webinarId);

  if (!webinar) notFound();

  async function updateAction(formData: FormData) {
    "use server";
    await updateWebinarAction(webinarId, {
      registrationPage: {
        eyebrow: formData.get("registrationPage.eyebrow"),
        heading: formData.get("registrationPage.heading"),
        description: formData.get("registrationPage.description"),
        ctaLabel: formData.get("registrationPage.ctaLabel"),
        ctaSubLabel: formData.get("registrationPage.ctaSubLabel"),
        modalHeading: formData.get("registrationPage.modalHeading"),
        submitLabel: formData.get("registrationPage.submitLabel"),
        disclaimerText: formData.get("registrationPage.disclaimerText"),
        phonePitchTitle: formData.get("registrationPage.phonePitchTitle"),
        phonePitchBody: formData.get("registrationPage.phonePitchBody"),
        arrowImageUrl: formData.get("registrationPage.arrowImageUrl"),
        bonusImageUrl: formData.get("registrationPage.bonusImageUrl"),
        accentColor: formData.get("registrationPage.accentColor"),
        headingColor: formData.get("registrationPage.headingColor"),
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/webinars/${webinarId}`);
    revalidatePath(`/admin/webinars/${webinarId}/registration-page`);
    revalidatePath(`/w/${webinar.slug}`);
    return { ok: true as const };
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <RegistrationPageEditorForm
          webinarId={webinar.webinarId}
          webinarTitle={webinar.title}
          webinarSlug={webinar.slug}
          initial={webinar.registrationPage}
          action={updateAction}
        />
      </div>
    </main>
  );
}
