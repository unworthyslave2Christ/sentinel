import { notFound } from "next/navigation";
import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import AuditLive from "@/components/audit-live";

export default async function Audit({ params }: { params: Promise<{ auditId: string }> }) {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const { auditId } = await params;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const db = getAdminDb();
  const a = await db.doc(`organizations/${org}/audits/${auditId}`).get();
  if (!a.exists) notFound();
  const [f, evidence, runs, events] = await Promise.all([
    a.ref.collection("findings").orderBy("createdAt", "desc").get(),
    a.ref.collection("evidence").orderBy("createdAt", "asc").get(),
    db.collection(`organizations/${org}/analysisRuns`).where("auditId", "==", auditId).orderBy("createdAt", "asc").get(),
    a.ref.collection("events").orderBy("createdAt", "desc").limit(100).get(),
  ]);
  return <AuditLive auditId={auditId} organizationId={org} initialAudit={{ id: a.id, ...a.data() }} initialFindings={f.docs.map(x => ({ id: x.id, ...x.data() }))} initialEvidence={evidence.docs.map(x => ({ id: x.id, ...x.data() }))} initialRuns={runs.docs.map(x => ({ id: x.id, ...x.data() }))} initialEvents={events.docs.map(x => ({ id: x.id, ...x.data() }))} />;
}
