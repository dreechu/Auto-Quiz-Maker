import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ ownerUid: string; deckId: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    const database = getAdminDatabase();
    const requester = await database.ref(`users/${identity.uid}/profile/role`).get();
    if (requester.val() !== "admin") {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { ownerUid, deckId } = await context.params;
    if (
      !ownerUid ||
      !deckId ||
      [ownerUid, deckId].some((value) => /[.#$\[\]/]/.test(value))
    ) {
      return Response.json({ error: "That deck reference is not valid." }, { status: 400 });
    }

    const snapshot = await database.ref(`decks/${ownerUid}/${deckId}`).get();
    if (!snapshot.exists()) {
      return Response.json({ error: "That deck could not be found." }, { status: 404 });
    }
    return Response.json({ deck: snapshot.val() });
  } catch (error) {
    console.error("Could not load an admin deck.", error);
    return Response.json(
      { error: "That deck couldn’t be loaded. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ ownerUid: string; deckId: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    const database = getAdminDatabase();
    const requester = await database.ref(`users/${identity.uid}/profile/role`).get();
    if (requester.val() !== "admin") {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { ownerUid, deckId } = await context.params;
    if (
      !ownerUid ||
      !deckId ||
      [ownerUid, deckId].some((value) => /[.#$\[\]/]/.test(value))
    ) {
      return Response.json({ error: "That deck reference is not valid." }, { status: 400 });
    }

    const deckRef = database.ref(`decks/${ownerUid}/${deckId}`);
    const result = await deckRef.transaction((current) => current ? null : undefined);
    if (!result.committed) {
      return Response.json({ error: "That deck could not be found." }, { status: 404 });
    }

    await Promise.all([
      database.ref(`publicDecks/${ownerUid}_${deckId}`).remove(),
      database.ref(`users/${ownerUid}/profile`).transaction((profile) => {
        if (!profile) return profile;
        profile.deckCount = Math.max(0, Number(profile.deckCount || 0) - 1);
        profile.updatedAt = Date.now();
        return profile;
      }),
    ]);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Could not delete an admin-managed deck.", error);
    return Response.json({ error: "That deck couldn’t be deleted. Please try again." }, { status: 500 });
  }
}
