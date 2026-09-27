import Link from "next/link";
import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";

export default async function Findings() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const audits = await getAdminDb().collection(`organizations/${org}/audits`).orderBy("createdAt", "desc").limit(50).get();
  const rows: { id: string; auditId: string; auditTitle: string; documentName: string; title: string; severity: string; category: string; status: string; confidence: number }[] = [];
  for (const audit of audits.docs) {
    const fs = await audit.ref.collection("findings").orderBy("createdAt", "desc").get();
    for (const f of fs.docs) {
      const x = f.data();
      const auditData = audit.data();
      rows.push({
        id: f.id,
        auditId: audit.id,
        auditTitle: String(auditData.title),
        documentName: String(x.sourceDocumentName || auditData.documentName || "Source document"),
        title: String(x.title),
        severity: String(x.severity),
        category: String(x.category),
        status: String(x.status || "OPEN"),
        confidence: Number(x.confidence || 0),
      });
    }
  }
  return <div className="p-6 lg:p-10"><div><div className="text-sm font-semibold text-blue-600">Evidence-backed issues</div><h1 className="mt-1 text-3xl font-semibold">Findings</h1><p className="mt-2 text-slate-500">Review findings across the organization, then open the audit for source evidence.</p></div><div className="mt-8 overflow-hidden rounded-xl border bg-white"><div className="grid grid-cols-[1fr_120px_160px_100px] border-b p-4 text-xs font-semibold uppercase text-slate-500"><span>Finding</span><span>Severity</span><span>Audit</span><span>Status</span></div>{!rows.length && <div className="p-6 text-sm text-slate-500">No findings yet.</div>}{rows.map((x) => <Link key={`${x.auditId}-${x.id}`} href={`/dashboard/audits/${x.auditId}`} className="grid grid-cols-[1fr_120px_160px_100px] gap-3 border-b p-4 text-sm hover:bg-slate-50"><span><span className="font-medium">{x.title}</span><span className="mt-1 block text-xs text-slate-500">{x.category} · {Math.round(x.confidence * 100)}% confidence · {x.documentName}</span></span><span><span className="rounded-full border px-2 py-1 text-xs font-semibold">{x.severity}</span></span><span className="truncate text-slate-600">{x.auditTitle}</span><span className="text-slate-600">{x.status}</span></Link>)}</div></div>;
}
