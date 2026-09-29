import type { Firestore } from "firebase-admin/firestore";
import { inngest } from "@/inngest/client";
import { nextRunAt, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { auditEvent } from "@/lib/audit/events";
import { clearAuditExecutionState } from "@/server/data/audit-retry";

export type MonitoringSession = {
  organizationId: string;
  scheduleId: string;
  documentId: string;
  createdBy: string;
  frequency: MonitorFrequency;
  runAt?: Date;
};

export async function startMonitoringSession(
  db: Firestore,
  input: MonitoringSession,
) {
  const runAt = input.runAt || new Date();
  const documentRef = db.doc(
    `organizations/${input.organizationId}/documents/${input.documentId}`,
  );
  const documentSnap = await documentRef.get();
  if (!documentSnap.exists) return null;

  const activeCandidates = await db
    .collection(`organizations/${input.organizationId}/audits`)
    .where("documentId", "==", input.documentId)
    .limit(20)
    .get();
  const active = activeCandidates.docs.find((candidate) =>
    ["QUEUED", "EXTRACTING", "MAPPING", "ANALYZING"].includes(String(candidate.data().status)),
  );
  if (active) return null;

  const audits = await db
    .collection(`organizations/${input.organizationId}/audits`)
    .where("documentId", "==", input.documentId)
    .limit(50)
    .get();

  const audit = audits.empty
    ? db.collection(`organizations/${input.organizationId}/audits`).doc()
    : audits.docs.sort(
        (a, b) =>
          Number(b.data().createdAt?.toMillis?.() || 0) -
          Number(a.data().createdAt?.toMillis?.() || 0),
      )[0].ref;

  const auditSnap = await audit.get();
  const previous = auditSnap.exists ? auditSnap.data() : undefined;
  const sessionNumber = Number(previous?.scheduleSessionNumber || 0) + 1;
  const scheduleSessionId = `schedule-${input.scheduleId}-${runAt.getTime()}-${input.documentId}`;
  const documentName = String(documentSnap.data()?.name || "Source document");

  // A scheduled run starts a fresh execution workspace. The source document
  // and its chunks remain authoritative; generated findings, evidence,
  // analysis runs, remediation and prior workforce trace are replaced.
  if (previous) {
    await clearAuditExecutionState(db, input.organizationId, audit.id);
  }

  await audit.set(
    {
      ...(previous || {}),
      title: `${documentName} — Monitoring session ${sessionNumber}`,
      documentName,
      documentId: input.documentId,
      documentIds: [input.documentId],
      status: "QUEUED",
      progress: 0,
      riskScore: null,
      riskSeverity: null,
      riskRationale: null,
      findingCount: 0,
      summary: null,
      controlMappings: [],
      controlMappingAnalysisRunId: null,
      complianceAnalysisRunId: null,
      riskAnalysisRunId: null,
      remediationAnalysisRunId: null,
      failureReason: null,
      failedAt: null,
      completedAt: null,
      createdBy: previous?.createdBy || input.createdBy,
      trigger: `Scheduled ${input.frequency.toLowerCase()} monitoring`,
      scheduleId: input.scheduleId,
      scheduleSessionId,
      scheduleSessionNumber: sessionNumber,
      scheduleFrequency: input.frequency,
      scheduleRunAt: runAt,
      updatedAt: runAt,
      createdAt: previous?.createdAt || runAt,
      schemaVersion: "v5.1",
    },
    { merge: true },
  );

  await documentRef.update({
    monitoringStatus: "MONITORING",
    monitoringScheduleId: input.scheduleId,
    monitoringScheduleFrequency: input.frequency,
    monitoringLastRunAt: runAt,
    monitoringSessionId: scheduleSessionId,
    monitoringSessionNumber: sessionNumber,
    monitoringNextRunAt: nextRunAt(input.frequency, runAt),
    updatedAt: runAt,
  });

  await db.doc(`organizations/${input.organizationId}/monitoringSchedules/${input.scheduleId}`).set({
    lastRunAt: runAt,
    nextRunAt: nextRunAt(input.frequency, runAt),
    updatedAt: runAt,
  }, { merge: true });

  await auditEvent(input.organizationId, audit.id, {
    type: "STATUS",
    agent: "Monitoring Agent",
    message: `Rescheduled monitoring session ${sessionNumber} queued at ${runAt.toISOString()} (${input.frequency}). Previous execution traces were cleared.`,
  });

  await inngest.send({
    name: "sentinel/audit.requested",
    data: {
      organizationId: input.organizationId,
      auditId: audit.id,
      documentId: input.documentId,
      documentIds: [input.documentId],
      scheduleId: input.scheduleId,
      scheduleSessionId,
      scheduleSessionNumber: sessionNumber,
      scheduleFrequency: input.frequency,
      scheduleRunAt: runAt.toISOString(),
      trigger: "RESCHEDULED_MONITORING",
    },
  });

  return {
    auditId: audit.id,
    scheduleSessionId,
    scheduleSessionNumber: sessionNumber,
  };
}

export async function refreshDocumentMonitoringState(
  db: Firestore,
  organizationId: string,
  scheduleId: string,
  documentIds: string[],
  frequency: MonitorFrequency,
  active: boolean,
  now = new Date(),
) {
  for (const documentId of documentIds) {
    const ref = db.doc(`organizations/${organizationId}/documents/${documentId}`);
    const snap = await ref.get();
    if (!snap.exists) continue;

    if (active) {
      await ref.update({
        monitoringStatus: "MONITORING",
        monitoringScheduleId: scheduleId,
        monitoringScheduleFrequency: frequency,
        monitoringNextRunAt: nextRunAt(frequency, now),
        updatedAt: now,
      });
      continue;
    }

    // Do not mark a document as paused if another active schedule still
    // monitors the same document.
    const schedules = await db
      .collection(`organizations/${organizationId}/monitoringSchedules`)
      .where("active", "==", true)
      .get();
    const replacement = schedules.docs
      .map((schedule) => ({ id: schedule.id, data: schedule.data() }))
      .find(({ id, data }) =>
        id !== scheduleId && Array.isArray(data.documentIds) && data.documentIds.map(String).includes(documentId),
      );

    if (replacement) {
      const replacementFrequency = String(replacement.data.frequency || "WEEKLY") as MonitorFrequency;
      await ref.update({
        monitoringStatus: "MONITORING",
        monitoringScheduleId: replacement.id,
        monitoringScheduleFrequency: replacementFrequency,
        monitoringNextRunAt: replacement.data.nextRunAt || nextRunAt(replacementFrequency, now),
        updatedAt: now,
      });
    } else {
      await ref.update({
        monitoringStatus: "PAUSED",
        monitoringScheduleId: null,
        monitoringScheduleFrequency: null,
        monitoringNextRunAt: null,
        updatedAt: now,
      });
    }
  }
}
