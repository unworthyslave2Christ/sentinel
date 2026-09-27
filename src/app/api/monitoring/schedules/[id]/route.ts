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
  if (["EVERY_2_MINUTES", "EVERY_5_MINUTES", "DAILY", "WEEKLY", "MONTHLY"].includes(String(body.frequency))) {
    const frequency = String(body.frequency) as MonitorFrequency;
    patch.frequency = frequency;
    patch.nextRunAt = nextRunAt(frequency, new Date());
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
