import { getAdminDatabase } from "@/lib/firebase-admin";
import type { Deck, Flashcard } from "@/lib/flashcards";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ownerUid: string; deckId: string }> },
) {
  try {
    const { ownerUid, deckId } = await context.params;
    if (
      !ownerUid ||
      !deckId ||
      ownerUid.includes("/") ||
      deckId.includes("/")
    ) {
      return Response.json({ error: "That shared deck link is not valid." }, { status: 400 });
    }

    const database = getAdminDatabase();
    const [indexSnapshot, deckSnapshot] = await Promise.all([
      database.ref(`publicDecks/${ownerUid}_${deckId}`).get(),
      database.ref(`decks/${ownerUid}/${deckId}`).get(),
    ]);
    if (!deckSnapshot.exists()) {
      return Response.json({ error: "This deck is not public or no longer exists." }, { status: 404 });
    }
    const deck = deckSnapshot.val() as Deck;
    if (deck.isPublic !== true) {
      return Response.json({ error: "This deck is not public or no longer exists." }, { status: 404 });
    }

    const publicCards = Object.fromEntries(
      Object.entries(deck.cards ?? {}).map(([id, card]) => [
        id,
        {
          question: card.question,
          answer: card.answer,
          hint: card.hint,
          difficulty: card.difficulty,
          format: card.format,
          status: "new" as Flashcard["status"],
        },
      ]),
    );
    const {
      category: _privateCategory,
      ...sharedDeck
    } = deck;
    return Response.json(
      {
        deck: {
          ...sharedDeck,
          cards: publicCards,
          cardCount: Object.keys(publicCards).length,
          masteredCount: 0,
        },
        ownerName: String(indexSnapshot.child("ownerName").val() || "Recall learner"),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load shared deck.", error);
    return Response.json(
      { error: "This shared deck couldn’t be loaded. Please try again." },
      { status: 500 },
    );
  }
}
