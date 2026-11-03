"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { getDeck, saveDeck } from "@/lib/db";
import type { Deck, Difficulty, Flashcard } from "@/lib/flashcards";

const PAGE_SIZE = 5;
type EditableCard = Flashcard & { id: string };

function EditDeckForm() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<EditableCard[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [page, setPage] = useState(1);
  const [loadedKey, setLoadedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loadKey = user && deckId ? `${user.uid}:${deckId}` : "";
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    if (!user || !deckId) return;
    let active = true;
    void getDeck(user.uid, deckId)
      .then((loadedDeck) => {
        if (!active) return;
        if (!loadedDeck) {
          setError("We couldn’t find that deck.");
          return;
        }
        setDeck(loadedDeck);
        setTitle(loadedDeck.title);
        setDescription(loadedDeck.description || "");
        setTagsText((loadedDeck.tags ?? []).join(", "));
        setCards(
          Object.entries(loadedDeck.cards ?? {}).map(([id, card]) => ({
            ...card,
            format: card.format ?? "identification",
            id,
          })),
        );
        setError("");
      })
      .catch((loadError: unknown) => {
        console.error("Could not load the deck for editing.", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This deck couldn’t be loaded. Please try again.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadedKey(`${user.uid}:${deckId}`);
      });
    return () => {
      active = false;
    };
  }, [user, deckId]);

  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const visibleCards = useMemo(
    () => cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [cards, page],
  );

  function updateCard<Key extends keyof Flashcard>(
    id: string,
    field: Key,
    value: Flashcard[Key],
  ) {
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, [field]: value } : card,
      ),
    );
  }

  function addCard() {
    const newCard: EditableCard = {
      id: crypto.randomUUID(),
      question: "",
      answer: "",
      hint: "",
      difficulty: "medium",
      status: "new",
      format: "identification",
    };
    setCards((current) => [...current, newCard]);
    setPage(Math.ceil((cards.length + 1) / PAGE_SIZE));
    setError("");
  }

  function removeCard(id: string) {
    const nextCount = cards.length - 1;
    setCards((current) => current.filter((card) => card.id !== id));
    setPage((current) =>
      Math.min(current, Math.max(1, Math.ceil(nextCount / PAGE_SIZE))),
    );
  }

  async function handleSave() {
    if (!user || !deck || !deckId) {
      setError("Your session expired. Sign in again before saving this deck.");
      return;
    }
    if (!title.trim()) {
      setError("Give your deck a name before saving.");
      return;
    }
    if (cards.some((card) => !card.question.trim() || !card.answer.trim())) {
      setError("Every card needs both a question and an answer.");
      return;
    }
    if (cards.length === 0) {
      setError("Keep at least one card in your deck.");
      return;
    }
    const tags = [...new Set(tagsText.split(",").map((tag) => tag.trim()).filter(Boolean))];
    if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
      setError("Use up to 10 topics, with no more than 30 characters each.");
      return;
    }

    setSaving(true);
    setError("");
    const now = Date.now();
    const updatedDeck: Deck = {
      ...deck,
      title: title.trim(),
      description: description.trim(),
      tags,
      updatedAt: now,
      cardCount: cards.length,
      masteredCount: cards.filter((card) => card.status === "mastered").length,
      cards: Object.fromEntries(
        cards.map(({ id, ...card }) => [id, card]),
      ),
    };
    try {
      await saveDeck(user.uid, deckId, updatedDeck);
      router.push(`/deck/${encodeURIComponent(deckId)}`);
    } catch (saveError) {
      console.error("Could not save edited deck.", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your changes couldn’t be saved. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 pb-32 sm:px-6 sm:py-10">
        <Link
          href={deckId ? `/deck/${encodeURIComponent(deckId)}` : "/dashboard"}
          className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft size={15} />
          Back to deck
        </Link>

        <div className="mb-7">
          <h1 className="text-[30px] font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">
            Edit your deck
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Update the deck details, add new questions, or remove and edit cards.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white">
            <LoaderCircle size={24} className="animate-spin text-indigo-600" />
          </div>
        ) : deck ? (
          <>
            <section className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Deck title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Summary</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Topics / tags</span>
                <input
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  maxLength={320}
                  placeholder="Biology, Cell structure, Chapter 2"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                />
                <span className="mt-1 block text-[10px] text-slate-400">Separate up to 10 topics with commas; each can be up to 30 characters.</span>
              </label>
            </section>

            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Flashcards</h2>
              <span className="text-xs text-slate-400">
                {cards.length} {cards.length === 1 ? "card" : "cards"}
              </span>
            </div>

            <div className="space-y-4">
              {visibleCards.map((card, index) => {
                const cardNumber = (page - 1) * PAGE_SIZE + index + 1;
                return (
                  <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Card {cardNumber}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {(["identification", "enumeration"] as const).map((format) => (
                          <button
                            key={format}
                            type="button"
                            onClick={() => updateCard(card.id, "format", format)}
                            aria-pressed={(card.format ?? "identification") === format}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${(card.format ?? "identification") === format ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                          >
                            {format === "identification" ? "Identification" : "Enumeration"}
                          </button>
                        ))}
                        {(["easy", "medium", "hard"] as const).map((difficulty: Difficulty) => (
                          <button
                            key={difficulty}
                            type="button"
                            onClick={() => updateCard(card.id, "difficulty", difficulty)}
                            aria-pressed={card.difficulty === difficulty}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize transition ${card.difficulty === difficulty ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                          >
                            {difficulty}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => removeCard(card.id)}
                          disabled={cards.length === 1}
                          aria-label={`Delete card ${cardNumber}`}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Question</span>
                      <textarea
                        value={card.question}
                        onChange={(event) => updateCard(card.id, "question", event.target.value)}
                        rows={2}
                        maxLength={2000}
                        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                        {(card.format ?? "identification") === "enumeration" ? "Answer · one item per line" : "Answer"}
                      </span>
                      <textarea
                        value={card.answer}
                        onChange={(event) => updateCard(card.id, "answer", event.target.value)}
                        rows={(card.format ?? "identification") === "enumeration" ? 5 : 3}
                        maxLength={5000}
                        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                      />
                    </label>
                    <label className="mt-3 block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                        Hint <span className="font-normal text-slate-400">(optional)</span>
                      </span>
                      <input
                        value={card.hint}
                        onChange={(event) => updateCard(card.id, "hint", event.target.value)}
                        maxLength={500}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                      />
                    </label>
                  </article>
                );
              })}
            </div>

            {cards.length > PAGE_SIZE && (
              <nav aria-label="Flashcard edit pages" className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>
                <span aria-live="polite" className="text-xs font-medium text-slate-500">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </nav>
            )}

            <button
              type="button"
              onClick={addCard}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700"
            >
              <Plus size={15} />
              Add a card
            </button>
          </>
        ) : null}
      </main>

      {deck && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {cards.length} {cards.length === 1 ? "card" : "cards"}
              </p>
              <p className="hidden text-[10px] text-slate-400 sm:block">Your edits save to this deck</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-sm"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={15} />}
              {saving ? "Saving changes…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditDeckPage() {
  return <AuthGate><EditDeckForm /></AuthGate>;
}
