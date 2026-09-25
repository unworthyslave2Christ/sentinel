import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/server/firebase/admin";
import type { CurrentMember } from "./authorization";

export type SecurityAction =
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_CHANGED"
  | "AUDIT_STARTED"
  | "FINDING_STATUS_CHANGED"
  | "MONITORING_SCHEDULE_CREATED"
  | "MONITORING_SCHEDULE_UPDATED"
  | "CONTROL_CREATED"
  | "POLICY_CREATED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "REPORT_EXPORTED";

export async function logSecurityEvent(
  member: CurrentMember,
  action: SecurityAction,
  metadata: Record<string, unknown> = {},
) {
  await getAdminDb()
    .collection(`organizations/${member.organizationId}/securityAuditLogs`)
    .add({
      organizationId: member.organizationId,
      actorUserId: member.userId,
      actorEmail: member.email ?? null,
      action,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
    });
}
