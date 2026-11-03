import { getAdminDatabase } from "@/lib/firebase-admin";
import { isSubscriptionPlan, isUserRole } from "@/lib/plans";
import { isBootstrapAdmin, verifyRequestUser } from "@/lib/server-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    const database = getAdminDatabase();
    const requesterRole = await database
      .ref(`users/${identity.uid}/profile/role`)
      .get();
    if (requesterRole.val() !== "admin") {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { uid } = await context.params;
    if (!uid || uid.includes("/") || uid.includes(".")) {
      return Response.json({ error: "That user ID is not valid." }, { status: 400 });
    }

    const body = (await request.json()) as {
      role?: unknown;
      plan?: unknown;
    };
    if (body.role === undefined && body.plan === undefined) {
      return Response.json({ error: "Choose a role or plan to update." }, { status: 400 });
    }
    if (body.role !== undefined && !isUserRole(body.role)) {
      return Response.json({ error: "That role is not valid." }, { status: 400 });
    }
    if (body.plan !== undefined && !isSubscriptionPlan(body.plan)) {
      return Response.json({ error: "That subscription plan is not valid." }, { status: 400 });
    }
    if (uid === identity.uid && body.role !== undefined) {
      return Response.json({ error: "You can’t change your own administrator role." }, { status: 400 });
    }

    const profileRef = database.ref(`users/${uid}/profile`);
    const profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists()) {
      return Response.json({ error: "That user profile could not be found." }, { status: 404 });
    }
    const targetProfile = profileSnapshot.val() as {
      role?: string;
      email?: string;
    };
    if (
      body.role === "user" &&
      isBootstrapAdmin(targetProfile.email, uid)
    ) {
      return Response.json(
        { error: "This account is configured as a bootstrap administrator and can’t be demoted here." },
        { status: 409 },
      );
    }

    if (body.role === "user" && targetProfile.role === "admin") {
      const usersSnapshot = await database.ref("users").get();
      const adminCount = Object.values(
        (usersSnapshot.val() as Record<string, { profile?: { role?: string } }> | null) ?? {},
      ).filter((user) => user.profile?.role === "admin").length;
      if (adminCount <= 1) {
        return Response.json({ error: "The last administrator can’t be demoted." }, { status: 409 });
      }
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.role !== undefined) patch.role = body.role;
    if (body.plan !== undefined) patch.plan = body.plan;
    await profileRef.update(patch);
    const updated = await profileRef.get();
    return Response.json({ profile: { ...updated.val(), uid } });
  } catch (error) {
    console.error("Could not update an account role or subscription.", error);
    return Response.json(
      { error: "That account couldn’t be updated. Please try again." },
      { status: 500 },
    );
  }
}
