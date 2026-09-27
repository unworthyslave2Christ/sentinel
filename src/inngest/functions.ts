import { createHash } from "node:crypto";
import { inngest } from "@/inngest/client";
import { getAdminDb } from "@/server/firebase/admin";
import { runComplianceAgent } from "@/ai/agents/compliance";
import {
  runControlAgent,
  runRemediationAgent,
  runRiskAgent,
} from "@/ai/agents/workforce";
import { auditEvent } from "@/lib/audit/events";
import { chunkText, retrieveChunks } from "@/lib/documents/chunk";
import { writeEvidenceGraph, graphNodeId } from "@/lib/evidence-graph";
import { persistEvidence } from "@/lib/evidence";
import {
  createAnalysisRun,
  finishAnalysisRun,
} from "@/server/data/analysis-runs";
import { nextRunAt, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { auditRef, documentsRef } from "@/server/data/model";

const weights = { LOW: 20, MEDIUM: 45, HIGH: 75, CRITICAL: 95 } as const;
const ACTIVE_AUDIT_STATUSES = ["QUEUED", "EXTRACTING", "MAPPING", "ANALYZING"];
const PROMPT_VERSIONS = {
  controls: "control-mapping-v5.1",
  compliance: "compliance-v5.1",
  risk: "risk-v5.1",
  remediation: "remediation-v5.1",
};
const modelName = () => process.env.AI_MODEL || "mistral-small-latest";

type DocumentRecord = {
  id: string;
  name: string;
  text: string;
  type?: string;
  organizationContext?: string;
};

async function controlsFor(db: any, organizationId: string) {
  const snap = await db
    .collection(`organizations/${organizationId}/policies`)
    .get();
  return snap.docs
    .flatMap((d: any) =>
      (d.data().controls || []).map(
        (c: any) => `${c.id}: ${c.title}\nRequirement: ${c.requirement}`,
      ),
    )
    .join("\n\n");
}

async function loadOrganizationDocuments(
  db: any,
  organizationId: string,
): Promise<DocumentRecord[]> {
  const snap = await documentsRef(db, organizationId)
    .where("status", "==", "READY")
    .limit(100)
    .get();
  const records: DocumentRecord[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const chunks = await d.ref
      .collection("chunks")
      .orderBy("order", "asc")
      .get();
    const text = chunks.docs
      .map((c: any) => String(c.data().text || ""))
      .join("\n");
    records.push({
      id: d.id,
      name: String(data.name || "Untitled document"),
      text,
      type: data.type,
      organizationContext: data.organizationContext,
    });
  }

  return records;
}

async function queueAudit(
  db: any,
  organizationId: string,
  documentId: string,
  createdBy: string,
  reason: string,
  schedule?: { id: string; frequency: MonitorFrequency; runAt: Date; sessionId: string },
) {
  const document = await db.doc(`organizations/${organizationId}/documents/${documentId}`).get();
  if (!document.exists) return null;
  const d = document.data() || {};

  const existing = await db
    .collection(`organizations/${organizationId}/audits`)
    .where("documentId", "==", documentId)
    .where("status", "in", ACTIVE_AUDIT_STATUSES)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].id;

  let audit: any = null;
  if (schedule?.id) {
    const scheduled = await db
      .collection(`organizations/${organizationId}/audits`)
      .where("documentId", "==", documentId)
      .limit(50)
      .get();
    if (!scheduled.empty) {
      const latest = scheduled.docs.sort((a: any, b: any) => Number(b.data().createdAt?.toMillis?.() || 0) - Number(a.data().createdAt?.toMillis?.() || 0))[0];
      audit = latest.ref;
    }
  }

  audit ||= db.collection(`organizations/${organizationId}/audits`).doc();
  const now = new Date();
  const sessionId = schedule?.sessionId || `manual-${now.getTime()}`;
  const previous = audit.path.includes("/") ? (await audit.get()).data() || {} : {};
  const sessionNumber = Number(previous.scheduleSessionNumber || 0) + (schedule ? 1 : 0);

  await audit.set({
    ...(previous || {}),
    title: `${d.name || "Document"} — ${reason}`,
    documentName: String(d.name || "Document"),
    documentId,
    documentIds: [documentId],
    status: "QUEUED",
    progress: 0,
    riskScore: null,
    riskSeverity: null,
    riskRationale: null,
    findingCount: 0,
    createdBy: previous.createdBy || createdBy,
    trigger: reason,
    schemaVersion: "v5.1",
    ...(schedule ? {
      scheduleId: schedule.id,
      scheduleSessionId: sessionId,
      scheduleSessionNumber: sessionNumber,
      scheduleFrequency: schedule.frequency,
      scheduleRunAt: schedule.runAt,
    } : {}),
    createdAt: previous.createdAt || now,
    updatedAt: now,
  }, { merge: true });

  await auditEvent(organizationId, audit.id, {
    type: "STATUS",
    agent: "Monitoring Agent",
    message: schedule
      ? `Monitoring session ${sessionNumber} queued (${schedule.frequency}).`
      : reason,
  });

  await inngest.send({
    name: "sentinel/audit.requested",
    data: {
      organizationId,
      auditId: audit.id,
      documentId,
      documentIds: [documentId],
      ...(schedule ? {
        scheduleId: schedule.id,
        scheduleSessionId: sessionId,
        scheduleFrequency: schedule.frequency,
        scheduleRunAt: schedule.runAt.toISOString(),
      } : {}),
    },
  });
  return audit.id;
}

async function tracked<T>(
  params: {
    organizationId: string;
    auditId: string;
    agent: Parameters<typeof createAnalysisRun>[0]["agent"];
    inputDocuments: string[];
    inputEvidence?: string[];
    promptVersion: string;
  },
  fn: (runId: string) => Promise<T>,
) {
  const runId = await createAnalysisRun({ ...params, model: modelName() });
  try {
    const output = await fn(runId);
    await finishAnalysisRun(params.organizationId, runId, "COMPLETED", output);
    return { runId, output };
  } catch (error) {
    await finishAnalysisRun(
      params.organizationId,
      runId,
      "FAILED",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

export const runAudit = inngest.createFunction(
  {
    id: "sentinel-run-audit-v5",
    retries: 2,

    triggers: [{ event: "sentinel/audit.requested" }],

    onFailure: async ({ event, error }) => {
      const {
        organizationId,
        auditId,
      } = event.data.event.data as {
        organizationId: string;
        auditId: string;
        documentId: string;
        documentIds?: string[];
      };

      const db = getAdminDb();

      await auditRef(
        db,
        organizationId,
        auditId,
      ).update({
        status: "FAILED",
        failureReason:
          error instanceof Error
            ? error.message
            : String(error),
        failedAt: new Date(),
        updatedAt: new Date(),
      });

      await auditEvent(
        organizationId,
        auditId,
        {
          type: "STATUS",
          agent: "Audit Orchestrator",
          message:
            "Audit execution failed after retries. The audit can be retried.",
        },
      );
    },
  },
  async ({ event, step }) => {
    const {
      organizationId,
      auditId,
      documentId,
      scheduleId,
      scheduleSessionId,
      scheduleFrequency,
      scheduleRunAt,
    } = event.data as {
      organizationId: string;
      auditId: string;
      documentId: string;
      documentIds?: string[];
      scheduleId?: string;
      scheduleSessionId?: string;
      scheduleFrequency?: MonitorFrequency;
      scheduleRunAt?: string;
    };
    const db = getAdminDb();
    const base = `organizations/${organizationId}/audits/${auditId}`;

    await step.run("start", async () => {
      await auditRef(db, organizationId, auditId).update({
        status: "MAPPING",
        progress: 10,
        updatedAt: new Date(),
        schemaVersion: "v5.1",
        ...(scheduleId ? {
          scheduleId,
          scheduleSessionId,
          scheduleFrequency,
          ...(scheduleRunAt ? { scheduleRunAt: new Date(scheduleRunAt) } : {}),
        } : {}),
      });
      await auditEvent(organizationId, auditId, {
        type: "STATUS",
        agent: "Ingestion Agent",
        message: "Loading stored Firestore source-text chunks.",
      });
    });

    const dSnap = await db
      .doc(`organizations/${organizationId}/documents/${documentId}`)
      .get();
    const d = dSnap.data();
    if (!d) throw new Error("Document not found");

    const text = await step.run("load-source-text", async () => {
      const chunks = await dSnap.ref
        .collection("chunks")
        .orderBy("order", "asc")
        .get();
      const extracted = chunks.docs
        .map((x: any) => String(x.data().text || ""))
        .join("\n");
      if (!extracted.trim()) throw new Error("Stored source text is empty");
      const contentHash = createHash("sha256")
        .update(extracted, "utf8")
        .digest("hex");
      if (d.contentHash && d.contentHash !== contentHash)
        throw new Error("Stored source text failed integrity validation");
      return extracted;
    });

    await step.run("persist-ingestion-state", async () => {
      await db
        .doc(`organizations/${organizationId}/documents/${documentId}`)
        .update({
          status: "READY",
          textLength: text.length,
          lastIngestedAt: new Date(),
          updatedAt: new Date(),
          schemaVersion: "v5.1",
        });
      await auditRef(db, organizationId, auditId).update({
        status: "MAPPING",
        progress: 20,
        updatedAt: new Date(),
      });
      await auditEvent(organizationId, auditId, {
        type: "AGENT",
        agent: "Ingestion Agent",
        message: `Validated ${text.length.toLocaleString()} stored characters.`,
      });
    });

    const docs = await step.run("load-corpus", async () => {
      const corpus = await loadOrganizationDocuments(db, organizationId);
      if (!corpus.find((x) => x.id === documentId))
        corpus.push({
          id: documentId,
          name: String(d.name),
          text,
          type: d.type,
        });
      return corpus;
    });
    const controls = await step.run("load-controls", async () =>
      controlsFor(db, organizationId),
    );
    const chunks = docs.flatMap((x) => chunkText(x.id, x.text));
    const selected = await step.run("retrieve-evidence", async () =>
      retrieveChunks(
        chunks,
        `${String(d.name)} compliance policy regulatory privacy security liability termination financial control obligation evidence`,
        20,
      ),
    );
    const evidenceCandidates = selected.map((x) => x.id);

    const mapping = await step.run("map-controls", async () => {
      await auditRef(db, organizationId, auditId).update({
        status: "MAPPING",
        progress: 35,
        updatedAt: new Date(),
      });
      const trackedResult = await tracked(
        {
          organizationId,
          auditId,
          agent: "Policy & Control Agent",
          inputDocuments: docs.map((x) => x.id),
          inputEvidence: evidenceCandidates,
          promptVersion: PROMPT_VERSIONS.controls,
        },
        () =>
          runControlAgent({
            text: selected
              .map((x) => `[${x.documentId}] ${x.text}`)
              .join("\n\n"),
            controls,
          }),
      );
      await auditRef(db, organizationId, auditId).update({
        controlMappings: trackedResult.output.mappings,
        controlMappingAnalysisRunId: trackedResult.runId,
        updatedAt: new Date(),
      });
      await auditEvent(organizationId, auditId, {
        type: "AGENT",
        agent: "Policy & Control Agent",
        analysisRunId: trackedResult.runId,
        message: `Mapped ${trackedResult.output.mappings.length} organizational control(s).`,
      });
      return trackedResult.output;
    });

    const compliance = await step.run("compliance-analysis", async () => {
      await auditRef(db, organizationId, auditId).update({
        status: "ANALYZING",
        progress: 55,
        updatedAt: new Date(),
      });
      await auditEvent(organizationId, auditId, {
        type: "AGENT",
        agent: "Compliance Agent",
        message: "Cross-document evidence analysis started.",
      });
      const trackedResult = await tracked(
        {
          organizationId,
          auditId,
          agent: "Compliance Agent",
          inputDocuments: docs.map((x) => x.id),
          inputEvidence: evidenceCandidates,
          promptVersion: PROMPT_VERSIONS.compliance,
        },
        () =>
          runComplianceAgent({
            documentId,
            title: String(d.name),
            text: selected
              .map((x) => `[Document ${x.documentId}]\n${x.text}`)
              .join("\n\n")
              .slice(0, 120000),
            context: d.organizationContext,
            controls,
          }),
      );
      await auditRef(db, organizationId, auditId).update({
        complianceAnalysisRunId: trackedResult.runId,
        updatedAt: new Date(),
      });
      return trackedResult;
    });

    const risk = await step.run("risk-assessment", async () => {
      await auditEvent(organizationId, auditId, {
        type: "AGENT",
        agent: "Risk Agent",
        message: "Risk assessment started.",
      });
      return tracked(
        {
          organizationId,
          auditId,
          agent: "Risk Agent",
          inputDocuments: docs.map((x) => x.id),
          inputEvidence: evidenceCandidates,
          promptVersion: PROMPT_VERSIONS.risk,
        },
        () => runRiskAgent({ findings: compliance.output.findings }),
      ).then(async (r) => {
        await auditRef(db, organizationId, auditId).update({
          riskAnalysisRunId: r.runId,
          updatedAt: new Date(),
        });
        return r;
      });
    });

    const remediation = await step.run("remediation", async () => {
      await auditEvent(organizationId, auditId, {
        type: "AGENT",
        agent: "Remediation Agent",
        message: "Preparing human-review remediation actions.",
      });
      return tracked(
        {
          organizationId,
          auditId,
          agent: "Remediation Agent",
          inputDocuments: docs.map((x) => x.id),
          inputEvidence: evidenceCandidates,
          promptVersion: PROMPT_VERSIONS.remediation,
        },
        () => runRemediationAgent({ findings: compliance.output.findings }),
      ).then(async (r) => {
        await auditRef(db, organizationId, auditId).update({
          remediationAnalysisRunId: r.runId,
          updatedAt: new Date(),
        });
        return r;
      });
    });

    await step.run("persist-workforce-output", async () => {
      const now = new Date();
      const findingsRef = db.collection(`${base}/findings`);
      const batch = db.batch();
      const graphNodes: any[] = [
        { type: "audit", label: String(d.name), refId: auditId },
      ];
      const graphEdges: any[] = [];
      const persisted: Array<{ id: string; finding: any }> = [];

      for (let i = 0; i < compliance.output.findings.length; i++) {
        const finding = compliance.output.findings[i];
        const sessionKey = scheduleSessionId || "initial";
        const safeSessionKey = sessionKey.replace(/[^a-zA-Z0-9_-]/g, "-");
        const ref = findingsRef.doc(`${safeSessionKey}-finding-${i}`);
        const evidenceIds = (finding.evidence || []).map(
          (_: any, j: number) => `${ref.id}-e-${j}`,
        );
        const sourceDocumentIds = [
          ...new Set((finding.evidence || []).map((e: any) => String(e.documentId))),
        ];
        const sourceDocumentNames = sourceDocumentIds.map(
          (id) => docs.find((doc) => doc.id === id)?.name,
        ).filter((name): name is string => Boolean(name));
        const sourceDocumentName = sourceDocumentNames.length === 1
          ? sourceDocumentNames[0]
          : sourceDocumentNames.join(", ");
        const data = {
          ...finding,
          status: "OPEN",
          agent: "Compliance Agent",
          riskScore: weights[finding.severity],
          remediation: remediation.output.actions[i] || null,
          evidenceIds,
          analysisRunId: compliance.runId,
          riskAnalysisRunId: risk.runId,
          remediationAnalysisRunId: remediation.runId,
          sourceDocumentIds,
          sourceDocumentNames,
          sourceDocumentName,
          trace: {
            auditId,
            controlIds: finding.controlIds || [],
            evidenceIds,
            analysisRunId: compliance.runId,
            riskAnalysisRunId: risk.runId,
            remediationAnalysisRunId: remediation.runId,
          },
          createdAt: now,
          updatedAt: now,
          schemaVersion: "v5.1",
          ...(scheduleSessionId ? {
            scheduleId: scheduleId || null,
            scheduleSessionId,
            scheduleFrequency: scheduleFrequency || null,
            scheduleRunAt: scheduleRunAt ? new Date(scheduleRunAt) : null,
          } : {}),
        };
        batch.set(ref, data);
        persisted.push({ id: ref.id, finding: data });
        graphNodes.push({
          type: "finding",
          label: finding.title,
          refId: ref.id,
          metadata: {
            severity: finding.severity,
            confidence: finding.confidence,
            analysisRunId: compliance.runId,
          },
        });

        const evidenceItems = (finding.evidence || []).map(
          (ev: any, j: number) => {
            const matchedChunk = selected.find(
              (c) =>
                c.documentId === ev.documentId &&
                typeof ev.text === "string" &&
                c.text.includes(ev.text.slice(0, 80)),
            );

            return {
              id: evidenceIds[j],
              documentId: ev.documentId,
              documentName: docs.find((doc) => doc.id === ev.documentId)?.name || sourceDocumentName || "Source document",
              ...(ev.page !== undefined ? { page: ev.page } : {}),
              ...(ev.section !== undefined ? { section: ev.section } : {}),
              text: ev.text,
              reason: ev.reason,
              ...(matchedChunk?.id
                ? { chunkId: matchedChunk.id }
                : {}),
              ...(scheduleSessionId ? { scheduleSessionId, scheduleId: scheduleId || null } : {}),
            };
          },
        )


        const persistedEvidenceIds = await persistEvidence(
          organizationId,
          auditId,
          ref.id,
          evidenceItems,
        );
        for (const ev of evidenceItems) {
            graphNodes.push({
            type: "evidence",
            label: ev.text.slice(0, 140),
            refId: ev.id,
            metadata: {
              documentId: ev.documentId,
              ...(ev.page !== undefined ? { page: ev.page } : {}),
              ...(ev.section !== undefined ? { section: ev.section } : {}),
              findingId: ref.id,
            },
          });
          graphEdges.push({
            from: graphNodeId(auditId, "finding", ref.id),
            to: graphNodeId(auditId, "evidence", ev.id),
            type: "SUPPORTED_BY",
          });
        }
        if (persistedEvidenceIds.length !== evidenceIds.length)
          throw new Error("Evidence persistence mismatch");
        for (const controlId of finding.controlIds || [])
          graphEdges.push({
            from: graphNodeId(auditId, "finding", ref.id),
            to: graphNodeId(auditId, "control", controlId),
            type: "MAPS_TO_CONTROL",
          });
      }
      await batch.commit();

      for (let i = 0; i < remediation.output.actions.length; i++) {
        const action = remediation.output.actions[i];
        const taskRef = db
          .collection(`organizations/${organizationId}/remediationTasks`)
          .doc(`${auditId}-${persisted[i]?.id || i}`);
        await taskRef.set({
          ...action,
          auditId,
          findingId: persisted[i]?.id || null,
          analysisRunId: remediation.runId,
          status: "OPEN",
          createdAt: now,
          updatedAt: now,
          schemaVersion: "v5.1",
          ...(scheduleSessionId ? { scheduleId: scheduleId || null, scheduleSessionId } : {}),
        });
        if (persisted[i]?.id) {
          await findingsRef
            .doc(persisted[i].id)
            .update({
              remediationTaskId: taskRef.id,
              trace: {
                ...(persisted[i].finding.trace || {}),
                remediationTaskId: taskRef.id,
              },
              updatedAt: now,
            });
        }
      }
      for (const doc of docs) {
        graphNodes.push({ type: "document", label: doc.name, refId: doc.id });
        graphEdges.push({
          from: graphNodeId(auditId, "audit", auditId),
          to: graphNodeId(auditId, "document", doc.id),
          type: "USES_DOCUMENT",
        });
      }
      controls
        .split("\n\n")
        .filter(Boolean)
        .forEach((control: string) => {
          const id = control.split(":")[0];
          graphNodes.push({
            type: "control",
            label: control.split("\n")[0],
            refId: id,
          });
        });
      await writeEvidenceGraph(organizationId, auditId, graphNodes, graphEdges);
      await auditRef(db, organizationId, auditId).update({
        status: "REVIEW",
        progress: 100,
        riskScore: risk.output.score,
        riskSeverity: risk.output.overallSeverity,
        riskRationale: risk.output.rationale,
        findingCount: persisted.length,
        summary: compliance.output.summary,
        controlMappings: mapping.mappings,
        completedAt: now,
        updatedAt: now,
        schemaVersion: "v5.1",
      });
      await auditEvent(organizationId, auditId, {
        type: "STATUS",
        agent: "Risk Agent",
        message: `Workforce completed: ${persisted.length} finding(s), risk ${risk.output.score}.`,
      });
    });

    return {
      auditId,
      findingCount: compliance.output.findings.length,
      riskScore: risk.output.score,
    };
  },
);

export const monitorSchedules = inngest.createFunction(
  {
    id: "sentinel-monitor-schedules-v5",
    retries: 1,
    triggers: [{ cron: "* * * * *" }],
  },
  async ({ step }) => {
    const db = getAdminDb();
    const now = new Date();
    const schedules = await step.run("load-due-schedules", async () =>
      (
        await db
          .collectionGroup("monitoringSchedules")
          .where("active", "==", true)
          .where("nextRunAt", "<=", now)
          .limit(50)
          .get()
      ).docs.map((d: any) => ({ id: d.id, path: d.ref.path, ...d.data() })),
    );
    let queued = 0;
    for (const schedule of schedules)
      await step.run(`schedule-${schedule.id}`, async () => {
        const organizationId = String(schedule.path).split("/")[1];
        for (const documentId of schedule.documentIds || [])
          if (
            await queueAudit(
              db,
              organizationId,
              String(documentId),
              String(schedule.createdBy),
              `Scheduled ${String(schedule.frequency).toLowerCase()} monitoring`,
              {
                id: String(schedule.id),
                frequency: schedule.frequency as MonitorFrequency,
                runAt: now,
                sessionId: `schedule-${String(schedule.id)}-${now.getTime()}`,
              },
            )
          ) queued++;
        const frequency = schedule.frequency as MonitorFrequency;
        await db
          .doc(schedule.path)
          .update({
            lastRunAt: now,
            nextRunAt: nextRunAt(frequency, now),
            updatedAt: new Date(),
          });
      });
    return { schedules: schedules.length, queued };
  },
);

export const functions = [runAudit, monitorSchedules];
