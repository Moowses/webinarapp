"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_DEFINITIONS,
  USER_PERMISSIONS,
  type UserPermission,
  type UserRole,
} from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/server";

type Props = {
  currentUid: string;
  users: SessionUser[];
  onSave: (formData: FormData) => Promise<{ ok: true }>;
  onCreate: (formData: FormData) => Promise<{
    ok: true;
    email: string;
    temporaryPassword: string;
  }>;
  onSendReset: (formData: FormData) => Promise<{
    ok: true;
    email: string;
  }>;
  onDelete: (formData: FormData) => Promise<{ ok: true }>;
};

type EditableRow = {
  uid: string;
  role: UserRole;
  disabled: boolean;
  grantedPermissions: UserPermission[];
};

type InviteResult = {
  email: string;
  temporaryPassword: string;
};

function buildInitialRows(users: SessionUser[]): Record<string, EditableRow> {
  return Object.fromEntries(
    users.map((user) => [
      user.uid,
      {
        uid: user.uid,
        role: user.role,
        disabled: user.disabled,
        grantedPermissions: user.effectivePermissions,
      },
    ])
  );
}

function formatPermissionLabel(permission: UserPermission) {
  return permission
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRolePermissions(role: UserRole) {
  return ROLE_DEFINITIONS[role].permissions;
}

function getUserStatus(user: SessionUser) {
  if (user.disabled) return { label: "Disabled", tone: "slate" as const };
  if (user.mustSetPassword) return { label: "Pending password", tone: "orange" as const };
  return { label: "Active", tone: "blue" as const };
}

const inputClass =
  "w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#172B4D] outline-none transition focus:border-[#175CD3] focus:ring-4 focus:ring-[#175CD3]/10";

export default function UserManagementPanel({
  currentUid,
  users,
  onSave,
  onCreate,
  onSendReset,
  onDelete,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, EditableRow>>(() => buildInitialRows(users));
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteResultOpen, setIsInviteResultOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("user");
  const [createGrantedPermissions, setCreateGrantedPermissions] = useState<UserPermission[]>(
    () => getRolePermissions("user")
  );

  useEffect(() => {
    setRows(buildInitialRows(users));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.displayName, user.email, ROLE_DEFINITIONS[user.role].label]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, users]);

  const editingUser = users.find((user) => user.uid === editingUid) ?? null;
  const editingRow = editingUser ? rows[editingUser.uid] : null;

  function updateRow(uid: string, patch: Partial<EditableRow>) {
    setRows((current) => {
      return {
        ...current,
        [uid]: {
          ...current[uid],
          ...patch,
        },
      };
    });
  }

  function openEditModal(uid: string) {
    setMessage(null);
    setError(null);
    setEditingUid(uid);
  }

  function closeEditModal() {
    setEditingUid(null);
    setRows(buildInitialRows(users));
  }

  function closeCreateModal() {
    setIsCreateOpen(false);
    setCreateEmail("");
    setCreateDisplayName("");
    setCreateRole("user");
    setCreateGrantedPermissions(getRolePermissions("user"));
  }

  function closeInviteResultModal() {
    setIsInviteResultOpen(false);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
      window.setTimeout(() => setCopyMessage(null), 1800);
    } catch {
      setCopyMessage("Copy failed.");
      window.setTimeout(() => setCopyMessage(null), 1800);
    }
  }

  function toggleCreatePermission(permission: UserPermission) {
    setCreateGrantedPermissions((current) => {
      const next = current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission];
      return [...new Set(next)];
    });
  }

  function toggleEditPermission(permission: UserPermission) {
    if (!editingUser || !editingRow) return;
    const next = editingRow.grantedPermissions.includes(permission)
      ? editingRow.grantedPermissions.filter((value) => value !== permission)
      : [...editingRow.grantedPermissions, permission];
    updateRow(editingUser.uid, { grantedPermissions: [...new Set(next)] });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setMessage(null);
    setError(null);
    setInviteResult(null);

    try {
      const formData = new FormData();
      formData.set("email", createEmail.trim());
      formData.set("displayName", createDisplayName.trim());
      formData.set("role", createRole);
      createGrantedPermissions.forEach((permission) =>
        formData.append("grantedPermissions", permission)
      );
      const result = await onCreate(formData);
      setInviteResult(result);
      setMessage(`User ${result.email} created.`);
      closeCreateModal();
      setIsInviteResultOpen(true);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create user.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSave() {
    if (!editingUser || !editingRow) return;

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("uid", editingRow.uid);
      formData.set("role", editingRow.role);
      formData.set("disabled", editingRow.disabled ? "true" : "false");
      editingRow.grantedPermissions.forEach((permission) =>
        formData.append("grantedPermissions", permission)
      );
      await onSave(formData);
      setMessage("User access updated.");
      setEditingUid(null);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update access.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendReset() {
    if (!editingUser) return;

    setIsSendingReset(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("uid", editingUser.uid);
      const result = await onSendReset(formData);
      setMessage(`Password reset email sent to ${result.email}.`);
      setEditingUid(null);
      router.refresh();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to send reset password.");
    } finally {
      setIsSendingReset(false);
    }
  }

  async function handleDelete() {
    if (!editingUser) return;

    setIsDeleting(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("uid", editingUser.uid);
      await onDelete(formData);
      setMessage("User account deleted.");
      setEditingUid(null);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#D8E1EA] bg-white px-8 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7B8794]">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#172B4D]">User Management</h1>
            <p className="mt-2 text-sm text-[#5E6C84]">
              View users, create a new user, and edit access from focused modals.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setError(null);
              setInviteResult(null);
              setIsCreateOpen(true);
            }}
            className="rounded-xl bg-[#175CD3] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1849A9]"
          >
            Add user
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#D8E1EA] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[#172B4D]">Users</h2>
            <p className="mt-1 text-sm text-[#5E6C84]">{filteredUsers.length} users shown</p>
          </div>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            className="w-full max-w-sm rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#172B4D] outline-none transition focus:border-[#175CD3] focus:ring-4 focus:ring-[#175CD3]/10"
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#E2E8F0]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-[#5E6C84]">
              <tr>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Access</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const status = getUserStatus(user);
                return (
                  <tr key={user.uid} className="border-t border-[#E2E8F0] bg-white">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#172B4D]">
                        {user.displayName || user.email || user.uid}
                      </div>
                      <div className="mt-1 text-xs text-[#5E6C84]">{user.email || "No email"}</div>
                    </td>
                    <td className="px-5 py-4 text-[#344054]">{ROLE_DEFINITIONS[user.role].label}</td>
                    <td className="px-5 py-4">
                      <StatusChip label={status.label} tone={status.tone} />
                    </td>
                    <td className="px-5 py-4 text-[#5E6C84]">
                      {user.effectivePermissions.length} enabled
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(user.uid)}
                        className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#5E6C84]">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateOpen ? (
        <ModalShell
          title="Create user"
          description="Create a user by email and choose exactly which access this user should have."
          onClose={closeCreateModal}
        >
          <form onSubmit={handleCreate} className="space-y-5">
            <Field label="Email">
              <input
                type="email"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                className={inputClass}
                placeholder="new.user@example.com"
                required
              />
            </Field>

            <Field label="Display name">
              <input
                type="text"
                value={createDisplayName}
                onChange={(event) => setCreateDisplayName(event.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </Field>

            <Field label="Role">
              <select
                value={createRole}
                onChange={(event) => {
                  const nextRole = event.target.value as UserRole;
                  setCreateRole(nextRole);
                  setCreateGrantedPermissions((current) => {
                    const nextDefaults = getRolePermissions(nextRole);
                    const currentExtras = current.filter(
                      (permission) => !getRolePermissions(createRole).includes(permission)
                    );
                    return [...new Set([...nextDefaults, ...currentExtras])];
                  });
                }}
                className={inputClass}
              >
                {Object.entries(ROLE_DEFINITIONS).map(([roleKey, value]) => (
                  <option key={roleKey} value={roleKey}>
                    {value.label}
                  </option>
                ))}
              </select>
            </Field>

            <PermissionGroup
              role={createRole}
              grantedPermissions={createGrantedPermissions}
              onToggle={toggleCreatePermission}
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-xl bg-[#175CD3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1849A9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {editingUser && editingRow ? (
        <ModalShell
          title="Edit user"
          description={`${editingUser.displayName || editingUser.email || editingUser.uid}`}
          onClose={closeEditModal}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[#7B8794]">User</div>
              <div className="mt-2 text-lg font-semibold text-[#172B4D]">
                {editingUser.displayName || editingUser.email || editingUser.uid}
              </div>
              <div className="mt-1 text-sm text-[#5E6C84]">{editingUser.email || "No email"}</div>
            </div>

            <Field label="Role">
              <select
                value={editingRow.role}
                onChange={(event) =>
                  updateRow(editingUser.uid, (() => {
                    const nextRole = event.target.value as UserRole;
                    const currentExtras = editingRow.grantedPermissions.filter(
                      (permission) => !getRolePermissions(editingRow.role).includes(permission)
                    );
                    return {
                      role: nextRole,
                      grantedPermissions: [...new Set([...getRolePermissions(nextRole), ...currentExtras])],
                    };
                  })())
                }
                className={inputClass}
              >
                {Object.entries(ROLE_DEFINITIONS).map(([roleKey, value]) => (
                  <option key={roleKey} value={roleKey}>
                    {value.label}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-sm text-[#172B4D]">
              <input
                type="checkbox"
                checked={editingRow.disabled}
                disabled={editingUser.uid === currentUid}
                onChange={(event) => updateRow(editingUser.uid, { disabled: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-[#C7D5E3] text-[#175CD3] focus:ring-[#175CD3]"
              />
              <span>
                <span className="block font-semibold">Disable account</span>
                <span className="mt-1 block text-xs text-[#5E6C84]">
                  {editingUser.uid === currentUid
                    ? "You cannot disable your own account."
                    : "Disabled users cannot sign in."}
                </span>
              </span>
            </label>

            <PermissionGroup
              role={editingRow.role}
              grantedPermissions={editingRow.grantedPermissions}
              onToggle={toggleEditPermission}
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleSendReset()}
                disabled={isSendingReset || isSaving || isDeleting}
                className="rounded-xl border border-[#175CD3] bg-white px-4 py-2.5 text-sm font-semibold text-[#175CD3] transition hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingReset ? "Sending reset..." : "Send reset password"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={editingUser.uid === currentUid || isDeleting || isSaving || isSendingReset}
                className="rounded-xl border border-[#D92D20] bg-white px-4 py-2.5 text-sm font-semibold text-[#D92D20] transition hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete account"}
              </button>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSaving || isSendingReset || isDeleting}
                className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="rounded-xl bg-[#175CD3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1849A9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {isInviteResultOpen && inviteResult ? (
        <ModalShell
          title="User created"
          description="Share these credentials with the user so they can sign in and create their own password."
          onClose={closeInviteResultModal}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[#7B8794]">Email</div>
                <button
                  type="button"
                  onClick={() => void copyText(inviteResult.email, "Email")}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC]"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 text-lg font-semibold text-[#172B4D]">{inviteResult.email}</div>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[#7B8794]">Temporary password</div>
                <button
                  type="button"
                  onClick={() => void copyText(inviteResult.temporaryPassword, "Temporary password")}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC]"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 break-all font-mono text-lg font-semibold text-[#172B4D]">
                {inviteResult.temporaryPassword}
              </div>
            </div>

            {copyMessage ? (
              <div className="rounded-2xl border border-[#D6EAF8] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1849A9]">
                {copyMessage}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#D6EAF8] bg-[#EFF6FF] p-4 text-sm text-[#1849A9]">
              User should go to <span className="font-semibold">`/login`</span>, sign in with the temporary password, then create a new password on first access.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeInviteResultModal}
                className="rounded-xl bg-[#175CD3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1849A9]"
              >
                Done
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {message ? <div className="rounded-2xl bg-[#E8F1FF] px-4 py-3 text-sm text-[#1849A9]">{message}</div> : null}
      {error ? <div className="rounded-2xl bg-[#FFF4ED] px-4 py-3 text-sm text-[#B54708]">{error}</div> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-[#344054]">
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-[0_32px_80px_rgba(16,24,40,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#172B4D]">{title}</h2>
            <p className="mt-1 text-sm text-[#5E6C84]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#172B4D] transition hover:bg-[#F8FAFC]"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "blue" | "orange" | "slate";
}) {
  const className =
    tone === "blue"
      ? "bg-[#E9F2FF] text-[#175CD3]"
      : tone === "orange"
        ? "bg-[#FFF1E8] text-[#C4320A]"
        : "bg-[#F2F4F7] text-[#344054]";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function PermissionGroup({
  role,
  grantedPermissions,
  onToggle,
}: {
  role: UserRole;
  grantedPermissions: UserPermission[];
  onToggle: (permission: UserPermission) => void;
}) {
  const rolePermissions = getRolePermissions(role);
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#172B4D]">Permissions</div>
          <div className="mt-1 text-sm text-[#5E6C84]">
            Role templates start prechecked, but you can uncheck or add permissions for this user.
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344054]">
          {grantedPermissions.length} enabled
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {USER_PERMISSIONS.map((permission) => {
          const templated = rolePermissions.includes(permission);
          const checked = grantedPermissions.includes(permission);
          return (
            <label
              key={permission}
              className={`rounded-2xl border px-4 py-4 transition ${
                checked ? "border-[#B2CCFF] bg-white shadow-sm" : "border-[#E2E8F0] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#172B4D]">{formatPermissionLabel(permission)}</div>
                  <div className="mt-1 text-xs text-[#5E6C84]">
                    {templated ? "Included in this role template, but can be removed." : "Optional per-user access."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {templated ? <StatusChip label="Template" tone="slate" /> : null}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(permission)}
                    className="mt-1 h-4 w-4 rounded border-[#C7D5E3] text-[#175CD3] focus:ring-[#175CD3]"
                  />
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
