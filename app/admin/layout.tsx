export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen bg-[#F7FAFC] text-[#1F2A37]">{children}</div>;
}
