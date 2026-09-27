import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { nextRunAt, type MonitorFrequency } from "@/lib/monitoring/schedule";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try { member = await requirePermission("MANAGE_MONITORING"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }
  const org = member.organizationId;
  const { id } = await params;
  const ref = getAdminDb().doc(`organizations/${org}/monitoringSchedules/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  const body = await req.json();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.active === "boolean") patch.active = body.active;
  if (["EVERY_5_MINUTES", "DAILY", "WEEKLY", "MONTHLY"].includes(String(body.frequency))) {
    const frequency = String(body.frequency) as MonitorFrequency;
    patch.frequency = frequency;
    patch.nextRunAt = nextRunAt(frequency, new Date());
  }
  await ref.update(patch);

  // Keep schedule-linked audit pages synchronized with the current schedule.
  // The audit page polls its workspace endpoint, so these changes become visible
  // without requiring the user to navigate away.
  const auditPatch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof patch.active === "boolean") auditPatch.scheduleActive = patch.active;
  if (patch.frequency) auditPatch.scheduleFrequency = patch.frequency;
  if (patch.nextRunAt) auditPatch.scheduleNextRunAt = patch.nextRunAt;
  if (Object.keys(auditPatch).length > 1) {
    const audits = await getAdminDb()
      .collection(`organizations/${org}/audits`)
      .where("scheduleId", "==", id)
      .limit(100)
      .get();
    const batch = getAdminDb().batch();
    audits.docs.forEach((audit) => batch.update(audit.ref, auditPatch));
    if (!audits.empty) await batch.commit();
  }

  await logSecurityEvent(member, "MONITORING_SCHEDULE_UPDATED", { scheduleId: id, patch });
  return NextResponse.json({ ok: true, nextRunAt: (patch.nextRunAt as Date | undefined)?.toISOString?.() ?? null });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try { member = await requirePermission("MANAGE_MONITORING"); } catch (error) { const message = error instanceof Error ? error.message : "UNAUTHENTICATED"; return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 }); }
  const org = member.organizationId;
  const { id } = await params;
  const ref = getAdminDb().doc(`organizations/${org}/monitoringSchedules/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  const audits = await getAdminDb()
    .collection(`organizations/${org}/audits`)
    .where("scheduleId", "==", id)
    .limit(100)
    .get();
  const batch = getAdminDb().batch();
  audits.docs.forEach((audit) => batch.update(audit.ref, { scheduleActive: false, updatedAt: new Date() }));
  if (!audits.empty) await batch.commit();
  await ref.delete();
  await logSecurityEvent(member, "MONITORING_SCHEDULE_UPDATED", { scheduleId: id, deleted: true });
  return NextResponse.json({ ok: true });
}
