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

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

export async function persistEvidence(
  organizationId: string,
  auditId: string,
  findingId: string,
  items: any[],
) {
  const db = getAdminDb();

  const ref = db.collection(
    `organizations/${organizationId}/audits/${auditId}/evidence`,
  );

  const batch = db.batch();
  const ids: string[] = [];

  items.forEach((item, index) => {
    const id = `${findingId}-e-${index}`;
    ids.push(id);

    const data = withoutUndefined({
      ...item,
      id,
      findingId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(ref.doc(id), data, { merge: true });
  });

  await batch.commit();

  return ids;
}
