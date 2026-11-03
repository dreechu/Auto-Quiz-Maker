import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import type { ReviewRating } from "@/lib/flashcards";

const REVIEW_RATINGS: ReviewRating[] = ["again", "hard", "good", "easy"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ deckId: string; cardId: string }> },
) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { status?: unknown; rating?: unknown };
    const hasRating = REVIEW_RATINGS.includes(body.rating as ReviewRating);
    const hasStatus = ["new", "learning", "mastered"].includes(String(body.status));
    if (!hasRating && !hasStatus) {
      return Response.json({ error: "Choose a valid card status or review rating." }, { status: 400 });
    }
    const { deckId, cardId } = await context.params;
    if (
      !deckId ||
      !cardId ||
      [deckId, cardId].some((id) => id.includes("/") || id.includes("."))
    ) {
      return Response.json({ error: "That card could not be found." }, { status: 400 });
    }
    const database = getAdminDatabase();
    const deckRef = database.ref(`decks/${identity.uid}/${deckId}`);
    const deckSnapshot = await deckRef.get();
    const cards = deckSnapshot.child("cards").val() as
      | Record<
          string,
          {
            status?: string;
            intervalDays?: number;
            easeFactor?: number;
            reviewCount?: number;
            lapseCount?: number;
            [key: string]: unknown;
          }
        >
      | null;
    if (!deckSnapshot.exists() || !cards || !Object.hasOwn(cards, cardId)) {
      return Response.json({ error: "This card couldn’t be found in that deck." }, { status: 404 });
    }

    const now = Date.now();
    const cardRef = deckRef.child(`cards/${cardId}`);
    let updatedCard: Record<string, unknown> | null = null;
    if (hasRating) {
      const rating = body.rating as ReviewRating;
      const current = cards[cardId];
      if (!current) {
        return Response.json({ error: "This card couldn’t be found in that deck." }, { status: 404 });
      }
      const previousCount = Math.max(0, Number(current.reviewCount) || 0);
      const previousInterval = Math.max(0, Number(current.intervalDays) || 0);
      const easeFactor = Math.max(1.3, Number(current.easeFactor) || 2.5);
      let nextInterval: number;
      let nextEase = easeFactor;
      let status: "learning" | "mastered";
      if (rating === "again") {
        nextInterval = 10 / (24 * 60);
        nextEase = Math.max(1.3, easeFactor - 0.2);
        status = "learning";
      } else if (rating === "hard") {
        nextInterval = previousCount === 0 ? 1 : Math.max(1, previousInterval * 1.2);
        nextEase = Math.max(1.3, easeFactor - 0.15);
        status = "learning";
      } else if (rating === "good") {
        nextInterval = previousCount === 0 ? 1 : previousCount === 1 ? 3 : previousInterval * easeFactor;
        status = "mastered";
      } else {
        nextInterval = previousCount === 0 ? 4 : Math.max(4, previousInterval * easeFactor * 1.3);
        nextEase = easeFactor + 0.15;
        status = "mastered";
      }
      updatedCard = {
        ...current,
        status,
        nextReviewAt: now + nextInterval * 86_400_000,
        lastReviewedAt: now,
        intervalDays: nextInterval,
        easeFactor: nextEase,
        reviewCount: previousCount + 1,
        lapseCount: Math.max(0, Number(current.lapseCount) || 0) + (rating === "again" ? 1 : 0),
        lastRating: rating,
      };
      await cardRef.update(updatedCard);

      const dateKey = new Date(now).toISOString().slice(0, 10);
      await getAdminDatabase().ref(`users/${identity.uid}/studyDays/${dateKey}`).transaction((current) => ({
        reviews: (Number(current?.reviews) || 0) + 1,
        correct: (Number(current?.correct) || 0) + (rating === "again" ? 0 : 1),
      }));
    } else {
      await cardRef.update({ status: body.status });
    }
    const updatedDeck = await deckRef.get();
    const updatedCards = updatedDeck.child("cards").val() as
      | Record<string, { status?: string }>
      | null;
    if (!updatedCards) {
      return Response.json({ error: "This deck no longer has any cards." }, { status: 404 });
    }

    const cardCount = Object.keys(updatedCards).length;
    const masteredCount = Object.values(updatedCards).filter(
      (card) => card.status === "mastered",
    ).length;
    await deckRef.update({
      cardCount,
      masteredCount,
      updatedAt: Date.now(),
    });

    return Response.json({
      masteredCount,
      cardCount,
      ...(updatedCard ? { card: updatedCard } : {}),
    });
  } catch (error) {
    console.error("Could not update the flashcard status.", error);
    return Response.json({ error: "Your progress couldn’t be saved. Please try again." }, { status: 500 });
  }
}
