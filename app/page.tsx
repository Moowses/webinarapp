import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/server";

export default async function Home() {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    redirect("/login");
  }
  redirect(sessionUser.effectivePermissions.includes("view_admin") ? "/admin" : "/account");
}
