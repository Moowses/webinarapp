import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import WebinarEditorForm from "@/components/admin/WebinarEditorForm";
import UploadChatCsv from "@/components/admin/UploadChatCsv";
import { getWebinarAction, updateWebinarAction } from "@/app/actions/webinar-actions";
import { clearPredefinedChatAction } from "@/app/actions/predefined-chat-actions";
import { requireAdminUser } from "@/lib/auth/server";

type Props = {
  params: Promise<{ webinarId: string }>;
  searchParams: Promise<{ saved?: string; cleared?: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditWebinarPage({ params, searchParams }: Props) {
  const sessionUser = await requireAdminUser("view_admin", "/admin");
  const { webinarId } = await params;
  await searchParams;
  const webinar = await getWebinarAction(webinarId);

  if (!webinar) notFound();
  const webinarSlug = webinar.slug;

  const permissions = {
    basic: sessionUser.effectivePermissions.includes("webinar_edit_basic"),
    video: sessionUser.effectivePermissions.includes("webinar_edit_video"),
    webhook: sessionUser.effectivePermissions.includes("webinar_edit_webhook"),
    attendanceWebhook: sessionUser.effectivePermissions.includes("webinar_edit_attendance_webhook"),
    schedule: sessionUser.effectivePermissions.includes("webinar_edit_schedule"),
    bot: sessionUser.effectivePermissions.includes("webinar_edit_bot"),
    predefinedChat: sessionUser.effectivePermissions.includes("webinar_edit_predefined_chat"),
    registrationPage: sessionUser.effectivePermissions.includes("webinar_edit_registration_page"),
    confirmationPage: sessionUser.effectivePermissions.includes("webinar_edit_confirmation_page"),
  };

  async function updateAction(formData: FormData) {
    "use server";
    await updateWebinarAction(webinarId, formData);
    revalidatePath("/admin");
    revalidatePath(`/admin/webinars/${webinarId}`);
    revalidatePath(`/w/${webinarSlug}`);
    return { ok: true as const };
  }

  async function clearAction() {
    "use server";
    const result = await clearPredefinedChatAction(webinarId);
    revalidatePath(`/admin/webinars/${webinarId}`);
    return { ok: true as const, deleted: result.deleted };
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 rounded-2xl border border-[#E6EDF3] bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-[#6B7280]">Admin</p>
          <h1 className="text-2xl font-semibold">Edit Webinar</h1>
          <div className="mt-4 flex flex-wrap gap-3">
            {permissions.registrationPage ? <a
              href={`/admin/webinars/${webinarId}/registration-page`}
              className="inline-flex rounded-lg border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
            >
              Edit registration page
            </a> : null}
            {permissions.confirmationPage ? <a
              href={`/admin/webinars/${webinarId}/confirmation-page`}
              className="inline-flex rounded-lg border border-[#2F6FA3] bg-white px-4 py-2 text-sm text-[#2F6FA3] hover:bg-[#F0F7FF]"
            >
              Edit confirmation page
            </a> : null}
            <a
              href={`/confirm-preview/${webinarSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg border border-[#F58220] bg-white px-4 py-2 text-sm text-[#F58220] hover:bg-[#FFF4EA]"
            >
              View confirmation
            </a>
          </div>
        </div>
        <WebinarEditorForm
          mode="edit"
          initial={{
            webinarId: webinar.webinarId,
            title: webinar.title,
            slug: webinar.slug,
            videoPublicPath: webinar.videoPublicPath,
            durationSec: webinar.durationSec,
            lateGraceMinutes: webinar.lateGraceMinutes,
            replayExpiryHours: webinar.replayExpiryHours,
            schedule: webinar.schedule,
            webhook: webinar.webhook,
            attendanceWebhook: webinar.attendanceWebhook,
            redirect: webinar.redirect,
            bot: {
              enabled: webinar.bot.enabled,
              name: webinar.bot.name,
              link: webinar.bot.link ?? "",
              apiKey: webinar.bot.apiKey,
              conversationId: webinar.bot.conversationId,
              activationDelaySec: webinar.bot.activationDelaySec,
            },
          }}
          submitLabel="Save changes"
          action={updateAction}
          updatedAt={webinar.updatedAt}
          permissions={permissions}
        />
        {permissions.predefinedChat ? (
          <UploadChatCsv
            webinarId={webinarId}
            webinarTitle={webinar.title}
            clearAction={clearAction}
          />
        ) : null}
      </div>
    </main>
  );
}
