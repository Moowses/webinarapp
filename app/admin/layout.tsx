import { requireAdminUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminUser("view_admin", "/admin");
  return <div className="min-h-screen bg-[#F7FAFC] text-[#1F2A37]">{children}</div>;
}
