import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import MonitoringClient from "@/components/monitoring-client";

export default async function Monitoring() {
  const s = await getCurrentSession(); if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email); const db = getAdminDb();
  const [docs, schedules, alerts] = await Promise.all([
    db.collection(`organizations/${org}/documents`).orderBy("createdAt", "desc").limit(50).get(),
    db.collection(`organizations/${org}/monitoringSchedules`).orderBy("createdAt", "desc").get(),
    db.collection(`organizations/${org}/alerts`).orderBy("createdAt", "desc").limit(20).get(),
  ]);
  return <div className="p-6 lg:p-10"><div className="text-sm font-semibold text-blue-600">Continuous compliance</div><h1 className="mt-1 text-3xl font-semibold">Monitoring</h1><p className="mt-2 max-w-2xl text-slate-500">Keep source documents under recurring review and automatically re-audit material changes.</p><MonitoringClient documents={docs.docs.map(d=>({id:d.id,name:String(d.data().name),monitoringStatus:String(d.data().monitoringStatus || "INACTIVE")}))} schedules={schedules.docs.map(d=>({id:d.id,name:String(d.data().name),frequency:String(d.data().frequency),active:Boolean(d.data().active),nextRunAt:d.data().nextRunAt?.toDate?.()?.toISOString() ?? null,lastRunAt:d.data().lastRunAt?.toDate?.()?.toISOString() ?? null}))} alerts={alerts.docs.map(d=>({id:d.id,title:String(d.data().title),severity:String(d.data().severity),status:String(d.data().status),createdAt:d.data().createdAt?.toDate?.()?.toISOString() ?? null}))}/></div>;
}
