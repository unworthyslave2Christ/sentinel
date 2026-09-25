import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { inngest } from "@/inngest/client";

export async function POST(request: Request) {
  let member;
  try { member = await requirePermission("ANALYZE"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }

  const body = await request.json();
  const organizationId = member.organizationId;
  const auditId = String(body.auditId || "");
  const documentId = String(body.documentId || "");
  if (!auditId || !documentId) {
    return NextResponse.json({ error: "auditId and documentId are required" }, { status: 400 });
  }

  const db = getAdminDb();
  const [audit, document] = await Promise.all([
    db.doc(`organizations/${organizationId}/audits/${auditId}`).get(),
    db.doc(`organizations/${organizationId}/documents/${documentId}`).get(),
  ]);
  if (!audit.exists || !document.exists) return NextResponse.json({ error: "Audit or document not found" }, { status: 404 });

  await audit.update({ status: "QUEUED", updatedAt: new Date() });
  await inngest.send({
    name: "sentinel/audit.requested",
    data: { organizationId, auditId, documentId, documentIds: [documentId] },
  });

  await logSecurityEvent(member, "AUDIT_STARTED", { auditId, documentId });
  return NextResponse.json({ queued: true });
}
