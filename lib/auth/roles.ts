export const USER_ROLES = ["admin", "editor", "dev", "user"] as const;

export const USER_PERMISSIONS = [
  "view_admin",
  "manage_settings",
  "manage_users",
  "webinar_create",
  "webinar_edit_basic",
  "webinar_edit_video",
  "webinar_edit_bot",
  "webinar_edit_webhook",
  "webinar_edit_attendance_webhook",
  "webinar_edit_schedule",
  "webinar_edit_predefined_chat",
  "webinar_edit_registration_page",
  "webinar_edit_confirmation_page",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserPermission = (typeof USER_PERMISSIONS)[number];

export type RoleDefinition = {
  label: string;
  description: string;
  permissions: UserPermission[];
};

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  admin: {
    label: "Admin",
    description: "Full dashboard access, settings, user management, and custom privilege assignment.",
    permissions: [...USER_PERMISSIONS],
  },
  editor: {
    label: "Editor",
    description: "Can create webinars and manage content sections except webhook administration.",
    permissions: [
      "view_admin",
      "webinar_create",
      "webinar_edit_basic",
      "webinar_edit_video",
      "webinar_edit_bot",
      "webinar_edit_schedule",
      "webinar_edit_predefined_chat",
      "webinar_edit_registration_page",
      "webinar_edit_confirmation_page",
    ],
  },
  dev: {
    label: "Tech / Dev",
    description: "Can access webhook sections and testing tools without editing the rest of the webinar.",
    permissions: [
      "view_admin",
      "webinar_edit_webhook",
      "webinar_edit_attendance_webhook",
    ],
  },
  user: {
    label: "User",
    description: "Standard signed-in account with profile and password reset access only.",
    permissions: [],
  },
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function isUserPermission(value: unknown): value is UserPermission {
  return typeof value === "string" && USER_PERMISSIONS.includes(value as UserPermission);
}

export function normalizePermissions(input: unknown): UserPermission[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter(isUserPermission))];
}

export function getEffectivePermissions(
  role: UserRole,
  customPermissions: UserPermission[] = [],
  excludedPermissions: UserPermission[] = []
): UserPermission[] {
  const granted = new Set([...ROLE_DEFINITIONS[role].permissions, ...customPermissions]);
  excludedPermissions.forEach((permission) => granted.delete(permission));
  return [...granted];
}

export function hasPermission(
  role: UserRole,
  customPermissions: UserPermission[] | undefined,
  excludedPermissions: UserPermission[] | undefined,
  permission: UserPermission
): boolean {
  return getEffectivePermissions(role, customPermissions, excludedPermissions).includes(permission);
}
