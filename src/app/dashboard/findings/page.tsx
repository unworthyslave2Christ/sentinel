import AutoRefresh from "@/components/auto-refresh";
import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import { processDueMonitoringSchedules } from "@/server/data/monitoring";
import FindingFilters from "@/components/finding-filters";

export default async function Findings() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const db = getAdminDb();
  await processDueMonitoringSchedules(db);
  const audits = await getAdminDb().collection(`organizations/${org}/audits`).orderBy("createdAt", "desc").limit(50).get();
  const rows: any[] = [];
  for (const audit of audits.docs) {
    const auditData = audit.data();
    const fs = await audit.ref.collection("findings").orderBy("createdAt", "desc").get();
    for (const f of fs.docs) {
      const x = f.data();
      const sessionNumber = Number(x.scheduleSessionNumber || auditData.scheduleSessionNumber || (auditData.scheduleSessionId ? 1 : 0));
      const docName = String(x.sourceDocumentName || auditData.documentName || "Source document");
      const auditTitle = sessionNumber > 0 ? `${docName} — Monitoring session ${sessionNumber}` : String(auditData.title || "Audit");
      rows.push({
        id: f.id, auditId: audit.id, auditTitle,
        documentName: docName,
        title: String(x.title || "Untitled finding"), severity: String(x.severity || "LOW"),
        category: String(x.category || "OTHER"), status: String(x.status || "OPEN"),
        confidence: Number(x.confidence || 0), scheduleSessionId: x.scheduleSessionId || null,
        scheduleSessionNumber: Number(x.scheduleSessionNumber || 0),
        createdAt: x.createdAt?.toDate?.()?.toISOString?.() || null,
        scheduleRunAt: x.scheduleRunAt?.toDate?.()?.toISOString?.() || null,
        trigger: String(x.trigger || auditData.trigger || ""),
      });
    }
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return <div className="p-6 lg:p-10"><div><div className="text-sm font-semibold text-blue-600">Evidence-backed issues</div><h1 className="mt-1 text-3xl font-semibold">Findings</h1><p className="mt-2 text-slate-500">Review findings across the organization, then open the audit for source evidence.</p></div><AutoRefresh intervalMs={5000} />
<FindingFilters rows={rows} /></div>;
}
