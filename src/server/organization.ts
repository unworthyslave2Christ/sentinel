import { getAdminDb } from "@/server/firebase/admin";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export async function ensureOrganization(
  userId: string,
  email?: string | null,
) {
  const db = getAdminDb();
  const normalizedEmail = normalizeEmail(email);
  const user = db.collection("users").doc(userId);

  // Fast path: the user's existing membership is authoritative.
  const memberships = await user.collection("memberships").limit(1).get();

  if (!memberships.empty) {
    const membership = memberships.docs[0];
    const organizationId = String(
      membership.data().organizationId || membership.id,
    );

    // Backfill identity metadata on older memberships/orgs. This is safe
    // because we already found the membership through the authenticated user.
    const memberRef = db.doc(
      `organizations/${organizationId}/members/${userId}`,
    );
    const memberSnap = await memberRef.get();

    if (memberSnap.exists) {
      await memberRef.set(
        {
          userId,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          updatedAt: new Date(),
        },
        { merge: true },
      );
    }

    await db.doc(`organizations/${organizationId}`).set(
      {
        ...(normalizedEmail ? { ownerEmail: normalizedEmail } : {}),
        updatedAt: new Date(),
      },
      { merge: true },
    );

    await user.set(
      {
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        updatedAt: new Date(),
      },
      { merge: true },
    );

    return organizationId;
  }

  // If the authentication provider supplies a new/stable user ID for the
  // same verified email, recover the existing organization instead of
  // silently creating a second organization.
  if (normalizedEmail) {
    const owned = await db
      .collection("organizations")
      .where("ownerEmail", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!owned.empty) {
      const organizationId = owned.docs[0].id;
      const role = "OWNER" as const;

      await owned.docs[0].ref.set(
        {
          ownerId: userId,
          ownerEmail: normalizedEmail,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      await owned.docs[0].ref
        .collection("members")
        .doc(userId)
        .set(
          {
            userId,
            email: normalizedEmail,
            role,
            status: "ACTIVE",
            updatedAt: new Date(),
          },
          { merge: true },
        );

      await user.collection("memberships").doc(organizationId).set({
        organizationId,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await user.set(
        {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
        { merge: true },
      );

      return organizationId;
    }

    // Also honor an existing invitation for this email. The authenticated
    // user receives a canonical membership under their actual user ID.
    const invited = await db
      .collectionGroup("members")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!invited.empty) {
      const invitedMember = invited.docs[0];
      const organizationId = invitedMember.ref.parent.parent?.id;

      if (organizationId) {
        const role = (invitedMember.data().role || "VIEWER") as string;

        await invitedMember.ref.set(
          {
            status: "ACTIVE",
            acceptedAt: new Date(),
            updatedAt: new Date(),
          },
          { merge: true },
        );

        await db
          .doc(`organizations/${organizationId}/members/${userId}`)
          .set(
            {
              userId,
              email: normalizedEmail,
              role,
              status: "ACTIVE",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            { merge: true },
          );

        await user.collection("memberships").doc(organizationId).set({
          organizationId,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await user.set(
          {
            email: normalizedEmail,
            updatedAt: new Date(),
          },
          { merge: true },
        );

        return organizationId;
      }
    }
  }

  // First-time user: create one organization and persist its identity.
  const org = db.collection("organizations").doc();
  const batch = db.batch();
  const now = new Date();

  batch.set(org, {
    name: normalizedEmail
      ? `${normalizedEmail.split("@")[0]}'s Organization`
      : "My Organization",
    ownerId: userId,
    ...(normalizedEmail ? { ownerEmail: normalizedEmail } : {}),
    createdAt: now,
    updatedAt: now,
  });

  batch.set(org.collection("members").doc(userId), {
    userId,
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    role: "OWNER",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });

  batch.set(user.collection("memberships").doc(org.id), {
    organizationId: org.id,
    role: "OWNER",
    createdAt: now,
    updatedAt: now,
  });

  batch.set(
    user,
    {
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      updatedAt: now,
    },
    { merge: true },
  );

  await batch.commit();
  return org.id;
}
