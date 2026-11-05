import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import type { StudyNote } from "@/lib/notes";

type RouteContext = { params: Promise<{ noteId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in to update this note." }, { status: 401 });
  }

  const { noteId } = await params;
  if (!/^[a-f0-9]{32}$/.test(noteId)) {
    return Response.json({ error: "This note could not be found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { title?: unknown; isPublic?: unknown };
    if (
      body.title === undefined &&
      body.isPublic === undefined
    ) {
      return Response.json({ error: "Choose a note title or sharing setting to update." }, { status: 400 });
    }
    if (body.title !== undefined && (
      typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120
    )) {
      return Response.json({ error: "Note titles must be between 1 and 120 characters." }, { status: 400 });
    }
    if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
      return Response.json({ error: "Choose whether this note should be public." }, { status: 400 });
    }
    const title = typeof body.title === "string" ? body.title.trim() : undefined;

    const database = getAdminDatabase();
    const noteRef = database.ref(`notes/${identity.uid}/${noteId}`);
    const result = await noteRef.transaction((current) => {
      if (!current) return;
      return {
        ...current,
        ...(title === undefined ? {} : { title }),
        ...(body.isPublic === undefined ? {} : { isPublic: body.isPublic }),
        updatedAt: Date.now(),
      };
    });
    if (!result.committed || !result.snapshot.exists()) {
      return Response.json({ error: "This note could not be found." }, { status: 404 });
    }
    const note = result.snapshot.val() as StudyNote;
    const ownerName = (await database.ref(`users/${identity.uid}/profile/displayName`).get()).val();
    await database.ref().update({
      [`publicNotes/${identity.uid}_${noteId}`]: note.isPublic
        ? {
            id: noteId,
            ownerUid: identity.uid,
            ownerName: typeof ownerName === "string" && ownerName.trim() ? ownerName : "Recall learner",
            title: note.title,
            summary: note.summary,
            sourceType: note.sourceType,
            sectionCount: note.sections.length,
            updatedAt: note.updatedAt,
          }
        : null,
    });
    return Response.json({ note: { ...note, id: noteId } });
  } catch (error) {
    console.error("Could not rename a saved note.", error);
    return Response.json({ error: "That note couldn’t be renamed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in to delete this note." }, { status: 401 });
  }

  const { noteId } = await params;
  if (!/^[a-f0-9]{32}$/.test(noteId)) {
    return Response.json({ error: "This note could not be found." }, { status: 404 });
  }

  try {
    const noteRef = getAdminDatabase().ref(`notes/${identity.uid}/${noteId}`);
    const snapshot = await noteRef.get();
    if (!snapshot.exists()) {
      return Response.json({ error: "This note could not be found." }, { status: 404 });
    }
    await getAdminDatabase().ref().update({
      [`notes/${identity.uid}/${noteId}`]: null,
      [`publicNotes/${identity.uid}_${noteId}`]: null,
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Could not delete a saved note.", error);
    return Response.json({ error: "That note couldn’t be deleted. Please try again." }, { status: 500 });
  }
}
