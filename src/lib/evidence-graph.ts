import { getAdminDb } from "@/server/firebase/admin";
import { graphRef } from "@/server/data/model";

type Node = { type: string; label: string; refId?: string; metadata?: Record<string, unknown> };
type Edge = { from: string; to: string; type: string; metadata?: Record<string, unknown> };

export function graphNodeId(auditId: string, type: string, refId: string) {
  return `${auditId}-${type.toLowerCase()}-${refId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function writeEvidenceGraph(organizationId: string, auditId: string, nodes: Node[], edges: Edge[]) {
  const db = getAdminDb();
  const base = graphRef(db, organizationId);
  const batch = db.batch();
  nodes.forEach((n, i) => {
    const refId = n.refId || String(i);
    batch.set(base.doc(graphNodeId(auditId, n.type, refId)), { ...n, auditId, updatedAt: new Date() }, { merge: true });
  });
  edges.forEach((e) => {
    const id = `${auditId}-edge-${e.from}-${e.to}-${e.type}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    batch.set(base.doc(id), { ...e, auditId, updatedAt: new Date() }, { merge: true });
  });
  await batch.commit();
}
