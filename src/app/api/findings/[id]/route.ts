import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";

const statuses = ["OPEN", "IN_REVIEW", "ACCEPTED", "DISMISSED", "RESOLVED"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try { member = await requirePermission("REVIEW"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }
  const org = member.organizationId;
  const { id } = await params;
  const body = await req.json();
  const status = String(body.status || "") as typeof statuses[number];
  const auditId = String(body.auditId || "");
  if (!statuses.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (!auditId) return NextResponse.json({ error: "auditId is required" }, { status: 400 });

  const db = getAdminDb();
  const ref = db.doc(`organizations/${org}/audits/${auditId}/findings/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const now = new Date();
  await ref.update({ status, reviewedBy: member.userId, reviewedAt: now, updatedAt: now });
  await db.collection(`organizations/${org}/audits/${auditId}/events`).add({
    type: "REVIEW",
    agent: "Human Reviewer",
    message: `Finding ${id} moved to ${status}.`,
    userId: member.userId,
    createdAt: now,
  });
  await logSecurityEvent(member, "FINDING_STATUS_CHANGED", { findingId: id, auditId, status });
  return NextResponse.json({ ok: true });
}
