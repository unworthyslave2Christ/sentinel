import { getAdminDb } from "@/server/firebase/admin";

export async function assertOrganizationMember(userId: string, organizationId: string) {
  const snap = await getAdminDb()
    .doc(`organizations/${organizationId}/members/${userId}`)
    .get();
  if (!snap.exists) throw new Error("Forbidden");
  return snap.data() as { userId: string; role: string };
}
