import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { getAdminDb } from "@/server/firebase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ auditId: string }> }) {
  try {
    const member = await requirePermission("VIEW");
    const { auditId } = await params;
    const db = getAdminDb();
    const audit = await db.doc(`organizations/${member.organizationId}/audits/${auditId}`).get();
    if (!audit.exists) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    const auditData = audit.data() || {};
    const sourceDocumentId = String(auditData.documentId || "");
    const sourceDocument = sourceDocumentId
      ? await db.doc(`organizations/${member.organizationId}/documents/${sourceDocumentId}`).get()
      : null;
    const documentName = String(
      auditData.documentName || sourceDocument?.data()?.name || "",
    ).trim();
    const currentSessionId = String(auditData.scheduleSessionId || "");
    const [allFindings, evidence, runs, events] = await Promise.all([
      audit.ref.collection("findings").orderBy("createdAt", "desc").get(),
      audit.ref.collection("evidence").orderBy("createdAt", "asc").get(),
      db.collection(`organizations/${member.organizationId}/analysisRuns`).where("auditId", "==", auditId).orderBy("createdAt", "asc").get(),
      audit.ref.collection("events").orderBy("createdAt", "desc").limit(100).get(),
    ]);
    const findings = currentSessionId
      ? allFindings.docs.filter((d) => String(d.data().scheduleSessionId || "") === currentSessionId)
      : allFindings.docs;
    const currentEvidence = currentSessionId
      ? evidence.docs.filter((d) => String(d.data().scheduleSessionId || "") === currentSessionId)
      : evidence.docs;
    return NextResponse.json({
      audit: {
        id: audit.id,
        ...audit.data(),
        ...(documentName ? { documentName } : {}),
      },
      findings: findings.map((d) => ({ id: d.id, ...d.data() })),
      evidence: currentEvidence.map((d) => ({ id: d.id, ...d.data() })),
      analysisRuns: runs.docs.map((d) => ({ id: d.id, ...d.data() })),
      events: events.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHENTICATED";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
}
