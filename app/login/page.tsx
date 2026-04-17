import { redirect } from "next/navigation";
import LoginClient from "@/components/auth/LoginClient";
import { getCurrentSessionUser } from "@/lib/auth/server";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sessionUser = await getCurrentSessionUser();
  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/account";

  if (sessionUser) {
    redirect(sessionUser.effectivePermissions.includes("view_admin") ? "/admin" : "/account");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#EFF8FF,transparent_32%),linear-gradient(180deg,#FFFDF8_0%,#F6FAFD_100%)] px-4 py-10 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <LoginClient nextPath={nextPath} />
      </div>
    </main>
  );
}
