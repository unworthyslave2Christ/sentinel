import { getCurrentSession } from "@/server/session";
import { ensureOrganization } from "@/server/organization";
import { getAdminDb } from "@/server/firebase/admin";
import TasksClient from "@/components/tasks-client";

export default async function Tasks() {
  const s = await getCurrentSession();
  if (!s?.user?.id) return null;
  const org = await ensureOrganization(s.user.id, s.user.email);
  const q = await getAdminDb().collection(`organizations/${org}/remediationTasks`).orderBy("createdAt", "desc").limit(100).get();
  return <TasksClient tasks={q.docs.map((x) => ({ id: x.id, ...x.data(), dueDate: x.data().dueDate?.toDate?.()?.toISOString?.() || null }))} />;
}
