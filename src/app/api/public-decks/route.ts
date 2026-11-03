import { getAdminDatabase } from "@/lib/firebase-admin";
import type { PublicDeckSummary } from "@/lib/flashcards";

export async function GET() {
  try {
    const snapshot = await getAdminDatabase()
      .ref("publicDecks")
      .orderByChild("updatedAt")
      .get();
    const decks = Object.values(
      (snapshot.val() as Record<string, PublicDeckSummary> | null) ?? {},
    ).sort((a, b) => b.updatedAt - a.updatedAt);
    return Response.json(
      { decks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load public decks.", error);
    return Response.json(
      { error: "Public decks couldn’t be loaded. Please try again." },
      { status: 500 },
    );
  }
}
