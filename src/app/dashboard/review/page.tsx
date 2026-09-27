import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import FindingFilters from "@/components/finding-filters";

export default async function Review() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const db = getAdminDb();
  const audits = await db.collection(`organizations/${org}/audits`).orderBy("createdAt", "desc").limit(50).get();
  const rows: any[] = [];
  for (const audit of audits.docs) {
    const auditData = audit.data();
    let documentName = String(auditData.documentName || "").trim();
    if (!documentName && auditData.documentId) {
      const document = await db.doc(`organizations/${org}/documents/${String(auditData.documentId)}`).get();
      if (document.exists) documentName = String(document.data()?.name || "").trim();
    }
    const fs = await audit.ref.collection("findings").get();
    fs.docs.forEach((f) => {
      const finding = f.data();
      const status = String(finding.status || "OPEN");
      if (!["OPEN", "IN_REVIEW"].includes(status)) return;
      rows.push({
        id: f.id, auditId: audit.id, auditTitle: String(auditData.title || "Audit"),
        title: String(finding.title || "Untitled finding"), severity: String(finding.severity || "LOW"), status,
        documentName: String(finding.sourceDocumentName || "").trim() || documentName || "Source document",
        evidence: finding.evidence?.[0]?.text || "", category: String(finding.category || "OTHER"),
        confidence: Number(finding.confidence || 0), scheduleSessionNumber: Number(finding.scheduleSessionNumber || 0),
        createdAt: finding.createdAt?.toDate?.()?.toISOString?.() || null,
      });
    });
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return <div className="p-6 lg:p-10"><div className="text-sm font-semibold text-blue-600">Governance</div><h1 className="mt-1 text-3xl font-semibold">Human review queue</h1><p className="mt-2 text-slate-500">Every material finding remains reviewable before it is accepted, dismissed, or resolved.</p><FindingFilters rows={rows} review /></div>;
}
