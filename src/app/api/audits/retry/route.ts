import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";
import { inngest } from "@/inngest/client";

export async function POST(request: Request) {
  let member;

  try {
    member = await requirePermission("ANALYZE");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "UNAUTHORIZED";

    return NextResponse.json(
      {
        error:
          message === "FORBIDDEN"
            ? "Forbidden"
            : "Unauthorized",
      },
      {
        status:
          message === "FORBIDDEN" ? 403 : 401,
      },
    );
  }

  try {
    const body = await request.json();

    const organizationId = member.organizationId;
    const auditId = String(body.auditId || "");

    if (!auditId) {
      return NextResponse.json(
        {
          error: "auditId is required",
        },
        {
          status: 400,
        },
      );
    }

    const db = getAdminDb();

    const auditRef = db.doc(
      `organizations/${organizationId}/audits/${auditId}`,
    );

    const auditSnap = await auditRef.get();

    if (!auditSnap.exists) {
      return NextResponse.json(
        {
          error: "Audit not found",
        },
        {
          status: 404,
        },
      );
    }

    const audit = auditSnap.data() || {};

    const documentId = String(
      audit.documentId || "",
    );

    if (!documentId) {
      return NextResponse.json(
        {
          error:
            "This audit does not have a source document.",
        },
        {
          status: 400,
        },
      );
    }

    const documentSnap = await db
      .doc(
        `organizations/${organizationId}/documents/${documentId}`,
      )
      .get();

    if (!documentSnap.exists) {
      return NextResponse.json(
        {
          error: "Source document not found.",
        },
        {
          status: 404,
        },
      );
    }

    // Only retry a failed/stale audit.
    const retryableStatuses = [
      "FAILED",
      "QUEUED",
      "EXTRACTING",
      "MAPPING",
      "ANALYZING",
    ];

    if (
      !retryableStatuses.includes(
        String(audit.status),
      )
    ) {
      return NextResponse.json(
        {
          error: `Audit cannot be retried from status ${audit.status}.`,
        },
        {
          status: 409,
        },
      );
    }

    const now = new Date();

    await auditRef.update({
      status: "QUEUED",
      progress: 0,
      riskScore: null,
      riskSeverity: null,
      riskRationale: null,
      findingCount: 0,
      summary: null,
      failureReason: null,
      failedAt: null,
      retryRequestedAt: now,
      updatedAt: now,
    });

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

    await logSecurityEvent(
      member,
      "AUDIT_RETRY_REQUESTED",
      {
        auditId,
        documentId,
      },
    );

    return NextResponse.json({
      queued: true,
      retry: true,
      auditId,
    });
  } catch (error) {
    console.error(
      "Failed to retry audit:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to retry audit",
      },
      {
        status: 500,
      },
    );
  }
}