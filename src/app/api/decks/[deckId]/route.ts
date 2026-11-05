import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import type { Deck, PublicDeckSummary } from "@/lib/flashcards";

function publicDeckMetadata(
  deck: Deck,
  ownerUid: string,
  ownerName: string,
  deckId: string,
): PublicDeckSummary {
  return {
    id: deckId,
    ownerUid,
    ownerName,
    title: deck.title,
    description: deck.description,
    sourceType: deck.sourceType,
    cardCount: Object.keys(deck.cards).length,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
  };
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ deckId: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  try {
    const { deckId } = await context.params;
    if (!deckId || deckId.includes("/") || deckId.includes(".")) {
      return Response.json({ error: "That deck ID is not valid." }, { status: 400 });
    }
    const database = getAdminDatabase();
    const deckRef = database.ref(`decks/${identity.uid}/${deckId}`);
    const deckSnapshot = await deckRef.get();
    if (!deckSnapshot.exists()) {
      return Response.json({ error: "That deck was already removed." }, { status: 404 });
    }
    const deck = deckSnapshot.val() as Deck;
    const updates: Record<string, null> = {
      [`decks/${identity.uid}/${deckId}`]: null,
    };
    if (deck.isPublic) {
      updates[`publicDecks/${identity.uid}_${deckId}`] = null;
    }
    await database.ref().update(updates);
    await database.ref(`users/${identity.uid}/profile`).transaction((profile) => {
      if (!profile) return profile;
      profile.deckCount = Math.max(0, Number(profile.deckCount || 0) - 1);
      profile.updatedAt = Date.now();
      return profile;
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Could not delete the deck.", error);
    return Response.json({ error: "That deck couldn’t be deleted. Please try again." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ deckId: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  try {
    const { deckId } = await context.params;
    if (!deckId || deckId.includes("/") || deckId.includes(".")) {
      return Response.json({ error: "That deck ID is not valid." }, { status: 400 });
    }
    const body = (await request.json()) as { isPublic?: unknown };
    if (typeof body.isPublic !== "boolean") {
      return Response.json({ error: "Choose whether this deck should be public." }, { status: 400 });
    }

    const database = getAdminDatabase();
    const deckRef = database.ref(`decks/${identity.uid}/${deckId}`);
    const [deckSnapshot, profileSnapshot] = await Promise.all([
      deckRef.get(),
      database.ref(`users/${identity.uid}/profile`).get(),
    ]);
    if (!deckSnapshot.exists()) {
      return Response.json({ error: "That deck could not be found." }, { status: 404 });
    }
    const deck = deckSnapshot.val() as Deck;
    const isPublic = body.isPublic;
    const now = Date.now();
    const updates: Record<string, unknown> = {
      [`decks/${identity.uid}/${deckId}/isPublic`]: isPublic,
      [`decks/${identity.uid}/${deckId}/updatedAt`]: now,
      [`publicDecks/${identity.uid}_${deckId}`]: isPublic
        ? publicDeckMetadata(
            { ...deck, updatedAt: now },
            identity.uid,
            String(profileSnapshot.child("displayName").val() || "Recall learner"),
            deckId,
          )
        : null,
    };
    await database.ref().update(updates);
    return Response.json({ isPublic });
  } catch (error) {
    console.error("Could not change deck sharing.", error);
    return Response.json({ error: "That sharing setting couldn’t be updated. Please try again." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ deckId: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  try {
    const { deckId } = await context.params;
    if (!deckId || deckId.includes("/") || deckId.includes(".")) {
      return Response.json({ error: "That deck ID is not valid." }, { status: 400 });
    }
    const body = (await request.json()) as Partial<Deck>;
    const deck = body as Deck;
    if (
      typeof deck.title !== "string" ||
      !deck.title.trim() ||
      deck.title.length > 100 ||
      typeof deck.description !== "string" ||
      deck.description.length > 500 ||
      (deck.category !== undefined &&
        (typeof deck.category !== "string" ||
          !deck.category.trim() ||
          deck.category.trim().length > 40)) ||
      (deck.tags !== undefined &&
        (!Array.isArray(deck.tags) ||
          deck.tags.length > 10 ||
          deck.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 30))) ||
      !deck.cards ||
      typeof deck.cards !== "object" ||
      Object.keys(deck.cards).length < 1 ||
      Object.entries(deck.cards).some(
        ([cardId, card]) =>
          !cardId ||
          /[.#$/\[\]]/.test(cardId) ||
          !card ||
          typeof card.question !== "string" ||
          !card.question.trim() ||
          card.question.length > 2000 ||
          typeof card.answer !== "string" ||
          !card.answer.trim() ||
          card.answer.length > 5000 ||
          typeof card.hint !== "string" ||
          card.hint.length > 500 ||
          !["easy", "medium", "hard"].includes(card.difficulty) ||
          !["new", "learning", "mastered"].includes(card.status) ||
          (card.format !== undefined &&
            !["identification", "enumeration"].includes(card.format)),
      )
    ) {
      return Response.json({ error: "The deck details or cards aren’t valid." }, { status: 400 });
    }
    const database = getAdminDatabase();
    const deckRef = database.ref(`decks/${identity.uid}/${deckId}`);
    const existingSnapshot = await deckRef.get();
    if (!existingSnapshot.exists()) {
      return Response.json({ error: "That deck could not be found." }, { status: 404 });
    }
    const existing = existingSnapshot.val() as Deck;
    const now = Date.now();
    const updates: Record<string, unknown> = {
      [`decks/${identity.uid}/${deckId}/title`]: deck.title.trim(),
      [`decks/${identity.uid}/${deckId}/description`]: deck.description,
      [`decks/${identity.uid}/${deckId}/category`]: deck.category?.trim() || null,
      [`decks/${identity.uid}/${deckId}/tags`]: (deck.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      [`decks/${identity.uid}/${deckId}/cards`]: deck.cards,
      [`decks/${identity.uid}/${deckId}/cardCount`]: Object.keys(deck.cards).length,
      [`decks/${identity.uid}/${deckId}/masteredCount`]: Object.values(deck.cards).filter((card) => card.status === "mastered").length,
      [`decks/${identity.uid}/${deckId}/updatedAt`]: now,
    };
    if (existing.isPublic) {
      const profile = await database.ref(`users/${identity.uid}/profile`).get();
      updates[`publicDecks/${identity.uid}_${deckId}`] = publicDeckMetadata(
        {
          ...deck,
          title: deck.title.trim(),
          updatedAt: now,
          cards: deck.cards,
        },
        identity.uid,
        String(profile.child("displayName").val() || "Recall learner"),
        deckId,
      );
    }
    await database.ref().update(updates);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Could not update the deck.", error);
    return Response.json({ error: "That deck couldn’t be updated. Please try again." }, { status: 500 });
  }
}
