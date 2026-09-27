import type { Firestore, Query } from "firebase-admin/firestore";

async function deleteQuery(
  db: Firestore,
  query: Query,
) {
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) return;

    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();

    if (snap.size < 400) return;
  }
}

export async function clearAuditExecutionState(
  db: Firestore,
  organizationId: string,
  auditId: string,
) {
  const auditBase = `organizations/${organizationId}/audits/${auditId}`;

  // Remove generated audit output/traces. The source document and its chunks
  // are intentionally preserved so a retry reuses the authoritative source.
  await deleteQuery(db, db.collection(`${auditBase}/findings`));
  await deleteQuery(db, db.collection(`${auditBase}/evidence`));
  await deleteQuery(db, db.collection(`${auditBase}/events`));

  // AnalysisRuns live at organization scope and are linked to the audit.
  await deleteQuery(
    db,
    db
      .collection(`organizations/${organizationId}/analysisRuns`)
      .where("auditId", "==", auditId),
  );

  // Remove derived graph/remediation records from the previous failed run.
  await deleteQuery(
    db,
    db
      .collection(`organizations/${organizationId}/evidenceGraph`)
      .where("auditId", "==", auditId),
  );

  await deleteQuery(
    db,
    db
      .collection(`organizations/${organizationId}/remediationTasks`)
      .where("auditId", "==", auditId),
  );
}
