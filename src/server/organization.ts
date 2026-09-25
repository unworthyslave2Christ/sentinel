import { getAdminDb } from "@/server/firebase/admin";

export async function ensureOrganization(userId: string, email?: string | null) {
  const db = getAdminDb();
  const user = db.collection("users").doc(userId);
  const m = await user.collection("memberships").limit(1).get();
  if (!m.empty) return m.docs[0].data().organizationId as string;

  const org = db.collection("organizations").doc();
  const batch = db.batch();
  batch.set(org, {
    name: email ? `${email.split("@")[0]}'s Organization` : "My Organization",
    ownerId: userId,
    createdAt: new Date(),
  });
  batch.set(org.collection("members").doc(userId), {
    userId, role: "OWNER", createdAt: new Date(),
  });
  batch.set(user.collection("memberships").doc(org.id), {
    organizationId: org.id, role: "OWNER", createdAt: new Date(),
  });
  await batch.commit();
  return org.id;
}
