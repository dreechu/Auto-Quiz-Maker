import { randomBytes } from "node:crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";
import {
  currentMonthStart,
  normalizeSubscriptionPlan,
  PLAN_LIMITS,
} from "@/lib/plans";
import {
  ensureUserProfile,
  isBootstrapAdmin,
  verifyRequestUser,
} from "@/lib/server-auth";
import type { Deck } from "@/lib/flashcards";

function isValidDeck(value: unknown): value is Deck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<Deck>;
  return (
    typeof deck.title === "string" &&
    deck.title.trim().length > 0 &&
    deck.title.length <= 100 &&
    typeof deck.description === "string" &&
    (deck.category === undefined ||
      (typeof deck.category === "string" &&
        Boolean(deck.category.trim()) &&
        deck.category.trim().length <= 40)) &&
    ["image", "pdf", "docx", "pptx", "text", "anki"].includes(String(deck.sourceType)) &&
    typeof deck.cards === "object" &&
    deck.cards !== null &&
    Object.keys(deck.cards).length > 0 &&
    Object.values(deck.cards).every(
      (card) =>
        card &&
        typeof card.question === "string" &&
        typeof card.answer === "string" &&
        typeof card.hint === "string" &&
        ["easy", "medium", "hard"].includes(card.difficulty) &&
        ["new", "learning", "mastered"].includes(card.status) &&
        (card.format === undefined ||
          ["identification", "enumeration"].includes(card.format)),
    )
  );
}

export async function POST(request: Request) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again to save this deck." }, { status: 401 });
  }

  try {
    const deck = (await request.json()) as unknown;
    if (!isValidDeck(deck)) {
      return Response.json({ error: "This deck is missing a title or valid flashcards." }, { status: 400 });
    }

    await ensureUserProfile(identity);
    const database = getAdminDatabase();
    const profileRef = database.ref(`users/${identity.uid}/profile`);
    const now = Date.now();
    const monthStart = currentMonthStart(now);
    const profileResult = await profileRef.transaction((profile) => {
      const current =
        profile ??
        {
          uid: identity.uid,
          email: identity.email ?? "",
          displayName: identity.name ?? "",
          photoURL: identity.picture ?? "",
          role: isBootstrapAdmin(identity.email, identity.uid)
            ? "admin"
            : "user",
          plan: "free",
          deckCount: 0,
          generationsUsed: 0,
          generationResetAt: monthStart,
          createdAt: now,
          updatedAt: now,
        };
      const plan = normalizeSubscriptionPlan(current.plan) ?? "free";
      const deckCount = Math.max(0, Number(current.deckCount) || 0);
      const role =
        isBootstrapAdmin(identity.email, identity.uid) ||
        current.role === "admin"
          ? "admin"
          : "user";
      if (
        role !== "admin" &&
        plan !== "unlimited" &&
        deckCount >= PLAN_LIMITS[plan].decks!
      ) {
        return;
      }
      return {
        ...current,
        uid: identity.uid,
        email: identity.email ?? current.email ?? "",
        displayName: current.displayName || identity.name || "",
        photoURL: identity.picture ?? current.photoURL ?? "",
        plan,
        role,
        deckCount: deckCount + 1,
        generationsUsed: Number(current.generationsUsed) || 0,
        generationResetAt:
          typeof current.generationResetAt === "number"
            ? current.generationResetAt
            : monthStart,
        createdAt:
          typeof current.createdAt === "number" ? current.createdAt : now,
        updatedAt: now,
      };
    });
    if (!profileResult.committed) {
      const profile = profileResult.snapshot.val() as
        | { plan?: unknown; deckCount?: unknown }
        | null;
      const plan = normalizeSubscriptionPlan(profile?.plan) ?? "free";
      const deckCount = Math.max(0, Number(profile?.deckCount) || 0);
      const limit = PLAN_LIMITS[plan].decks;
      return Response.json(
        {
          error: `The server account ${identity.email ? `(${identity.email}, UID ${identity.uid})` : `(UID ${identity.uid})`} is on the ${plan} plan (${deckCount}${limit === null ? " decks, unlimited" : ` of ${limit} decks`}). Check that this exact account has the intended plan in Admin.`,
          plan,
          deckCount,
          limit,
          uid: identity.uid,
          email: identity.email ?? "",
        },
        { status: 403 },
      );
    }

    try {
      const deckData = {
        ...deck,
        isPublic: false,
        cardCount: Object.keys(deck.cards).length,
        masteredCount: Object.values(deck.cards).filter((card) => card.status === "mastered").length,
      };
      let createdDeckId: string | null = null;
      for (let attempt = 0; attempt < 5 && !createdDeckId; attempt += 1) {
        const idSuffix = randomBytes(16).toString("hex");
        const candidateId = `rcalquiz-${idSuffix}`;
        const candidateRef = database.ref(
          `decks/${identity.uid}/${candidateId}`,
        );
        const result = await candidateRef.transaction((current) =>
          current === null ? deckData : undefined,
        );
        if (result.committed) createdDeckId = candidateId;
      }
      if (!createdDeckId) {
        throw new Error("A unique deck ID couldn’t be created after several attempts.");
      }
      return Response.json({ deckId: createdDeckId });
    } catch (error) {
      await profileRef.transaction((profile) => {
        if (!profile) return profile;
        profile.deckCount = Math.max(0, Number(profile.deckCount || 1) - 1);
        profile.updatedAt = Date.now();
        return profile;
      });
      throw error;
    }
  } catch (error) {
    console.error("Could not create a deck.", error);
    return Response.json({ error: "Your deck couldn’t be saved. Please try again." }, { status: 500 });
  }
}
