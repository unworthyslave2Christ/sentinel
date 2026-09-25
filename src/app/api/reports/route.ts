import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  try {
    const member = await requirePermission("EXPORT_REPORTS");
    const audits = await getAdminDb()
      .collection(`organizations/${member.organizationId}/audits`)
      .limit(200)
      .get();

    const header = [
      "Finding ID",
      "Audit ID",
      "Title",
      "Severity",
      "Status",
      "Description",
      "Recommended Remediation",
    ];

    const rows: string[] = [];

    for (const audit of audits.docs) {
      const findings = await audit.ref.collection("findings").limit(1000).get();
      for (const finding of findings.docs) {
        const data = finding.data();
        rows.push([
          finding.id,
          audit.id,
          data.title,
          data.severity,
          data.status,
          data.description,
          data.recommendedRemediation,
        ].map(csvEscape).join(","));
      }
    }

    await logSecurityEvent(member, "REPORT_EXPORTED", {
      report: "findings-csv",
      rowCount: rows.length,
    });

    return new NextResponse([header.join(","), ...rows].join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sentinel-findings-report.csv"',
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
