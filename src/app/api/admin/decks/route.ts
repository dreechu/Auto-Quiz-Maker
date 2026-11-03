import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import type { SourceType } from "@/lib/flashcards";

const SOURCE_TYPES: SourceType[] = ["image", "pdf", "docx", "pptx", "text", "anki"];

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && SOURCE_TYPES.includes(value as SourceType);
}

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

    const [decksSnapshot, usersSnapshot] = await Promise.all([
      database.ref("decks").get(),
      database.ref("users").get(),
    ]);
    const deckOwners =
      (decksSnapshot.val() as Record<string, Record<string, Record<string, unknown>>> | null) ??
      {};
    const users =
      (usersSnapshot.val() as Record<string, { profile?: { displayName?: unknown; email?: unknown } }> | null) ??
      {};
    const decks = Object.entries(deckOwners).flatMap(([ownerUid, userDecks]) =>
      Object.entries(userDecks ?? {}).map(([id, value]) => {
        const deck = value ?? {};
        const profile = users[ownerUid]?.profile;
        const cardData = deck.cards as Record<string, unknown> | null | undefined;
        return {
          id,
          ownerUid,
          ownerName:
            typeof profile?.displayName === "string" && profile.displayName.trim()
              ? profile.displayName
              : "Unnamed account",
          ownerEmail: typeof profile?.email === "string" ? profile.email : "",
          title: typeof deck.title === "string" ? deck.title : "Untitled deck",
          description: typeof deck.description === "string" ? deck.description : "",
          sourceType: isSourceType(deck.sourceType) ? deck.sourceType : null,
          cardCount:
            typeof deck.cardCount === "number"
              ? deck.cardCount
              : Object.keys(cardData ?? {}).length,
          createdAt: typeof deck.createdAt === "number" ? deck.createdAt : 0,
          isPublic: deck.isPublic === true,
        };
      }),
    );
    decks.sort((a, b) => b.createdAt - a.createdAt);
    return Response.json({ decks });
  } catch (error) {
    console.error("Could not load the admin deck list.", error);
    return Response.json(
      { error: "The admin dashboard couldn’t load decks. Check Firebase Admin configuration." },
      { status: 500 },
    );
  }
}
