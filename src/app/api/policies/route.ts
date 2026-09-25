import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { policySchema } from "@/ai/schemas";

export async function GET() {
  let member;
  try { member = await requirePermission("VIEW"); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const org = member.organizationId;
  const snap = await getAdminDb().collection(`organizations/${org}/policies`).orderBy("createdAt", "desc").get();
  return NextResponse.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export async function POST(req: Request) {
  let member;
  try { member = await requirePermission("MANAGE_CONTROLS"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }
  const org = member.organizationId;
  const parsed = policySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid policy", issues: parsed.error.issues }, { status: 400 });
  const ref = getAdminDb().collection(`organizations/${org}/policies`).doc();
  await ref.set({ ...parsed.data, createdBy: member.userId, createdAt: new Date(), updatedAt: new Date() });
  await logSecurityEvent(member, "POLICY_CREATED", { policyId: ref.id, name: parsed.data.name });
  return NextResponse.json({ id: ref.id }, { status: 201 });
}
