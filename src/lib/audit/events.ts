import { getAdminDb } from "@/server/firebase/admin";

export async function auditEvent(
  organizationId: string,
  auditId: string,
  data: Record<string, unknown>,
) {
  await getAdminDb()
    .collection(`organizations/${organizationId}/audits/${auditId}/events`)
    .add({ ...data, createdAt: new Date() });
}
