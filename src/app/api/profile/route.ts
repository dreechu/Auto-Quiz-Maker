import { getAdminAuth, getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";

export async function PATCH(request: Request) {
  try {
    const identity = await verifyRequestUser(request);
    if (!identity) {
      return Response.json({ error: "Please sign in again." }, { status: 401 });
    }

    const body = (await request.json()) as { displayName?: unknown };
    if (typeof body.displayName !== "string") {
      return Response.json({ error: "Enter a valid display name." }, { status: 400 });
    }
    const displayName = body.displayName.trim();
    if (!displayName || displayName.length > 80) {
      return Response.json(
        { error: "Your display name must be between 1 and 80 characters." },
        { status: 400 },
      );
    }

    await getAdminAuth().updateUser(identity.uid, { displayName });
    const profileRef = getAdminDatabase().ref(`users/${identity.uid}/profile`);
    const result = await profileRef.transaction((current) => {
      if (!current) return;
      return { ...current, displayName, updatedAt: Date.now() };
    });
    if (!result.committed) {
      return Response.json(
        { error: "Your account profile isn’t ready yet. Refresh and try again." },
        { status: 409 },
      );
    }

    return Response.json({ profile: result.snapshot.val() });
  } catch (error) {
    console.error("Could not update the signed-in user's display name.", error);
    return Response.json(
      { error: "Your display name couldn’t be updated. Please try again." },
      { status: 500 },
    );
  }
}
