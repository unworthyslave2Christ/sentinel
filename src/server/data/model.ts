import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";

export type AuditStatus = "QUEUED" | "EXTRACTING" | "MAPPING" | "ANALYZING" | "REVIEW" | "COMPLETED" | "FAILED";
export type FindingStatus = "OPEN" | "IN_REVIEW" | "ACCEPTED" | "DISMISSED" | "RESOLVED";
export type AnalysisRunStatus = "RUNNING" | "COMPLETED" | "FAILED";

export const orgPath = (organizationId: string) => `organizations/${organizationId}`;
export const organizationRef = (db: Firestore, organizationId: string) => db.doc(orgPath(organizationId));
export const documentsRef = (db: Firestore, organizationId: string) => db.collection(`${orgPath(organizationId)}/documents`);
export const documentRef = (db: Firestore, organizationId: string, documentId: string) => db.doc(`${orgPath(organizationId)}/documents/${documentId}`);
export const auditsRef = (db: Firestore, organizationId: string) => db.collection(`${orgPath(organizationId)}/audits`);
export const auditRef = (db: Firestore, organizationId: string, auditId: string) => db.doc(`${orgPath(organizationId)}/audits/${auditId}`);
export const findingsRef = (db: Firestore, organizationId: string, auditId: string) => db.collection(`${orgPath(organizationId)}/audits/${auditId}/findings`);
export const evidenceRef = (db: Firestore, organizationId: string, auditId: string) => db.collection(`${orgPath(organizationId)}/audits/${auditId}/evidence`);
export const eventsRef = (db: Firestore, organizationId: string, auditId: string) => db.collection(`${orgPath(organizationId)}/audits/${auditId}/events`);
export const analysisRunsRef = (db: Firestore, organizationId: string) => db.collection(`${orgPath(organizationId)}/analysisRuns`);
export const analysisRunRef = (db: Firestore, organizationId: string, analysisRunId: string) => db.doc(`${orgPath(organizationId)}/analysisRuns/${analysisRunId}`);
export const remediationRef = (db: Firestore, organizationId: string) => db.collection(`${orgPath(organizationId)}/remediationTasks`);
export const graphRef = (db: Firestore, organizationId: string) => db.collection(`${orgPath(organizationId)}/evidenceGraph`);

export function asRecord(snapshot: DocumentSnapshot) {
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}
