import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/server/firebase/admin";
import { analysisRunRef } from "@/server/data/model";
import type { AnalysisRunStatus } from "@/server/data/model";

export type AgentName = "Ingestion Agent" | "Policy & Control Agent" | "Compliance Agent" | "Risk Agent" | "Remediation Agent";

export type AnalysisRunInput = {
  organizationId: string;
  auditId: string;
  agent: AgentName;
  model: string;
  promptVersion: string;
  inputDocuments: string[];
  inputEvidence?: string[];
};

export async function createAnalysisRun(input: AnalysisRunInput) {
  const db = getAdminDb();
  const ref = db.collection(`organizations/${input.organizationId}/analysisRuns`).doc();
  await ref.set({
    auditId: input.auditId,
    agent: input.agent,
    model: input.model,
    modelVersion: process.env.AI_MODEL_VERSION || input.model,
    promptVersion: input.promptVersion,
    inputDocuments: input.inputDocuments,
    inputEvidence: input.inputEvidence || [],
    status: "RUNNING" satisfies AnalysisRunStatus,
    startedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function finishAnalysisRun(organizationId: string, id: string, status: Exclude<AnalysisRunStatus, "RUNNING">, output?: unknown, error?: string) {
  await analysisRunRef(getAdminDb(), organizationId, id).set({
    status,
    output: output ?? null,
    error: error ?? null,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
