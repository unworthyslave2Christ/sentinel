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
        status: message === "FORBIDDEN" ? 403 : 401,
      },
    );
  }

  try {
    const body = await request.json();

    const organizationId = member.organizationId;
    const auditId = String(body.auditId || "");
    const documentId = String(body.documentId || "");

    if (!auditId || !documentId) {
      return NextResponse.json(
        {
          error: "auditId and documentId are required",
        },
        {
          status: 400,
        },
      );
    }

    const db = getAdminDb();

    // IMPORTANT:
    // Keep the references separate from the snapshots.
    const auditRef = db.doc(
      `organizations/${organizationId}/audits/${auditId}`,
    );

    const documentRef = db.doc(
      `organizations/${organizationId}/documents/${documentId}`,
    );

    const [auditSnap, documentSnap] = await Promise.all([
      auditRef.get(),
      documentRef.get(),
    ]);

    if (!auditSnap.exists || !documentSnap.exists) {
      return NextResponse.json(
        {
          error: "Audit or document not found",
        },
        {
          status: 404,
        },
      );
    }

    // Update the DOCUMENT REFERENCE, not the snapshot.
    await auditRef.update({
      status: "QUEUED",
      updatedAt: new Date(),
    });

    // Now dispatch the real audit workforce.
    await inngest.send({
      name: "sentinel/audit.requested",
      data: {
        organizationId,
        auditId,
        documentId,
        documentIds: [documentId],
      },
    });

    await logSecurityEvent(member, "AUDIT_STARTED", {
      auditId,
      documentId,
    });

    return NextResponse.json({
      queued: true,
      auditId,
    });
  } catch (error) {
    console.error("Failed to start audit:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start audit",
      },
      {
        status: 500,
      },
    );
  }
}