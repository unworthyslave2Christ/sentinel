import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import TasksClient from "@/components/tasks-client";

export default async function Tasks() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const q = await getAdminDb().collection(`organizations/${org}/remediationTasks`).orderBy("createdAt", "desc").limit(100).get();
  const tasks = q.docs.map((x) => {
    const data = x.data();
    const toIso = (value: any) => value?.toDate?.()?.toISOString?.() || (value instanceof Date ? value.toISOString() : value ?? null);
    return {
      id: x.id,
      title: data.title ?? "",
      description: data.description ?? "",
      priority: data.priority ?? "LOW",
      dueInDays: data.dueInDays ?? null,
      auditId: data.auditId ?? null,
      findingId: data.findingId ?? null,
      analysisRunId: data.analysisRunId ?? null,
      status: data.status ?? "OPEN",
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
      schemaVersion: data.schemaVersion ?? null,
      dueDate: toIso(data.dueDate),
      customDeadline: data.customDeadline === true,
    };
  });
  return <TasksClient tasks={tasks} />;
}
