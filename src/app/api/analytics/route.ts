import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { getAdminDb } from "@/server/firebase/admin";

export async function GET() {
  try {
    const member = await requirePermission("VIEW");
    const db = getAdminDb();
    const root = `organizations/${member.organizationId}`;

    const [documents, audits, tasks] = await Promise.all([
      db.collection(`${root}/documents`).limit(500).get(),
      db.collection(`${root}/audits`).limit(200).get(),
      db.collection(`${root}/remediationTasks`).limit(500).get(),
    ]);

    let total = 0;
    let open = 0;
    let inReview = 0;
    let accepted = 0;
    let dismissed = 0;
    let resolved = 0;
    let critical = 0;
    let high = 0;

    for (const audit of audits.docs) {
      const findings = await audit.ref.collection("findings").limit(500).get();
      for (const finding of findings.docs) {
        const data = finding.data();
        total++;
        if (data.status === "OPEN") open++;
        if (data.status === "IN_REVIEW") inReview++;
        if (data.status === "ACCEPTED") accepted++;
        if (data.status === "DISMISSED") dismissed++;
        if (data.status === "RESOLVED") resolved++;
        if (data.severity === "CRITICAL") critical++;
        if (data.severity === "HIGH") high++;
      }
    }

    const taskDocs = tasks.docs.map((doc) => doc.data());

    return NextResponse.json({
      role: member.role,
      documents: documents.size,
      audits: audits.size,
      findings: {
        total,
        open,
        inReview,
        accepted,
        dismissed,
        resolved,
        critical,
        high,
      },
      remediation: {
        total: taskDocs.length,
        open: taskDocs.filter((x) => x.status !== "DONE").length,
        done: taskDocs.filter((x) => x.status === "DONE").length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }
}
