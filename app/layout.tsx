import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientErrorLogger from "@/components/system/ClientErrorLogger";
import { getSiteSettings } from "@/lib/site-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const keywords = settings.seoKeywords
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const images = settings.seoImageUrl ? [settings.seoImageUrl] : undefined;

  return {
    title: settings.siteTitle,
    description: settings.siteDescription,
    keywords,
    icons: settings.faviconUrl
      ? {
          icon: settings.faviconUrl,
          shortcut: settings.faviconUrl,
          apple: settings.faviconUrl,
        }
      : undefined,
    openGraph: {
      title: settings.siteTitle,
      description: settings.siteDescription,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: settings.siteTitle,
      description: settings.siteDescription,
      images,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientErrorLogger />
        {children}
      </body>
    </html>
  );
}
