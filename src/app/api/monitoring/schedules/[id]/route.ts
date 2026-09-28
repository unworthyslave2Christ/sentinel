import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { nextRunAt, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { refreshDocumentMonitoringState, startMonitoringSession } from "@/server/data/monitoring";

const frequencies = ["EVERY_3_MINUTES", "EVERY_5_MINUTES", "DAILY", "WEEKLY", "MONTHLY"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try {
    member = await requirePermission("MANAGE_MONITORING");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const org = member.organizationId;
  const { id } = await params;
  const db = getAdminDb();
  const ref = db.doc(`organizations/${org}/monitoringSchedules/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  const body = await req.json();
  const current = snap.data() || {};
  const now = new Date();
  const documentIds = Array.isArray(current.documentIds) ? current.documentIds.map(String) : [];
  const frequencyChanged = frequencies.includes(String(body.frequency) as (typeof frequencies)[number]);
  const nextFrequency = frequencyChanged
    ? String(body.frequency) as MonitorFrequency
    : String(current.frequency) as MonitorFrequency;
  const active = typeof body.active === "boolean" ? body.active : Boolean(current.active);

  const patch: Record<string, unknown> = {
    updatedAt: now,
    active,
    ...(frequencyChanged ? { frequency: nextFrequency } : {}),
    nextRunAt: active ? nextRunAt(nextFrequency, now) : null,
  };

  await ref.update(patch);

  // Changing the cadence or explicitly resuming starts a fresh monitoring
  // session immediately. It never interrupts an already-active workforce run.
  if (active && (frequencyChanged || body.active === true)) {
    for (const documentId of documentIds) {
      await startMonitoringSession(db, {
        organizationId: org,
        scheduleId: id,
        documentId,
        createdBy: String(current.createdBy || member.userId),
        frequency: nextFrequency,
        runAt: now,
      });
    }
  } else {
    await refreshDocumentMonitoringState(
      db,
      org,
      id,
      documentIds,
      nextFrequency,
      active,
      now,
    );
  }

  await logSecurityEvent(member, "MONITORING_SCHEDULE_UPDATED", {
    scheduleId: id,
    patch,
    rescheduled: active && (frequencyChanged || body.active === true),
  });
  return NextResponse.json({ ok: true, rescheduled: active && (frequencyChanged || body.active === true) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let member;
  try {
    member = await requirePermission("MANAGE_MONITORING");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
  const org = member.organizationId;
  const { id } = await params;
  const db = getAdminDb();
  const ref = db.doc(`organizations/${org}/monitoringSchedules/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  const data = snap.data() || {};
  const documentIds = Array.isArray(data.documentIds) ? data.documentIds.map(String) : [];
  await ref.delete();
  await refreshDocumentMonitoringState(db, org, id, documentIds, String(data.frequency) as MonitorFrequency, false);
  await logSecurityEvent(member, "MONITORING_SCHEDULE_UPDATED", { scheduleId: id, deleted: true });
  return NextResponse.json({ ok: true });
}
