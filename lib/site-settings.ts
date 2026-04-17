import "server-only";
import { requireAdminUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/services/firebase-admin";

export type SiteSettings = {
  siteTitle: string;
  siteDescription: string;
  faviconUrl: string;
  seoKeywords: string;
  seoImageUrl: string;
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteTitle: "Online broadcast pro",
  siteDescription: "Online broadcast pro webinar platform",
  faviconUrl: "",
  seoKeywords: "",
  seoImageUrl: "",
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFaviconUrl(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.startsWith("/")) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  throw new Error("Favicon URL must be root-relative or start with http:// or https://");
}

function normalizeAssetUrl(value: string, label: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.startsWith("/")) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  throw new Error(`${label} must be root-relative or start with http:// or https://`);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const snap = await adminDb.collection("appConfig").doc("site").get();
  if (!snap.exists) {
    return DEFAULT_SITE_SETTINGS;
  }

  const raw = snap.data() ?? {};
  return {
    siteTitle: toCleanString(raw.siteTitle) || DEFAULT_SITE_SETTINGS.siteTitle,
    siteDescription:
      toCleanString(raw.siteDescription) || DEFAULT_SITE_SETTINGS.siteDescription,
    faviconUrl: toCleanString(raw.faviconUrl),
    seoKeywords: toCleanString(raw.seoKeywords),
    seoImageUrl: toCleanString(raw.seoImageUrl),
  };
}

export async function updateSiteSettings(input: {
  siteTitle?: unknown;
  siteDescription?: unknown;
  faviconUrl?: unknown;
  seoKeywords?: unknown;
  seoImageUrl?: unknown;
}) {
  await requireAdminUser("manage_settings", "/admin/settings");
  const siteTitle = toCleanString(input.siteTitle) || DEFAULT_SITE_SETTINGS.siteTitle;
  const siteDescription =
    toCleanString(input.siteDescription) || DEFAULT_SITE_SETTINGS.siteDescription;
  const faviconUrl = normalizeFaviconUrl(toCleanString(input.faviconUrl));
  const seoKeywords = toCleanString(input.seoKeywords);
  const seoImageUrl = normalizeAssetUrl(toCleanString(input.seoImageUrl), "SEO image URL");

  await adminDb.collection("appConfig").doc("site").set(
    {
      siteTitle,
      siteDescription,
      faviconUrl,
      seoKeywords,
      seoImageUrl,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    siteTitle,
    siteDescription,
    faviconUrl,
    seoKeywords,
    seoImageUrl,
  };
}
