import { listWebinarsAction } from "@/app/actions/webinar-actions";
import {
  getAdminLiveOverviewAction,
  listRegistrantsForAdminAction,
} from "@/app/actions/admin-registration-actions";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { processDueNoShowWebhooks } from "@/lib/services/attendance-webhook";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await processDueNoShowWebhooks();
  } catch (error) {
    console.error("Failed to process due no-show webhooks", error);
  }

  const [webinars, registrants, liveOverview] = await Promise.all([
    listWebinarsAction(),
    listRegistrantsForAdminAction(),
    getAdminLiveOverviewAction(),
  ]);

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <AdminDashboardClient
          webinars={webinars}
          registrants={registrants}
          activeSessions={liveOverview.sessions}
          activeViewers={liveOverview.viewers}
        />
      </div>
    </main>
  );
}
