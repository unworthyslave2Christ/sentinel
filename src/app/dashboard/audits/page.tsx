import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import AuditsLiveList from "@/components/audits-live-list";

export default async function Audits() {
  const s = await getCurrentSession(); if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const q = await getAdminDb().collection(`organizations/${org}/audits`).orderBy("createdAt", "desc").limit(50).get();
  const audits = q.docs.map((x) => ({ id: x.id, title: String(x.data().title || "Audit"), status: String(x.data().status || "QUEUED"), findingCount: Number(x.data().findingCount || 0), scheduleSessionNumber: Number(x.data().scheduleSessionNumber || 0) }));
  return <div className="p-6 lg:p-10"><div className="text-sm font-semibold text-blue-600">Compliance workspace</div><h1 className="mt-1 text-3xl font-semibold">Audits</h1><p className="mt-2 text-slate-500">Live audit status updates automatically while monitoring sessions are running.</p><AuditsLiveList audits={audits} /></div>;
}
