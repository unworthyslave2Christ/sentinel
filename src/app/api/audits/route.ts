import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { getAdminDb } from "@/server/firebase/admin";
import { processDueMonitoringSchedules } from "@/server/data/monitoring";

function toIso(value: any) {
  return value?.toDate?.()?.toISOString?.() || (value instanceof Date ? value.toISOString() : value ?? null);
}

export async function GET() {
  try {
    const member = await requirePermission("VIEW");
    const db = getAdminDb();
    await processDueMonitoringSchedules(db);
    const snap = await db
      .collection(`organizations/${member.organizationId}/audits`)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    return NextResponse.json(snap.docs.map((x) => {
      const d = x.data();
      const sessionNumber = Number(d.scheduleSessionNumber || (d.scheduleSessionId ? 1 : 0));
      const documentName = String(d.documentName || "").trim();
      const title = sessionNumber > 0 && documentName
        ? `${documentName} — Monitoring session ${sessionNumber}`
        : String(d.title || "Audit");
      return {
        id: x.id,
        title,
        status: String(d.status || "QUEUED"),
        findingCount: Number(d.findingCount || 0),
        scheduleSessionNumber: sessionNumber,
        scheduleFrequency: d.scheduleFrequency ? String(d.scheduleFrequency) : null,
        scheduleRunAt: toIso(d.scheduleRunAt),
        trigger: d.trigger ? String(d.trigger) : null,
        updatedAt: toIso(d.updatedAt),
      };
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }
}
