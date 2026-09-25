import { NextResponse } from "next/server";
import { requirePermission } from "@/server/security/authorization";
import { getAdminDb } from "@/server/firebase/admin";

export async function GET() {
  try {
    const member = await requirePermission("VIEW_AUDIT_LOG");

    const snap = await getAdminDb()
      .collection(`organizations/${member.organizationId}/securityAuditLogs`)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    return NextResponse.json(
      snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" },
      { status: message === "FORBIDDEN" ? 403 : 401 },
    );
  }
}
