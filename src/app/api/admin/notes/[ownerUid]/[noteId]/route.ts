import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ ownerUid: string; noteId: string }> },
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

    const { ownerUid, noteId } = await context.params;
    if (!ownerUid || /[.#$\[\]/]/.test(ownerUid) || !/^[a-f0-9]{32}$/.test(noteId)) {
      return Response.json({ error: "That note reference is not valid." }, { status: 400 });
    }

    const result = await database.ref(`notes/${ownerUid}/${noteId}`)
      .transaction((current) => current ? null : undefined);
    if (!result.committed) {
      return Response.json({ error: "That note could not be found." }, { status: 404 });
    }
    await database.ref(`publicNotes/${ownerUid}_${noteId}`).remove();
    return Response.json({ success: true });
  } catch (error) {
    console.error("Could not delete an admin-managed note.", error);
    return Response.json({ error: "That note couldn’t be deleted. Please try again." }, { status: 500 });
  }
}
