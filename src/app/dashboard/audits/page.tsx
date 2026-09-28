import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import AuditsLiveList from "@/components/audits-live-list";

function toIso(value: any) {
  return value?.toDate?.()?.toISOString?.() || (value instanceof Date ? value.toISOString() : value ?? null);
}

export default async function Audits() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const q = await getAdminDb().collection(`organizations/${org}/audits`).orderBy("createdAt", "desc").limit(50).get();
  const audits = q.docs.map((x) => {
    const d = x.data();
    const sessionNumber = Number(d.scheduleSessionNumber || (d.scheduleSessionId ? 1 : 0));
    const documentName = String(d.documentName || "").trim();
    const title = sessionNumber > 0 && documentName
      ? `${documentName} — Monitoring session ${sessionNumber}`
      : String(d.title || "Audit");
    return {
      id: x.id,
      title,
      status: String(d.status || "QUEUED"),
      findingCount: Number(d.findingCount || 0),
      scheduleSessionNumber: sessionNumber,
      scheduleFrequency: d.scheduleFrequency ? String(d.scheduleFrequency) : null,
      scheduleRunAt: toIso(d.scheduleRunAt),
      trigger: d.trigger ? String(d.trigger) : null,
    };
  });
  return <div className="p-6 lg:p-10"><div className="text-sm font-semibold text-blue-600">Compliance workspace</div><h1 className="mt-1 text-3xl font-semibold">Audits</h1><p className="mt-2 text-slate-500">Live audit status updates automatically while monitoring sessions are running.</p><AuditsLiveList audits={audits} /></div>;
}
