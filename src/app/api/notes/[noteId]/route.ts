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
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) {
      return Response.json({ error: "The note update is too large." }, { status: 413 });
    }
    const body = (await request.json()) as {
      title?: unknown;
      isPublic?: unknown;
      appendSections?: unknown;
    };
    if (
      body.title === undefined &&
      body.isPublic === undefined &&
      body.appendSections === undefined
    ) {
      return Response.json({ error: "Choose note content, a title, or a sharing setting to update." }, { status: 400 });
    }
    if (body.title !== undefined && (
      typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120
    )) {
      return Response.json({ error: "Note titles must be between 1 and 120 characters." }, { status: 400 });
    }
    if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
      return Response.json({ error: "Choose whether this note should be public." }, { status: 400 });
    }
    const appendedSections: StudyNote["sections"] = [];
    if (body.appendSections !== undefined) {
      if (!Array.isArray(body.appendSections) || body.appendSections.length < 1 || body.appendSections.length > 20) {
        return Response.json({ error: "Add between 1 and 20 sections at a time." }, { status: 400 });
      }
      for (const [index, rawSection] of body.appendSections.entries()) {
        if (!rawSection || typeof rawSection !== "object") {
          return Response.json({ error: `Section ${index + 1} is invalid.` }, { status: 400 });
        }
        const section = rawSection as Record<string, unknown>;
        const heading = typeof section.heading === "string" ? section.heading.trim() : "";
        const content = typeof section.content === "string" ? section.content.trim() : "";
        const examplesValue = section.examples === undefined ? [] : section.examples;
        if (
          !heading || heading.length > 160 || !content || content.length > 20_000 ||
          !Array.isArray(examplesValue) ||
          examplesValue.length > 20 ||
          examplesValue.some((example) =>
            typeof example !== "string" || !example.trim() || example.length > 2_000,
          )
        ) {
          return Response.json({ error: `Section ${index + 1} needs a heading, content, and valid examples.` }, { status: 400 });
        }
        const examples = examplesValue.map((example) => example.trim());
        appendedSections.push({ heading, content, ...(examples.length ? { examples } : {}) });
      }
    }
    const title = typeof body.title === "string" ? body.title.trim() : undefined;

    const database = getAdminDatabase();
    const noteRef = database.ref(`notes/${identity.uid}/${noteId}`);
    const result = await noteRef.transaction((current) => {
      if (!current) return;
      return {
        ...current,
        ...(title === undefined ? {} : { title }),
        ...(appendedSections.length
          ? { sections: [...((current.sections ?? []) as StudyNote["sections"]), ...appendedSections] }
          : {}),
        ...(body.isPublic === undefined ? {} : { isPublic: body.isPublic }),
        updatedAt: Date.now(),
      };
    });
    if (!result.committed || !result.snapshot.exists()) {
      return Response.json(
        { error: result.snapshot.exists() ? "This note could not be updated. Please refresh and try again." : "This note could not be found." },
        { status: result.snapshot.exists() ? 409 : 404 },
      );
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
