import { inngest } from "@/inngest/client";
import { type Firestore } from "firebase-admin/firestore";
import type { MonitorFrequency } from "@/lib/monitoring/schedule";
import { auditEvent } from "@/lib/audit/events";

const ACTIVE_AUDIT_STATUSES = ["QUEUED", "EXTRACTING", "MAPPING", "ANALYZING"];

export async function queueAudit(
  db: Firestore,
  organizationId: string,
  documentId: string,
  createdBy: string,
  reason: string,
  schedule?: { id: string; frequency: MonitorFrequency; scheduledAt: Date; active?: boolean },
) {
  const document = await db
    .doc(`organizations/${organizationId}/documents/${documentId}`)
    .get();
  if (!document.exists) return null;
  const existing = await db
    .collection(`organizations/${organizationId}/audits`)
    .where("documentId", "==", documentId)
    .where("status", "in", ACTIVE_AUDIT_STATUSES)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].id;
  const d = document.data() || {};
  const audit = db.collection(`organizations/${organizationId}/audits`).doc();
  const now = new Date();
  const scheduleSessionId = schedule
    ? `${schedule.id}-${schedule.scheduledAt.getTime()}`
    : null;
  await audit.set({
    title: `${d.name || "Document"} — ${reason}`,
    documentName: String(d.name || "Document"),
    documentId,
    documentIds: [documentId],
    status: "QUEUED",
    progress: 0,
    riskScore: null,
    findingCount: 0,
    createdBy,
    trigger: reason,
    scheduleId: schedule?.id || null,
    scheduleSessionId,
    scheduleFrequency: schedule?.frequency || null,
    scheduleRunAt: schedule?.scheduledAt || null,
    scheduleActive: schedule?.active ?? true,
    schemaVersion: "v5.1",
    createdAt: now,
    updatedAt: now,
  });
  await auditEvent(organizationId, audit.id, {
    type: "STATUS",
    agent: "Monitoring Agent",
    message: reason,
  });
  await inngest.send({
    name: "sentinel/audit.requested",
    data: {
      organizationId,
      auditId: audit.id,
      documentId,
      documentIds: [documentId],
      scheduleId: schedule?.id || null,
      scheduleSessionId,
      scheduleFrequency: schedule?.frequency || null,
      scheduleRunAt: schedule?.scheduledAt || null,
      scheduleActive: schedule?.active ?? true,
    },
  });
  return audit.id;
}
