import { revalidatePath } from "next/cache";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
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
      <div className="mx-auto w-full max-w-[1400px]">
        <SiteSettingsForm initial={settings} action={updateAction} />
      </div>
    </main>
  );
}
