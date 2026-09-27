import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { inngest } from "@/inngest/client";
import { clearAuditExecutionState } from "@/server/data/audit-retry";

export async function POST(request: Request) {
  let member;

  try {
    member = await requirePermission("ANALYZE");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNAUTHORIZED";

    return NextResponse.json(
      {
        error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
      },
      {
        status: message === "FORBIDDEN" ? 403 : 401,
      },
    );
  }

  try {
    const body = await request.json();
    const organizationId = member.organizationId;
    const auditId = String(body.auditId || "");

    if (!auditId) {
      return NextResponse.json(
        { error: "auditId is required" },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const auditRef = db.doc(
      `organizations/${organizationId}/audits/${auditId}`,
    );
    const auditSnap = await auditRef.get();

    if (!auditSnap.exists) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 },
      );
    }

    const audit = auditSnap.data() || {};
    const documentId = String(audit.documentId || "");

    if (!documentId) {
      return NextResponse.json(
        { error: "This audit does not have a source document." },
        { status: 400 },
      );
    }

    const documentSnap = await db
      .doc(
        `organizations/${organizationId}/documents/${documentId}`,
      )
      .get();

    if (!documentSnap.exists) {
      return NextResponse.json(
        { error: "Source document not found." },
        { status: 404 },
      );
    }

    // A retry is deliberately non-preemptive: it is only accepted after the
    // previous workflow has reached FAILED. We never cancel or overwrite an
    // actively running Inngest execution.
    if (String(audit.status) !== "FAILED") {
      return NextResponse.json(
        {
          error:
            "Retry is available after the audit reaches FAILED. The active workflow is not pre-empted.",
        },
        { status: 409 },
      );
    }

    // Clear generated state first. The source document remains intact.
    await clearAuditExecutionState(
      db,
      organizationId,
      auditId,
    );

    const now = new Date();

    await auditRef.update({
      status: "QUEUED",
      progress: 0,
      riskScore: null,
      riskSeverity: null,
      riskRationale: null,
      findingCount: 0,
      summary: null,
      controlMappings: [],
      controlMappingAnalysisRunId: null,
      complianceAnalysisRunId: null,
      riskAnalysisRunId: null,
      remediationAnalysisRunId: null,
      failureReason: null,
      failedAt: null,
      completedAt: null,
      retryRequestedAt: now,
      updatedAt: now,
    });

    // Send a fresh event rather than attempting to interrupt/restart an
    // existing function execution. The FAILED execution has already ended.
    await inngest.send({
      name: "sentinel/audit.requested",
      data: {
        organizationId,
        auditId,
        documentId,
        documentIds: [documentId],
        retry: true,
      },
    });

    await logSecurityEvent(member, "AUDIT_RETRY_REQUESTED", {
      auditId,
      documentId,
      tracesCleared: true,
      preemptedExistingJob: false,
    });

    return NextResponse.json({
      queued: true,
      retry: true,
      tracesCleared: true,
      preemptedExistingJob: false,
      auditId,
    });
  } catch (error) {
    console.error("Failed to retry audit:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to retry audit",
      },
      { status: 500 },
    );
  }
}
