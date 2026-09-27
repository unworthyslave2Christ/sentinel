import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { nextRunAt, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { inngest } from "@/inngest/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try { member = await requirePermission("MANAGE_MONITORING"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }
  const org = member.organizationId;
  const { id } = await params;
  const ref = getAdminDb().doc(`organizations/${org}/monitoringSchedules/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  const body = await req.json();
  const current = snap.data() || {};
  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now };
  const frequencyChanged = ["EVERY_3_MINUTES", "EVERY_5_MINUTES", "DAILY", "WEEKLY", "MONTHLY"].includes(String(body.frequency));
  const nextFrequency = frequencyChanged ? String(body.frequency) as MonitorFrequency : String(current.frequency) as MonitorFrequency;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (frequencyChanged) {
    patch.frequency = nextFrequency;
    patch.nextRunAt = nextRunAt(nextFrequency, now);
  }

  // A reschedule is a new monitoring session, not a change to the old REVIEW result.
  // Reuse the schedule's existing audit for each document and move it back to QUEUED.
  const shouldStartSession = frequencyChanged || body.active === true;
  if (shouldStartSession) {
    const db = getAdminDb();
    for (const documentId of current.documentIds || []) {
      const audits = await db.collection(`organizations/${org}/audits`)
        .where("documentId", "==", String(documentId))
        .get();
      if (!audits.empty) {
        const audit = audits.docs.sort((a: any, b: any) => Number(b.data().createdAt?.toMillis?.() || 0) - Number(a.data().createdAt?.toMillis?.() || 0))[0];
        const previous = audit.data() || {};
        const sessionNumber = Number(previous.scheduleSessionNumber || 0) + 1;
        const scheduleSessionId = `schedule-${id}-${now.getTime()}-${String(documentId)}`;
        await audit.ref.update({
          status: "QUEUED", progress: 0, findingCount: 0,
          scheduleId: id, scheduleSessionId, scheduleSessionNumber: sessionNumber,
          scheduleFrequency: nextFrequency, scheduleRunAt: now,
          title: `${String(previous.documentName || "Document")} — Monitoring session ${sessionNumber}`,
          trigger: `Scheduled ${String(nextFrequency).toLowerCase()} monitoring`,
          updatedAt: now, completedAt: null, failureReason: null,
        });
        await inngest.send({ name: "sentinel/audit.requested", data: {
          organizationId: org, auditId: audit.id, documentId: String(documentId), documentIds: [String(documentId)],
          scheduleId: id, scheduleSessionId, scheduleFrequency: nextFrequency, scheduleRunAt: now.toISOString(),
        }});
      }
    }
  }
  await ref.update(patch);
  await logSecurityEvent(member, "MONITORING_SCHEDULE_UPDATED", { scheduleId: id, patch });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try { member = await requirePermission("MANAGE_MONITORING"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }
  const org = member.organizationId;
  const { id } = await params;
  const ref = getAdminDb().doc(`organizations/${org}/monitoringSchedules/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  await ref.delete();
  await logSecurityEvent(member, "MONITORING_SCHEDULE_UPDATED", { scheduleId: id, deleted: true });
  return NextResponse.json({ ok: true });
}
