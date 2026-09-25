import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/server/firebase/admin";
import { evidenceRef } from "@/server/data/model";

export type EvidenceRecord = {
  id: string;
  findingId: string;
  documentId: string;
  page?: number;
  section?: string;
  text: string;
  reason: string;
  chunkId?: string;
  start?: number;
  end?: number;
};

export async function persistEvidence(organizationId: string, auditId: string, findingId: string, evidence: Omit<EvidenceRecord, "id" | "findingId">[]) {
  const db = getAdminDb();
  const ref = evidenceRef(db, organizationId, auditId);
  const batch = db.batch();
  const ids: string[] = [];
  evidence.forEach((item, index) => {
    const id = `${findingId}-e-${index}`;
    ids.push(id);
    batch.set(ref.doc(id), { ...item, id, findingId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  await batch.commit();
  return ids;
}
