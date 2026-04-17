import UserManagementPanel from "@/components/admin/UserManagementPanel";
import AdminSidebar from "@/components/admin/AdminSidebar";
import {
  isUserPermission,
  isUserRole,
  type UserPermission,
} from "@/lib/auth/roles";
import {
  createManagedUser,
  deleteManagedUser,
  listAllManagedUsers,
  requireAdminUser,
  sendManagedUserPasswordReset,
  updateManagedUserAccess,
} from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminUserManagementPage() {
  const sessionUser = await requireAdminUser("manage_users", "/admin/settings/users");
  const users = await listAllManagedUsers();

  async function updateAction(formData: FormData) {
    "use server";

    const actor = await requireAdminUser("manage_users", "/admin/settings/users");
    const uid = String(formData.get("uid") ?? "").trim();
    const roleValue = formData.get("role");
    const role = isUserRole(roleValue) ? roleValue : null;
    const grantedPermissions = formData
      .getAll("grantedPermissions")
      .filter(isUserPermission) as UserPermission[];
    const disabled = formData.get("disabled") === "true";

    if (!uid) throw new Error("User ID is required.");
    if (!role) throw new Error("A valid role is required.");
    if (uid === actor.uid && disabled) {
      throw new Error("You cannot disable your own account.");
    }

    await updateManagedUserAccess({
      uid,
      role,
      grantedPermissions,
      disabled,
    });

    return { ok: true as const };
  }

  async function createAction(formData: FormData) {
    "use server";

    await requireAdminUser("manage_users", "/admin/settings/users");
    const email = String(formData.get("email") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const roleValue = formData.get("role");
    const role = isUserRole(roleValue) ? roleValue : null;
    const grantedPermissions = formData
      .getAll("grantedPermissions")
      .filter(isUserPermission) as UserPermission[];

    if (!email) throw new Error("Email is required.");
    if (!role) throw new Error("A valid role is required.");

    const result = await createManagedUser({
      email,
      displayName,
      role,
      grantedPermissions,
    });

    return {
      ok: true as const,
      email: result.email,
      temporaryPassword: result.temporaryPassword,
    };
  }

  async function sendResetAction(formData: FormData) {
    "use server";

    await requireAdminUser("manage_users", "/admin/settings/users");
    const uid = String(formData.get("uid") ?? "").trim();
    if (!uid) throw new Error("User ID is required.");

    const result = await sendManagedUserPasswordReset(uid);
    return {
      ok: true as const,
      email: result.email,
    };
  }

  async function deleteAction(formData: FormData) {
    "use server";

    const actor = await requireAdminUser("manage_users", "/admin/settings/users");
    const uid = String(formData.get("uid") ?? "").trim();
    if (!uid) throw new Error("User ID is required.");
    if (uid === actor.uid) throw new Error("You cannot delete your own account.");

    await deleteManagedUser(uid);
    return { ok: true as const };
  }

  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-6 text-[#1F2A37] sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <AdminSidebar
          currentPath="/admin/settings/users"
          currentUser={{
            displayName: sessionUser.displayName,
            email: sessionUser.email,
            canManageSettings: sessionUser.effectivePermissions.includes("manage_settings"),
            canManageUsers: sessionUser.effectivePermissions.includes("manage_users"),
          }}
        />
        <UserManagementPanel
          currentUid={sessionUser.uid}
          users={users}
          onSave={updateAction}
          onCreate={createAction}
          onSendReset={sendResetAction}
          onDelete={deleteAction}
        />
      </div>
    </main>
  );
}
