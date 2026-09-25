import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";

const statuses = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export async function GET() {
  try {
    const member = await requirePermission("VIEW");
    const snap = await getAdminDb().collection(`organizations/${member.organizationId}/remediationTasks`).orderBy("createdAt", "desc").limit(200).get();
    return NextResponse.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const member = await requirePermission("REVIEW");
    const body = await req.json();
    const taskId = String(body.taskId || "");
    const status = String(body.status || "") as typeof statuses[number];
    if (!taskId || !statuses.includes(status)) return NextResponse.json({ error: "taskId and valid status are required" }, { status: 400 });
    const db = getAdminDb();
    const ref = db.doc(`organizations/${member.organizationId}/remediationTasks/${taskId}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    await ref.update({ status, updatedAt: new Date(), updatedBy: member.userId, ...(status === "DONE" ? { completedAt: new Date() } : {}) });
    await logSecurityEvent(member, "FINDING_STATUS_CHANGED", { taskId, status, type: "REMEDIATION_TASK" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
}
