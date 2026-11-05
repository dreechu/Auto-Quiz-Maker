import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import type { StudyNote } from "@/lib/notes";

type AdminProfile = {
  displayName?: unknown;
  email?: unknown;
};

export async function GET(request: Request) {
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

    const [notesSnapshot, usersSnapshot] = await Promise.all([
      database.ref("notes").get(),
      database.ref("users").get(),
    ]);
    const allNotes =
      (notesSnapshot.val() as Record<string, Record<string, StudyNote>> | null) ?? {};
    const users =
      (usersSnapshot.val() as Record<string, { profile?: AdminProfile }> | null) ?? {};
    const notes = Object.entries(allNotes).flatMap(([ownerUid, ownerNotes]) =>
      Object.entries(ownerNotes ?? {}).map(([id, note]) => ({
        ...note,
        id,
        ownerUid,
        ownerName:
          typeof users[ownerUid]?.profile?.displayName === "string" &&
          users[ownerUid].profile.displayName.trim()
            ? users[ownerUid].profile.displayName
            : "Unnamed account",
        ownerEmail:
          typeof users[ownerUid]?.profile?.email === "string"
            ? users[ownerUid].profile.email
            : "",
      })),
    );
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    return Response.json({ notes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load the admin note list.", error);
    return Response.json(
      { error: "The admin dashboard couldn’t load notes. Check Firebase Admin configuration." },
      { status: 500 },
    );
  }
}
