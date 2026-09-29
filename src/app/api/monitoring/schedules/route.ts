import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { nextRunAt, type MonitorFrequency } from "@/lib/monitoring/schedule";
import { startMonitoringSession, refreshDocumentMonitoringState } from "@/server/data/monitoring";

const frequencies = ["EVERY_3_MINUTES", "EVERY_5_MINUTES", "DAILY", "WEEKLY", "MONTHLY"] as const;

export async function GET() {
  let member;
  try {
    member = await requirePermission("VIEW");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = member.organizationId;
  const snap = await getAdminDb()
    .collection(`organizations/${org}/monitoringSchedules`)
    .orderBy("createdAt", "desc")
    .get();
  const schedules = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      nextRunAt: data.nextRunAt?.toDate?.()?.toISOString?.() ?? null,
      lastRunAt: data.lastRunAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });
  const documentsSnap = await getAdminDb()
    .collection(`organizations/${org}/documents`)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const documents = documentsSnap.docs.map((d) => ({
    id: d.id,
    name: String(d.data().name || "Untitled document"),
    monitoringStatus: String(d.data().monitoringStatus || "INACTIVE"),
  }));
  return NextResponse.json({ schedules, documents });
}

export async function POST(req: Request) {
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
  const body = await req.json();
  const name = String(body.name || "").trim();
  const frequency = String(body.frequency || "WEEKLY") as MonitorFrequency;
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.map(String).slice(0, 100)
    : [];
  if (
    !name ||
    name.length > 160 ||
    !frequencies.includes(frequency) ||
    !documentIds.length
  ) {
    return NextResponse.json(
      { error: "name, frequency and at least one document are required" },
      { status: 400 },
    );
  }
  const db = getAdminDb();
  const valid = await Promise.all(
    documentIds.map((id: string) =>
      db.doc(`organizations/${org}/documents/${id}`).get(),
    ),
  );
  if (valid.some((x) => !x.exists))
    return NextResponse.json(
      { error: "One or more documents do not belong to the organization" },
      { status: 400 },
    );
  const ref = db.collection(`organizations/${org}/monitoringSchedules`).doc();
  const now = new Date();
  await ref.set({
    name,
    frequency,
    documentIds,
    active: true,
    nextRunAt: nextRunAt(frequency, now),
    lastRunAt: null,
    createdBy: member.userId,
    createdAt: now,
    updatedAt: now,
  });
  await refreshDocumentMonitoringState(db, org, ref.id, documentIds, frequency, true, now);
  const sessions: Array<{ auditId: string; scheduleSessionId: string; scheduleSessionNumber: number }> = [];
  for (const documentId of documentIds) {
    const session = await startMonitoringSession(db, {
      organizationId: org,
      scheduleId: ref.id,
      documentId,
      createdBy: member.userId,
      frequency,
      runAt: now,
    });
    if (session) sessions.push(session);
  }
  await logSecurityEvent(member, "MONITORING_SCHEDULE_CREATED", {
    scheduleId: ref.id,
    frequency,
    documentCount: documentIds.length,
    sessionsStarted: sessions.length,
  });
  return NextResponse.json({
    id: ref.id,
    sessionsStarted: sessions.length,
    schedule: {
      id: ref.id,
      name,
      frequency,
      documentIds,
      active: true,
      nextRunAt: nextRunAt(frequency, now).toISOString(),
      lastRunAt: sessions.length ? now.toISOString() : null,
    },
  }, { status: 201 });
}
