import {
  get,
  onValue,
  ref,
  type Unsubscribe,
} from "firebase/database";
import { auth, database } from "@/lib/firebase";
import type { Deck, Flashcard, ReviewRating } from "@/lib/flashcards";

function requireDatabase() {
  if (!database) {
    throw new Error("Firebase Realtime Database is not configured.");
  }
  return database;
}

async function authenticatedRequest<T = { error?: string; deckId?: string }>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Please sign in again before changing your study decks.");
  const idToken = await user.getIdToken();
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error || "That change couldn’t be saved. Please try again.");
  }
  return result;
}

export type DeckWithId = Deck & { id: string };

export function subscribeToDecks(
  uid: string,
  onDecks: (decks: DeckWithId[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(requireDatabase(), `decks/${uid}`),
    (snapshot) => {
      const values = snapshot.val() as Record<string, Deck> | null;
      onDecks(
        Object.entries(values ?? {})
          .map(([id, deck]) => ({ ...deck, id }))
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    },
    (error) => onError(error),
  );
}

export function subscribeToDeck(
  uid: string,
  deckId: string,
  onDeck: (deck: Deck | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(requireDatabase(), `decks/${uid}/${deckId}`),
    (snapshot) => onDeck(snapshot.exists() ? (snapshot.val() as Deck) : null),
    (error) => onError(error),
  );
}

export async function getDeck(uid: string, deckId: string): Promise<Deck | null> {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before opening this deck.");
  }
  const snapshot = await get(
    ref(requireDatabase(), `decks/${uid}/${deckId}`),
  );
  return snapshot.exists() ? (snapshot.val() as Deck) : null;
}

export async function createDeck(uid: string, deck: Deck) {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before saving this deck.");
  }
  const result = await authenticatedRequest("/api/decks", "POST", deck);
  if (!result.deckId) throw new Error("A deck ID couldn’t be created. Please try again.");
  return result.deckId;
}

export async function deleteDeck(uid: string, deckId: string) {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before deleting this deck.");
  }
  await authenticatedRequest(`/api/decks/${encodeURIComponent(deckId)}`, "DELETE");
}

export async function updateCardStatus(
  uid: string,
  deckId: string,
  cardId: string,
  status: Flashcard["status"],
) {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before updating your progress.");
  }
  await authenticatedRequest(
    `/api/decks/${encodeURIComponent(deckId)}/cards/${encodeURIComponent(cardId)}`,
    "PATCH",
    { status },
  );
}

export async function rateCard(
  uid: string,
  deckId: string,
  cardId: string,
  rating: ReviewRating,
) {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before updating your progress.");
  }
  return authenticatedRequest<{
    card: Omit<Flashcard, "status"> & { status: "learning" | "mastered" };
    masteredCount: number;
    cardCount: number;
  }>(
    `/api/decks/${encodeURIComponent(deckId)}/cards/${encodeURIComponent(cardId)}`,
    "PATCH",
    { rating },
  );
}

export type StudyInsights = {
  streakDays: number;
  totalReviews: number;
  accuracy: number;
  recentDays: { date: string; reviews: number; correct: number }[];
};

export async function getStudyInsights(uid: string): Promise<StudyInsights> {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again to view your study insights.");
  }
  return authenticatedRequest<StudyInsights>("/api/study/insights", "GET");
}

export async function saveDeck(uid: string, deckId: string, deck: Deck) {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before updating this deck.");
  }
  await authenticatedRequest(
    `/api/decks/${encodeURIComponent(deckId)}`,
    "PUT",
    deck,
  );
}

export async function setDeckPublic(
  uid: string,
  deckId: string,
  isPublic: boolean,
) {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Please sign in again before changing deck sharing.");
  }
  await authenticatedRequest(
    `/api/decks/${encodeURIComponent(deckId)}`,
    "PATCH",
    { isPublic },
  );
}
