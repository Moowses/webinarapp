import { revalidatePath } from "next/cache";
import WebinarEditorForm from "@/components/admin/WebinarEditorForm";
import { createWebinarAction } from "@/app/actions/webinar-actions";
import { requireAdminUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const defaultWebinar = {
  title: "",
  slug: "",
  videoPublicPath: "",
  durationSec: 3600,
  lateGraceMinutes: 15,
  replayExpiryHours: 72,
  schedule: {
    timezoneBase: "Asia/Manila",
    daysOfWeek: [3],
    times: ["20:00"],
    liveWindowMinutes: 120,
  },
  webhook: {
    enabled: false,
    url: "",
  },
  attendanceWebhook: {
    enabled: false,
    url: "",
  },
  redirect: {
    enabled: false,
    url: "",
  },
  bot: {
    enabled: false,
    name: "",
    link: "",
    apiKey: "",
    conversationId: "",
    activationDelaySec: 60,
  },
  registrationPage: {
    eyebrow: "Live Workshop Access",
    heading: "Secure your seat for {title}",
    description: "",
    ctaLabel: "Click to Sign Up",
    ctaSubLabel: "Step #1: click here",
    modalHeading: "Secure Your Seat For {title}",
    submitLabel: "Reserve My Seat",
    disclaimerText: "* we will not spam, rent, or sell your information... *",
    phonePitchTitle: "Free Prizes Just For Registering With Your Cell #!!!",
    phonePitchBody:
      "We ask for your mobile number so we can send reminders and contact giveaway winners.",
    arrowImageUrl:
      "https://onlinebroadcastpro.com/wp-content/uploads/2025/07/arrows-green.webp",
    bonusImageUrl:
      "https://onlinebroadcastpro.com/wp-content/uploads/2025/07/Screen-Shot-2022-04-10-at-1.30.11-PM.webp",
    accentColor: "#ff0000",
    headingColor: "#2d0d5c",
  },
};

export default async function NewWebinarPage() {
  const sessionUser = await requireAdminUser("webinar_create", "/admin/webinars/new");

  async function createAction(formData: FormData) {
    "use server";
    const created = await createWebinarAction(formData);
    revalidatePath("/admin");
    return { ok: true as const, webinarId: created.webinarId };
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 rounded-2xl border border-[#E6EDF3] bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-[#6B7280]">Admin</p>
          <h1 className="text-2xl font-semibold">Create Webinar</h1>
        </div>
        <WebinarEditorForm
          mode="create"
          initial={defaultWebinar}
          submitLabel="Create webinar"
          action={createAction}
          permissions={{
            basic: sessionUser.effectivePermissions.includes("webinar_create") || sessionUser.effectivePermissions.includes("webinar_edit_basic"),
            video: sessionUser.effectivePermissions.includes("webinar_edit_video"),
            webhook: sessionUser.effectivePermissions.includes("webinar_edit_webhook"),
            attendanceWebhook: sessionUser.effectivePermissions.includes("webinar_edit_attendance_webhook"),
            schedule: sessionUser.effectivePermissions.includes("webinar_edit_schedule"),
            bot: sessionUser.effectivePermissions.includes("webinar_edit_bot"),
          }}
        />
      </div>
    </main>
  );
}
