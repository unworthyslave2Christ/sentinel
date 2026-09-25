import { NextResponse } from "next/server";
import {
  requirePermission,
  ROLES,
  type Role,
} from "@/server/security/authorization";
import {
  addMember,
  removeMember,
  updateMemberRole,
} from "@/server/security/organization";
import { logSecurityEvent } from "@/server/security/audit-log";
import { getAdminDb } from "@/server/firebase/admin";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  return NextResponse.json(
    { error: message === "FORBIDDEN" ? "Forbidden" : "Unauthorized" },
    { status: message === "FORBIDDEN" ? 403 : 401 },
  );
}

export async function GET() {
  try {
    const member = await requirePermission("MANAGE_MEMBERS");
    const snap = await getAdminDb()
      .collection(`organizations/${member.organizationId}/members`)
      .limit(200)
      .get();

    return NextResponse.json(
      snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("MANAGE_MEMBERS");
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "VIEWER") as Role;

    if (!email || !ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Valid email and role are required." },
        { status: 400 },
      );
    }

    // OWNER escalation is intentionally restricted to the existing owner.
    if (role === "OWNER" && actor.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the organization owner can assign OWNER." },
        { status: 403 },
      );
    }

    const id = await addMember({
      organizationId: actor.organizationId,
      email,
      role,
    });

    await logSecurityEvent(actor, "MEMBER_ADDED", { memberId: id, email, role });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requirePermission("MANAGE_MEMBERS");
    const body = await request.json();
    const memberId = String(body.memberId ?? "");
    const role = String(body.role ?? "") as Role;

    if (!memberId || !ROLES.includes(role)) {
      return NextResponse.json({ error: "memberId and valid role are required." }, { status: 400 });
    }

    if (role === "OWNER" && actor.role !== "OWNER") {
      return NextResponse.json({ error: "Only the organization owner can assign OWNER." }, { status: 403 });
    }

    const target = await getAdminDb()
      .doc(`organizations/${actor.organizationId}/members/${memberId}`)
      .get();

    if (!target.exists) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const currentRole = target.data()?.role as Role | undefined;

    // V4 does not implement ownership transfer. Protect the owner record.
    if (currentRole === "OWNER" && actor.userId !== target.data()?.userId) {
      return NextResponse.json({ error: "The owner role cannot be changed here." }, { status: 403 });
    }

    await updateMemberRole(actor.organizationId, memberId, role);
    await logSecurityEvent(actor, "MEMBER_ROLE_CHANGED", {
      memberId,
      from: currentRole ?? null,
      to: role,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission("MANAGE_MEMBERS");
    const body = await request.json();
    const memberId = String(body.memberId ?? "");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    }

    const target = await getAdminDb()
      .doc(`organizations/${actor.organizationId}/members/${memberId}`)
      .get();

    if (!target.exists) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (target.data()?.role === "OWNER") {
      return NextResponse.json(
        { error: "The organization owner cannot be removed." },
        { status: 403 },
      );
    }

    await removeMember(actor.organizationId, memberId);
    await logSecurityEvent(actor, "MEMBER_REMOVED", { memberId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
