import { revalidatePath } from "next/cache";
import AdminSidebar from "@/components/admin/AdminSidebar";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";
import { requireAdminUser } from "@/lib/auth/server";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const sessionUser = await requireAdminUser("manage_settings", "/admin/settings");
  const settings = await getSiteSettings();

  async function updateAction(formData: FormData) {
    "use server";
    await updateSiteSettings({
      siteTitle: formData.get("siteTitle"),
      siteDescription: formData.get("siteDescription"),
      faviconUrl: formData.get("faviconUrl"),
      seoKeywords: formData.get("seoKeywords"),
      seoImageUrl: formData.get("seoImageUrl"),
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    return { ok: true as const };
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <AdminSidebar
          currentPath="/admin/settings"
          currentUser={{
            displayName: sessionUser.displayName,
            email: sessionUser.email,
            canManageSettings: sessionUser.effectivePermissions.includes("manage_settings"),
            canManageUsers: sessionUser.effectivePermissions.includes("manage_users"),
          }}
        />
        <SiteSettingsForm
          initial={settings}
          action={updateAction}
          canManageUsers={sessionUser.effectivePermissions.includes("manage_users")}
        />
      </div>
    </main>
  );
}
