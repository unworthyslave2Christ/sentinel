import { auth } from "@/server/auth";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";

export const ROLES = [
  "OWNER",
  "ADMIN",
  "COMPLIANCE_MANAGER",
  "ANALYST",
  "REVIEWER",
  "VIEWER",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "VIEW",
  "UPLOAD_DOCUMENT",
  "ANALYZE",
  "MANAGE_CONTROLS",
  "MANAGE_MONITORING",
  "REVIEW",
  "MANAGE_MEMBERS",
  "VIEW_AUDIT_LOG",
  "EXPORT_REPORTS",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [...PERMISSIONS],
  COMPLIANCE_MANAGER: [
    "VIEW",
    "UPLOAD_DOCUMENT",
    "ANALYZE",
    "MANAGE_CONTROLS",
    "MANAGE_MONITORING",
    "REVIEW",
    "EXPORT_REPORTS",
  ],
  ANALYST: ["VIEW", "UPLOAD_DOCUMENT", "ANALYZE"],
  REVIEWER: ["VIEW", "REVIEW", "EXPORT_REPORTS"],
  VIEWER: ["VIEW"],
};

export type CurrentMember = {
  userId: string;
  organizationId: string;
  role: Role;
  email?: string;
};

export async function getCurrentMember(): Promise<CurrentMember | null> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId) return null;

  // V1-V3 already provision an organization and owner membership.
  const organizationId = await ensureOrganization(userId, email);
  const membership = await getAdminDb()
    .doc(`organizations/${organizationId}/members/${userId}`)
    .get();

  if (!membership.exists) return null;

  const data = membership.data() ?? {};
  return {
    userId,
    organizationId,
    role: (data.role ?? "VIEWER") as Role,
    email: email ?? undefined,
  };
}

export async function requirePermission(permission: Permission) {
  const member = await getCurrentMember();

  if (!member) throw new Error("UNAUTHENTICATED");
  if (!ROLE_PERMISSIONS[member.role]?.includes(permission)) {
    throw new Error("FORBIDDEN");
  }

  return member;
}
