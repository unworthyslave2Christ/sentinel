import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { getAdminDb } from "@/server/firebase/admin";
import { queueAudit } from "@/server/data/monitoring";
import type { MonitorFrequency } from "@/lib/monitoring/schedule";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  let member;
  try {
    member = await requirePermission("ANALYZE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }

  const { auditId } = await params;
  const db = getAdminDb();
  const auditSnap = await db.doc(`organizations/${member.organizationId}/audits/${auditId}`).get();
  if (!auditSnap.exists) return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const audit = auditSnap.data() || {};
  const scheduleId = String(audit.scheduleId || "");
  const documentId = String(audit.documentId || "");
  if (!scheduleId || !documentId) return NextResponse.json({ error: "This audit is not linked to a monitoring schedule." }, { status: 400 });

  const scheduleSnap = await db.doc(`organizations/${member.organizationId}/monitoringSchedules/${scheduleId}`).get();
  if (!scheduleSnap.exists) return NextResponse.json({ error: "Current monitoring schedule not found." }, { status: 404 });
  const schedule = scheduleSnap.data() || {};
  if (!schedule.active) return NextResponse.json({ error: "The current monitoring schedule is paused." }, { status: 409 });

  const frequency = String(schedule.frequency) as MonitorFrequency;
  if (!["EVERY_5_MINUTES", "DAILY", "WEEKLY", "MONTHLY"].includes(frequency)) return NextResponse.json({ error: "The monitoring schedule has an invalid frequency." }, { status: 409 });

  const newAuditId = await queueAudit(
    db,
    member.organizationId,
    documentId,
    member.userId,
    `Manual run of current ${frequency.toLowerCase()} monitoring schedule`,
    { id: scheduleId, frequency, scheduledAt: new Date(), active: true },
  );

  return NextResponse.json({ queued: Boolean(newAuditId), auditId: newAuditId });
}
