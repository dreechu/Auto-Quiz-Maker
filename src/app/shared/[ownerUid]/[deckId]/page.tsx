"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Eye,
  EyeOff,
  Lightbulb,
  LoaderCircle,
  PartyPopper,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Timer,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import type { CardStatus, Deck, Flashcard } from "@/lib/flashcards";

type SharedDeck = Deck & { id: string };
type SharedCard = Flashcard & { id: string; status: CardStatus };
type CardFilter = "all" | "learning";
type FormatFilter = "mixed" | "identification" | "enumeration";
type StudyMode = "flashcards" | "multiple-choice";
type Rhythm = "idle" | "focus" | "paused" | "break" | "break-offer" | "break-done";
type AnswerOption = { answer: string; isCorrect: boolean };

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const MAX_FOCUS_MINUTES = 180;
const MAX_BREAK_MINUTES = 60;

function getAnswerOptions(card: SharedCard, cards: SharedCard[]): AnswerOption[] {
  const correct = card.answer.trim();
  const answers = cards
    .filter((item) => item.id !== card.id)
    .map((item) => item.answer.trim())
    .filter(
      (answer, index, list) =>
        answer &&
        answer.toLocaleLowerCase() !== correct.toLocaleLowerCase() &&
        list.findIndex(
          (other) => other.toLocaleLowerCase() === answer.toLocaleLowerCase(),
        ) === index,
    )
    .slice(0, 3);
  const options = [{ answer: correct, isCorrect: true }, ...answers.map((answer) => ({ answer, isCorrect: false }))];
  let seed = 0;
  for (const char of card.id) seed = (seed * 31 + char.charCodeAt(0)) | 0;
  for (let i = options.length - 1; i > 0; i -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const swap = Math.floor((seed / 233280) * (i + 1));
    [options[i], options[swap]] = [options[swap], options[i]];
  }
  return options;
}

function SharedDeckContent() {
  const { ownerUid, deckId } = useParams<{ ownerUid: string; deckId: string }>();
  const [deck, setDeck] = useState<SharedDeck | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [filter, setFilter] = useState<CardFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("mixed");
  const [studyMode, setStudyMode] = useState<StudyMode>("flashcards");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shuffleOrder, setShuffleOrder] = useState<string[] | null>(null);
  const [rhythm, setRhythm] = useState<Rhythm>("idle");
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [timerDeadline, setTimerDeadline] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDeck() {
      try {
        const response = await fetch(
          `/api/public-decks/${encodeURIComponent(ownerUid)}/${encodeURIComponent(deckId)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as {
          deck?: Deck;
          ownerName?: string;
          error?: string;
        };
        if (!response.ok || !result.deck) {
          throw new Error(result.error || "This shared deck couldn’t be loaded.");
        }
        if (active) {
          setDeck({ ...result.deck, id: deckId });
          setOwnerName(result.ownerName ?? "Recall learner");
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This shared deck couldn’t be loaded. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDeck();
    return () => {
      active = false;
    };
  }, [ownerUid, deckId]);

  useEffect(() => {
    if (timerDeadline === null) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((timerDeadline - Date.now()) / 1000),
      );
      setTimerSeconds(remaining);
      if (remaining === 0) {
        setTimerDeadline(null);
        setRhythm((current) =>
          current === "focus" ? "break-offer" : "break-done",
        );
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [timerDeadline]);

  const allCards = useMemo(() => {
    const cards = Object.entries(deck?.cards ?? {}).map(([id, card]) => ({
      ...card,
      format: card.format ?? "identification",
      status: statuses[id] ?? "new",
      id,
    })) as SharedCard[];
    if (!shuffleOrder) return cards;
    const order = new Map(shuffleOrder.map((id, position) => [id, position]));
    return cards.sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [deck?.cards, shuffleOrder, statuses]);

  const queue = useMemo(
    () =>
      allCards.filter(
        (card) =>
          (filter !== "learning" || card.status !== "mastered") &&
          (formatFilter === "mixed" || card.format === formatFilter),
      ),
    [allCards, filter, formatFilter],
  );
  const card = queue[index];
  const options = useMemo(
    () => (card ? getAnswerOptions(card, allCards) : []),
    [card, allCards],
  );
  const selectedOption = options.find(
    (option) =>
      option.answer.toLocaleLowerCase() === selectedAnswer?.toLocaleLowerCase(),
  );
  const masteredCount = allCards.filter((item) => item.status === "mastered").length;
  const learningCount = allCards.length - masteredCount;
  const identificationCount = allCards.filter((item) => item.format === "identification").length;
  const enumerationCount = allCards.filter((item) => item.format === "enumeration").length;
  const finished = !loading && allCards.length > 0 && index >= queue.length;
  const masteryPercent = allCards.length
    ? Math.round((masteredCount / allCards.length) * 100)
    : 0;
  const timerLabel = `${Math.floor(timerSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(timerSeconds % 60).toString().padStart(2, "0")}`;
  const focusDurationValid =
    Number.isInteger(focusMinutes) &&
    focusMinutes >= 1 &&
    focusMinutes <= MAX_FOCUS_MINUTES;
  const breakDurationValid =
    Number.isInteger(breakMinutes) &&
    breakMinutes >= 1 &&
    breakMinutes <= MAX_BREAK_MINUTES;

  const resetCardView = useCallback(() => {
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }, []);

  const markCard = useCallback((status: "learning" | "mastered") => {
    if (!card) return;
    setStatuses((current) => ({ ...current, [card.id]: status }));
    setIndex((current) =>
      filter === "learning" && status === "mastered" ? current : current + 1,
    );
    resetCardView();
  }, [card, filter, resetCardView]);

  const moveTo = useCallback((nextIndex: number) => {
    setIndex(Math.max(0, Math.min(queue.length - 1, nextIndex)));
    resetCardView();
  }, [queue.length, resetCardView]);

  function setCardFilter(next: CardFilter) {
    setFilter(next);
    setIndex(0);
    resetCardView();
  }

  function setCardFormat(next: FormatFilter) {
    setFormatFilter(next);
    setIndex(0);
    resetCardView();
  }

  function shuffleCards() {
    const ids = allCards.map((item) => item.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setShuffleOrder(ids);
    setIndex(0);
    resetCardView();
  }

  function startFocus() {
    if (!focusDurationValid) return;
    const duration = focusMinutes * 60;
    setTimerSeconds(duration);
    setTimerDeadline(Date.now() + duration * 1000);
    setRhythm("focus");
  }

  function startBreak() {
    if (!breakDurationValid) return;
    const duration = breakMinutes * 60;
    setTimerSeconds(duration);
    setTimerDeadline(Date.now() + duration * 1000);
    setRhythm("break");
  }

  function pauseFocus() {
    if (timerDeadline !== null) {
      setTimerSeconds(Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000)));
    }
    setTimerDeadline(null);
    setRhythm("paused");
  }

  function resumeFocus() {
    setTimerDeadline(Date.now() + timerSeconds * 1000);
    setRhythm("focus");
  }

  function endBreak() {
    setTimerDeadline(null);
    setTimerSeconds(focusMinutes * 60);
    setRhythm("break-done");
  }

  function continueAfterBreak() {
    setRhythm("idle");
    setTimerSeconds(focusMinutes * 60);
  }

  function restartStudy(nextFilter: CardFilter = "all") {
    setFilter(nextFilter);
    setFormatFilter("mixed");
    setIndex(0);
    resetCardView();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9">
        <Link href="/discover" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
          <ArrowLeft size={15} />
          Discover
        </Link>
        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin text-indigo-600" />
            Loading shared flashcards
          </div>
        ) : error ? (
          <div role="alert" className="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <p>{error}</p>
            <Link href="/discover" className="mt-3 inline-flex font-semibold text-rose-800 underline">Browse other decks</Link>
          </div>
        ) : deck ? (
          <>
            <section className="mt-3 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-semibold text-indigo-700">
                  <Sparkles size={13} />
                  Shared by {ownerName} · Private progress
                </span>
                <h1 className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">{deck.title}</h1>
                {deck.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{deck.description}</p>}
                <p className="mt-3 text-xs text-slate-400">{allCards.length} {allCards.length === 1 ? "flashcard" : "flashcards"} · Your answers are only saved in this visit</p>
              </div>
              {allCards.length > 0 && (
                <button type="button" onClick={shuffleCards} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">
                  <Shuffle size={14} />
                  Shuffle
                </button>
              )}
            </section>

            {allCards.length > 0 && (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Filter cards by progress">
                      <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setCardFilter("all")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${filter === "all" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>
                        All ({allCards.length})
                      </button>
                      <button type="button" role="tab" aria-selected={filter === "learning"} onClick={() => setCardFilter("learning")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${filter === "learning" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>
                        Still learning ({learningCount})
                      </button>
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Choose answer mode">
                      <button type="button" role="tab" aria-selected={studyMode === "flashcards"} onClick={() => { setStudyMode("flashcards"); resetCardView(); }} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${studyMode === "flashcards" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>
                        Flashcards
                      </button>
                      <button type="button" role="tab" aria-selected={studyMode === "multiple-choice"} onClick={() => { setStudyMode("multiple-choice"); resetCardView(); }} disabled={new Set(allCards.map((item) => item.answer.trim().toLocaleLowerCase())).size < 2} className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-40 ${studyMode === "multiple-choice" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>
                        Multiple choice
                      </button>
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Filter cards by question format">
                      <button type="button" role="tab" aria-selected={formatFilter === "mixed"} onClick={() => setCardFormat("mixed")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${formatFilter === "mixed" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>Mixed</button>
                      <button type="button" role="tab" aria-selected={formatFilter === "identification"} onClick={() => setCardFormat("identification")} disabled={!identificationCount} className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-40 ${formatFilter === "identification" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>Identification</button>
                      <button type="button" role="tab" aria-selected={formatFilter === "enumeration"} onClick={() => setCardFormat("enumeration")} disabled={!enumerationCount} className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-40 ${formatFilter === "enumeration" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>Enumeration</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">🟠 {learningCount} Learning</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">🟢 {masteredCount} Got it</span>
                  </div>
                </div>

                <section aria-label="Study rhythm timer" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><Timer size={18} /></span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {rhythm === "focus" || rhythm === "paused" ? `${timerLabel} ${rhythm === "paused" ? "paused" : "left"}` : rhythm === "break" ? `Break time · ${timerLabel} left` : rhythm === "break-done" ? "Welcome back" : "Try a gentle study rhythm"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {rhythm === "focus" ? "One question at a time; pause whenever you need." : rhythm === "break" ? "Rest your eyes, stretch, and step away from the screen." : `Optional: ${focusMinutes || "—"} minutes of focus, then a ${breakMinutes || "—"}-minute break.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-medium text-slate-500">
                      Focus
                      <input type="number" min={1} max={MAX_FOCUS_MINUTES} step={1} value={focusMinutes || ""} onChange={(event) => setFocusMinutes(Number(event.target.value))} disabled={rhythm === "focus" || rhythm === "break"} aria-label="Focus duration in minutes" className="w-14 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-700 outline-none focus:ring-0 disabled:opacity-60" />
                      min
                    </label>
                    <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-medium text-slate-500">
                      Break
                      <input type="number" min={1} max={MAX_BREAK_MINUTES} step={1} value={breakMinutes || ""} onChange={(event) => setBreakMinutes(Number(event.target.value))} disabled={rhythm === "focus" || rhythm === "break"} aria-label="Break duration in minutes" className="w-14 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-700 outline-none focus:ring-0 disabled:opacity-60" />
                      min
                    </label>
                    {rhythm === "idle" && <button type="button" onClick={startFocus} disabled={!focusDurationValid} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Play size={14} />Start focus</button>}
                    {rhythm === "idle" && <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"><Coffee size={14} />Take a break</button>}
                    {rhythm === "focus" && <button type="button" onClick={pauseFocus} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600"><Pause size={14} />Pause</button>}
                    {rhythm === "focus" && <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"><Coffee size={14} />Break now</button>}
                    {rhythm === "paused" && <button type="button" onClick={resumeFocus} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-[11px] font-semibold text-white"><Play size={14} />Resume</button>}
                    {rhythm === "paused" && <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"><Coffee size={14} />Take a break</button>}
                    {rhythm === "break-done" && <button type="button" onClick={startFocus} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-[11px] font-semibold text-white"><Play size={14} />Start another focus</button>}
                  </div>
                  {(!focusDurationValid || !breakDurationValid) && (
                    <p className="basis-full text-right text-[10px] text-rose-600">
                      Focus: 1–{MAX_FOCUS_MINUTES} min; break: 1–{MAX_BREAK_MINUTES} min.
                    </p>
                  )}
                </section>
              </>
            )}

            {(rhythm === "break-offer" || rhythm === "break") && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
                <section role="dialog" aria-modal="true" aria-labelledby="break-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-8">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Coffee size={25} /></span>
                  {rhythm === "break-offer" ? (
                    <>
                      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Focus session complete</p>
                      <h2 id="break-title" className="mt-2 text-xl font-semibold text-slate-900">You’ve earned a little pause.</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">Look away from the screen and let what you learned settle. A break is optional.</p>
                      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="h-11 flex-1 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Take a {breakMinutes}-minute break</button>
                        <button type="button" onClick={continueAfterBreak} className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600">Keep studying</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Rest your mind</p>
                      <h2 id="break-title" className="mt-2 text-xl font-semibold text-slate-900">Take a moment for yourself.</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">Step away from the screen, relax your eyes, and have a sip of water.</p>
                      <p aria-live="polite" className="my-6 text-4xl font-semibold tabular-nums text-slate-800">{timerLabel}</p>
                      <button type="button" onClick={endBreak} className="h-11 w-full rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white">I’m ready to return</button>
                    </>
                  )}
                </section>
              </div>
            )}

            {finished ? (
              <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><PartyPopper size={24} /></span>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Study session complete</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Nice work.</h2>
                <p className="mt-2 text-sm text-slate-500">Your progress is temporary and will reset when you leave this page.</p>
                <div className="mx-auto mt-6 grid size-28 place-items-center rounded-full" style={{ background: `conic-gradient(#10b981 ${masteryPercent * 3.6}deg, #e2e8f0 0deg)` }}>
                  <div className="grid size-24 place-items-center rounded-full bg-white"><div><p className="text-xl font-bold text-slate-800">{masteryPercent}%</p><p className="text-[9px] text-slate-400">got it</p></div></div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{masteredCount} of {allCards.length} cards marked got it</p>
                <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
                  {learningCount > 0 && <button type="button" onClick={() => restartStudy("learning")} className="h-11 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white">Review still learning ({learningCount})</button>}
                  <button type="button" onClick={() => restartStudy("all")} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700"><RotateCcw size={14} />Restart full deck</button>
                  <Link href="/discover" className="mt-2 text-xs font-semibold text-indigo-600">Back to Discover</Link>
                </div>
              </motion.section>
            ) : card ? (
              <>
                <div className="mt-6 flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Card {index + 1} of {queue.length}</span>
                  <span>{Math.round(((index + 1) / queue.length) * 100)}% through this queue</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
                </div>

                {studyMode === "multiple-choice" ? (
                  <motion.section key={`choice-${card.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 min-h-[360px] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:min-h-[400px] sm:px-10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold capitalize text-indigo-700">{card.difficulty}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold capitalize text-slate-600">{card.format}</span>
                    </div>
                    <h2 className="mx-auto mt-7 max-w-xl whitespace-pre-wrap text-center text-xl font-medium leading-relaxed text-slate-800 sm:text-2xl">{card.question}</h2>
                    <p className="mt-2 text-center text-[10px] text-slate-400">Try to answer from memory before choosing.</p>
                    <div className="mx-auto mt-6 grid max-w-xl gap-2.5">
                      {options.map((option, optionIndex) => {
                        const selected = selectedAnswer?.toLocaleLowerCase() === option.answer.toLocaleLowerCase();
                        const correctShown = selectedOption && option.isCorrect;
                        const style = correctShown
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : selected
                            ? "border-rose-300 bg-rose-50 text-rose-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50";
                        return (
                          <button key={`${card.id}-${option.answer}`} type="button" aria-pressed={selected} onClick={() => setSelectedAnswer(option.answer)} className={`flex min-h-12 items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm leading-6 ${style}`}>
                            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/80 text-[10px] font-bold text-slate-500">{String.fromCharCode(65 + optionIndex)}</span>
                            <span className="whitespace-pre-wrap">{option.answer}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedOption && <p aria-live="polite" className={`mx-auto mt-4 max-w-xl rounded-xl px-4 py-3 text-center text-sm font-medium ${selectedOption.isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{selectedOption.isCorrect ? "That’s right!" : `Not quite. The answer is: ${card.answer}`}</p>}
                    {card.hint && <button type="button" onClick={() => setShowHint((current) => !current)} className="mx-auto mt-4 flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium text-amber-700 hover:bg-amber-50"><Lightbulb size={14} />{showHint ? "Hide hint" : "Show hint"}</button>}
                    {showHint && card.hint && <p className="mx-auto mt-2 max-w-xl rounded-xl bg-amber-50 px-4 py-3 text-center text-xs leading-5 text-amber-800">{card.hint}</p>}
                  </motion.section>
                ) : (
                  <motion.div
                    key={`card-${card.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setFlipped((current) => !current)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setFlipped((current) => !current);
                      }
                    }}
                    aria-label={flipped ? "Show question" : "Reveal answer"}
                    className="mx-auto mt-6 flex min-h-[360px] w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-9 text-center shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 sm:min-h-[400px] sm:px-14"
                  >
                    <span className="flex flex-wrap justify-center gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold capitalize text-indigo-700">{card.difficulty}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold capitalize text-slate-600">{card.format}</span>
                    </span>
                    <span className="mt-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-600">{flipped ? "Answer" : "Question"}</span>
                    <span className={`my-5 max-w-xl whitespace-pre-wrap text-[21px] font-medium leading-[1.65] text-slate-800 sm:text-[26px] ${flipped && card.format === "enumeration" ? "text-left" : ""}`}>{flipped ? card.answer : card.question}</span>
                    {!flipped && showHint && card.hint && <span className="max-w-lg rounded-xl bg-amber-50 px-4 py-3 text-center text-xs leading-5 text-amber-800"><span className="font-semibold">Hint:</span> {card.hint}</span>}
                    {!flipped && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); setShowHint((current) => !current); }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}
                        className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                      >
                        <Lightbulb size={14} />{showHint ? "Hide hint" : "Show hint"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFlipped((current) => !current);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.stopPropagation();
                        }
                      }}
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      {flipped ? <EyeOff size={15} /> : <Eye size={15} />}
                      {flipped ? "Show question" : "Answer flashcard"}
                    </button>
                  </motion.div>
                )}

                <div className="mx-auto mt-5 flex max-w-2xl flex-col-reverse items-center justify-between gap-3 sm:flex-row">
                  <button type="button" onClick={() => moveTo(index - 1)} disabled={index === 0} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:w-auto"><ChevronLeft size={16} />Previous</button>
                  <div className="flex w-full flex-1 gap-3 sm:max-w-[440px]">
                    <button type="button" onClick={() => markCard("learning")} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100">🟠 Still learning</button>
                    <button type="button" onClick={() => markCard("mastered")} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"><Check size={16} />Got it!</button>
                  </div>
                  <button type="button" onClick={() => moveTo(index + 1)} disabled={index >= queue.length - 1} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:w-auto">Next<ChevronRight size={16} /></button>
                </div>
              </>
            ) : (
              <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-semibold text-slate-800">There are no cards in this public deck.</p>
                <Link href="/discover" className="mt-4 inline-flex text-xs font-semibold text-indigo-600">Browse other decks</Link>
              </section>
            )}

            <div className="mt-8 rounded-2xl bg-indigo-950 p-6 text-center text-white">
              <Sparkles className="mx-auto text-indigo-200" size={20} />
              <p className="mt-2 text-sm font-semibold">Want to make your own study deck?</p>
              <Link href="/signup" className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50">Create a free account</Link>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function SharedDeckPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main className="mx-auto mt-12 flex max-w-4xl items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin text-indigo-600" />
            Loading shared flashcards
          </main>
        </div>
      }
    >
      <SharedDeckContent />
    </Suspense>
  );
}
