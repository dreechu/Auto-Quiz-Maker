import { getAdminDatabase } from "@/lib/firebase-admin";
import { isValidNoteId, type StudyNote } from "@/lib/notes";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ownerUid: string; noteId: string }> },
) {
  try {
    const { ownerUid, noteId } = await context.params;
    if (!ownerUid || /[.#$\[\]/]/.test(ownerUid) || !isValidNoteId(noteId)) {
      return Response.json({ error: "That public note link is not valid." }, { status: 400 });
    }

    const database = getAdminDatabase();
    const [noteSnapshot, profileSnapshot] = await Promise.all([
      database.ref(`notes/${ownerUid}/${noteId}`).get(),
      database.ref(`users/${ownerUid}/profile/displayName`).get(),
    ]);
    if (!noteSnapshot.exists()) {
      return Response.json({ error: "This note is private or no longer exists." }, { status: 404 });
    }
    const note = noteSnapshot.val() as StudyNote;
    if (note.isPublic !== true) {
      return Response.json({ error: "This note is private or no longer exists." }, { status: 404 });
    }
    return Response.json(
      {
        note: {
          id: noteId,
          title: note.title,
          summary: note.summary,
          sourceType: note.sourceType,
          sections: note.sections,
          keyTakeaways: note.keyTakeaways,
          keyTerms: note.keyTerms,
          updatedAt: note.updatedAt,
        },
        ownerName: typeof profileSnapshot.val() === "string" && profileSnapshot.val().trim()
          ? profileSnapshot.val()
          : "Recall learner",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load a public note.", error);
    return Response.json(
      { error: "This public note couldn’t be loaded. Please try again." },
      { status: 500 },
    );
  }
}
