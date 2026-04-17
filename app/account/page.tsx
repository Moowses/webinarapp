import AccountClient from "@/components/auth/AccountClient";
import { ROLE_DEFINITIONS } from "@/lib/auth/roles";
import { requireSignedInUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const sessionUser = await requireSignedInUser("/account");
  const canAccessAdmin = sessionUser.effectivePermissions.includes("view_admin");

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <AccountClient
          email={sessionUser.email}
          displayName={sessionUser.displayName}
          roleLabel={ROLE_DEFINITIONS[sessionUser.role].label}
          canAccessAdmin={canAccessAdmin}
          mustSetPassword={sessionUser.mustSetPassword}
        />
      </div>
    </main>
  );
}
