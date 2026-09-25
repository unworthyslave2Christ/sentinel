import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/server/firebase/admin";
import type { Role } from "./authorization";

export async function addMember(params: {
  organizationId: string;
  email: string;
  role: Role;
}) {
  const db = getAdminDb();
  const email = params.email.trim().toLowerCase();

  // Email is the stable invitation identity until the user signs in.
  const id = Buffer.from(`${params.organizationId}:${email}`).toString("base64url");
  const ref = db.doc(`organizations/${params.organizationId}/members/${id}`);

  await ref.set({
    email,
    role: params.role,
    status: "INVITED",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return id;
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: Role,
) {
  await getAdminDb()
    .doc(`organizations/${organizationId}/members/${memberId}`)
    .update({
      role,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function removeMember(
  organizationId: string,
  memberId: string,
) {
  await getAdminDb()
    .doc(`organizations/${organizationId}/members/${memberId}`)
    .delete();
}
