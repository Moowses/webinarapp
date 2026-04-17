import { listWebinarsAction } from "@/app/actions/webinar-actions";
import {
  getAdminLiveOverviewAction,
  listRegistrantsForAdminAction,
} from "@/app/actions/admin-registration-actions";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { requireAdminUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sessionUser = await requireAdminUser("view_admin", "/admin");
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
          currentUser={{
            displayName: sessionUser.displayName,
            email: sessionUser.email,
            canManageSettings: sessionUser.effectivePermissions.includes("manage_settings"),
            canManageUsers: sessionUser.effectivePermissions.includes("manage_users"),
          }}
        />
      </div>
    </main>
  );
}
