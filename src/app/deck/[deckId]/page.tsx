"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Coffee,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  LoaderCircle,
  Pause,
  PartyPopper,
  Play,
  RotateCcw,
  Shuffle,
  Timer,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { rateCard, subscribeToDeck } from "@/lib/db";
import type { Deck, Flashcard } from "@/lib/flashcards";
import type { ReviewRating } from "@/lib/flashcards";

type StudyCard = Flashcard & { id: string };
type CardFilter = "all" | "learning" | "due";
type StudyMode = "flashcards" | "multiple-choice";
type QuestionFormatFilter = "mixed" | "identification" | "enumeration";
type StudyRhythm = "idle" | "focus" | "paused" | "break" | "break-offer" | "break-done";

const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;
const MAX_FOCUS_MINUTES = 180;
const MAX_BREAK_MINUTES = 60;

type AnswerOption = {
  answer: string;
  isCorrect: boolean;
};

function getAnswerOptions(card: StudyCard, cards: StudyCard[]): AnswerOption[] {
  const correctAnswer = card.answer.trim();
  const normalizedCorrectAnswer = correctAnswer.toLocaleLowerCase();
  const distractors = cards
    .filter((item) => item.id !== card.id)
    .map((item) => item.answer.trim())
    .filter(
      (answer, index, answers) =>
        answer.length > 0 &&
        answer.toLocaleLowerCase() !== normalizedCorrectAnswer &&
        answers.findIndex(
          (candidate) =>
            candidate.toLocaleLowerCase() === answer.toLocaleLowerCase(),
        ) === index,
    )
    .slice(0, 3)
    .map((answer) => ({ answer, isCorrect: false }));
  const options = [{ answer: correctAnswer, isCorrect: true }, ...distractors];

  let seed = 2166136261;
  for (const character of card.id) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  }
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let position = options.length - 1; position > 0; position -= 1) {
    const swap = Math.floor(random() * (position + 1));
    [options[position], options[swap]] = [options[swap], options[position]];
  }
  return options;
}

function StudyDeck() {
  const { deckId } = useParams<{ deckId: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<CardFilter>(
    searchParams.get("due") === "1" ? "due" : "all",
  );
  const [questionFormat, setQuestionFormat] =
    useState<QuestionFormatFilter>("mixed");
  const [studyMode, setStudyMode] = useState<StudyMode>("flashcards");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState<string[] | null>(null);
  const [studyRhythm, setStudyRhythm] = useState<StudyRhythm>("idle");
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [timerDeadline, setTimerDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const actionLock = useRef(false);

  useEffect(() => {
    if (!user || !deckId) return;
    return subscribeToDeck(
      user.uid,
      deckId,
      (nextDeck) => {
        setDeck(nextDeck);
        setLoading(false);
        setError("");
      },
      () => {
        setError("This deck couldn’t be loaded. Check your connection and try again.");
        setLoading(false);
      },
    );
  }, [user, deckId]);

  useEffect(() => {
    let timer: number;
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      timer = window.setInterval(() => setNow(Date.now()), 60_000);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      if (timer) window.clearInterval(timer);
    };
  }, []);

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
        setStudyRhythm((current) =>
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
      id,
    }));
    if (!shuffleOrder) return cards;
    const order = new Map(shuffleOrder.map((id, position) => [id, position]));
    return cards.sort(
      (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [deck?.cards, shuffleOrder]);
  const queue = useMemo(
    () =>
      allCards.filter(
        (item) =>
          (filter !== "learning" || item.status !== "mastered") &&
          (filter !== "due" || !item.nextReviewAt || item.nextReviewAt <= now) &&
          (questionFormat === "mixed" || item.format === questionFormat),
      ),
    [allCards, filter, questionFormat, now],
  );
  const card = queue[index];
  const answerOptions = useMemo(
    () => (card ? getAnswerOptions(card, allCards) : []),
    [card, allCards],
  );
  const canUseMultipleChoice =
    new Set(allCards.map((item) => item.answer.trim().toLocaleLowerCase())).size >
    1;
  const selectedOption = answerOptions.find(
    (option) =>
      option.answer.toLocaleLowerCase() ===
      selectedAnswer?.toLocaleLowerCase(),
  );
  const masteredCount = allCards.filter((item) => item.status === "mastered").length;
  const learningCount = allCards.length - masteredCount;
  const dueCount = allCards.filter(
    (item) => !item.nextReviewAt || item.nextReviewAt <= now,
  ).length;
  const identificationCount = allCards.filter(
    (item) => item.format === "identification",
  ).length;
  const enumerationCount = allCards.filter(
    (item) => item.format === "enumeration",
  ).length;
  const finished = !loading && allCards.length > 0 && index >= queue.length;

  const advance = useCallback((currentFilter: CardFilter, currentIndex: number, status: "learning" | "mastered") => {
    const cardLeavesQueue =
      currentFilter === "due" ||
      (currentFilter === "learning" && status === "mastered");
    setIndex(currentIndex + (cardLeavesQueue ? 0 : 1));
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }, []);

  const markCard = useCallback(
    async (rating: ReviewRating) => {
      const answerRevealed =
        studyMode === "multiple-choice" ? selectedOption !== undefined : flipped;
      if (!user || !deckId || !card || !answerRevealed || actionLock.current) return;
      actionLock.current = true;
      setSaving(true);
      setError("");
      try {
        const result = await rateCard(user.uid, deckId, card.id, rating);
        setDeck((current) => {
          if (!current?.cards[card.id]) return current;
          const nextCards = {
            ...current.cards,
            [card.id]: { ...current.cards[card.id], ...result.card },
          };
          return {
            ...current,
            cards: nextCards,
            cardCount: result.cardCount,
            masteredCount: result.masteredCount,
            updatedAt: Date.now(),
          };
        });
        advance(filter, index, result.card.status);
      } catch (saveError) {
        console.error("Could not save this flashcard's status.", saveError);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Your progress couldn’t be saved. Please try again.",
        );
      } finally {
        actionLock.current = false;
        setSaving(false);
      }
    },
    [user, deckId, card, advance, filter, index, studyMode, selectedOption, flipped],
  );

  const flipCard = useCallback(() => {
    if (card && !saving) setFlipped((current) => !current);
  }, [card, saving]);

  const toggleHint = useCallback(() => {
    if (card && !flipped) setShowHint((current) => !current);
  }, [card, flipped]);

  function changeFilter(nextFilter: CardFilter) {
    setFilter(nextFilter);
    setIndex(0);
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }

  function changeQuestionFormat(nextFormat: QuestionFormatFilter) {
    setQuestionFormat(nextFormat);
    setIndex(0);
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }

  function shuffleCards() {
    const shuffled = [...allCards.map((item) => item.id)];
    for (let position = shuffled.length - 1; position > 0; position -= 1) {
      const swap = Math.floor(Math.random() * (position + 1));
      [shuffled[position], shuffled[swap]] = [shuffled[swap], shuffled[position]];
    }
    setShuffleOrder(shuffled);
    setIndex(0);
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }

  function restartDeck(nextFilter: CardFilter = "all") {
    setFilter(nextFilter);
    setQuestionFormat("mixed");
    setIndex(0);
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }

  function changeStudyMode(nextMode: StudyMode) {
    setStudyMode(nextMode);
    setFlipped(false);
    setShowHint(false);
    setSelectedAnswer(null);
  }

  const cardFormat = card?.format ?? "identification";
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

  function startFocus() {
    if (!Number.isInteger(focusMinutes) || focusMinutes < 1 || focusMinutes > MAX_FOCUS_MINUTES) return;
    const duration = focusMinutes * 60;
    setTimerSeconds(duration);
    setTimerDeadline(Date.now() + duration * 1000);
    setStudyRhythm("focus");
  }

  function startBreak() {
    if (!Number.isInteger(breakMinutes) || breakMinutes < 1 || breakMinutes > MAX_BREAK_MINUTES) return;
    const duration = breakMinutes * 60;
    setTimerSeconds(duration);
    setTimerDeadline(Date.now() + duration * 1000);
    setStudyRhythm("break");
  }

  function pauseFocus() {
    if (timerDeadline !== null) {
      setTimerSeconds(
        Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000)),
      );
    }
    setTimerDeadline(null);
    setStudyRhythm("paused");
  }

  function resumeFocus() {
    setTimerDeadline(Date.now() + timerSeconds * 1000);
    setStudyRhythm("focus");
  }

  function endBreak() {
    setTimerDeadline(null);
    setTimerSeconds(focusMinutes * 60);
    setStudyRhythm("break-done");
  }

  function continueAfterBreak() {
    setStudyRhythm("idle");
    setTimerSeconds(focusMinutes * 60);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto mt-12 h-[390px] max-w-3xl animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error && !deck) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main role="alert" className="mx-auto mt-10 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</main>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">We couldn’t find that deck.</h1>
          <Link href="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-indigo-600">Back to dashboard</Link>
        </main>
      </div>
    );
  }

  const masteryPercent = allCards.length ? Math.round((masteredCount / allCards.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
              <ArrowLeft size={15} />
              Dashboard
            </Link>
            <h1 className="truncate text-[23px] font-semibold tracking-[-0.045em] text-slate-900 sm:text-[28px]">{deck.title}</h1>
            <p className="mt-1 text-xs text-slate-500">{allCards.length} {allCards.length === 1 ? "card" : "cards"} · {masteredCount} mastered</p>
          </div>
          {allCards.length > 0 && (
            <button type="button" onClick={shuffleCards} className="mt-7 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">
              <Shuffle size={14} />
              Shuffle
            </button>
          )}
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{error}</p>}

        {allCards.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Filter study cards">
                <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => changeFilter("all")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${filter === "all" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  All Cards ({allCards.length})
                </button>
                <button type="button" role="tab" aria-selected={filter === "learning"} onClick={() => changeFilter("learning")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${filter === "learning" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Still Learning ({learningCount})
                </button>
                <button type="button" role="tab" aria-selected={filter === "due"} onClick={() => changeFilter("due")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${filter === "due" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Due Today ({dueCount})
                </button>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Choose study mode">
                <button type="button" role="tab" aria-selected={studyMode === "flashcards"} onClick={() => changeStudyMode("flashcards")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${studyMode === "flashcards" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Flashcards
                </button>
                <button type="button" role="tab" aria-selected={studyMode === "multiple-choice"} onClick={() => changeStudyMode("multiple-choice")} disabled={!canUseMultipleChoice} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${studyMode === "multiple-choice" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Multiple Choice
                </button>
              </div>
              {!canUseMultipleChoice && <p className="self-center text-[10px] text-slate-400">Add cards with different answers to use multiple choice.</p>}
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Filter question format">
                <button type="button" role="tab" aria-selected={questionFormat === "mixed"} onClick={() => changeQuestionFormat("mixed")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${questionFormat === "mixed" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Mixed ({allCards.length})
                </button>
                <button type="button" role="tab" aria-selected={questionFormat === "identification"} onClick={() => changeQuestionFormat("identification")} disabled={identificationCount === 0} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${questionFormat === "identification" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Identification ({identificationCount})
                </button>
                <button type="button" role="tab" aria-selected={questionFormat === "enumeration"} onClick={() => changeQuestionFormat("enumeration")} disabled={enumerationCount === 0} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${questionFormat === "enumeration" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
                  Enumeration ({enumerationCount})
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium">
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">🟠 {learningCount} Still Learning</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">🟢 {masteredCount} Got It</span>
            </div>
          </div>
        )}

        {allCards.length > 0 && (
          <section
            aria-label="Study rhythm timer"
            className="mt-5 flex min-w-0 flex-col items-stretch gap-3 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <Timer size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  {studyRhythm === "focus" || studyRhythm === "paused"
                    ? `${timerLabel} ${studyRhythm === "paused" ? "paused" : "left"}`
                    : studyRhythm === "break"
                      ? `Break time · ${timerLabel} left`
                      : studyRhythm === "break-done"
                        ? "Welcome back"
                        : "Try a gentle study rhythm"}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                  {studyRhythm === "focus"
                    ? "One question at a time. Take a breather whenever you need."
                    : studyRhythm === "paused"
                      ? "Your focus timer is paused. Resume when you’re ready."
                      : studyRhythm === "break"
                        ? "Rest your eyes, stretch, and step away from the screen."
                        : studyRhythm === "break-done"
                          ? "A little rest can help the ideas settle."
                          : `Optional: ${focusMinutes || "—"} minutes of focus, then a ${breakMinutes || "—"}-minute break.`}
                </p>
              </div>
            </div>
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:w-auto sm:flex sm:flex-wrap">
              <label className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-500 sm:w-auto sm:gap-2 sm:px-2.5">
                Focus
                <input
                  type="number"
                  min={1}
                  max={MAX_FOCUS_MINUTES}
                  step={1}
                  value={focusMinutes || ""}
                  onChange={(event) => setFocusMinutes(Number(event.target.value))}
                  disabled={studyRhythm === "focus" || studyRhythm === "break"}
                  aria-label="Focus duration in minutes"
                  className="w-10 min-w-0 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-700 outline-none focus:ring-0 disabled:opacity-60 sm:w-14"
                />
                min
              </label>
              <label className="flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-500 sm:w-auto sm:gap-2 sm:px-2.5">
                Break
                <input
                  type="number"
                  min={1}
                  max={MAX_BREAK_MINUTES}
                  step={1}
                  value={breakMinutes || ""}
                  onChange={(event) => setBreakMinutes(Number(event.target.value))}
                  disabled={studyRhythm === "focus" || studyRhythm === "break"}
                  aria-label="Break duration in minutes"
                  className="w-10 min-w-0 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-700 outline-none focus:ring-0 disabled:opacity-60 sm:w-14"
                />
                min
              </label>
              {studyRhythm === "idle" && (
                <>
                  <button type="button" onClick={startFocus} disabled={!focusDurationValid} className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl bg-indigo-600 px-2 text-[10px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                    <Play size={14} className="shrink-0" />
                    <span className="truncate">Start focus</span>
                  </button>
                  <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                    <Coffee size={14} className="shrink-0" />
                    <span className="truncate">Take a break</span>
                  </button>
                </>
              )}
              {studyRhythm === "focus" && (
                <>
                  <button type="button" onClick={pauseFocus} className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                    <Pause size={14} className="shrink-0" />
                    <span className="truncate">Pause</span>
                  </button>
                  <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                    <Coffee size={14} className="shrink-0" />
                    <span className="truncate">Break now</span>
                  </button>
                </>
              )}
              {studyRhythm === "paused" && (
                <>
                  <button type="button" onClick={resumeFocus} className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl bg-indigo-600 px-2 text-[10px] font-semibold text-white transition hover:bg-indigo-700 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                    <Play size={14} className="shrink-0" />
                    <span className="truncate">Resume</span>
                  </button>
                  <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                    <Coffee size={14} className="shrink-0" />
                    <span className="truncate">Take a break</span>
                  </button>
                </>
              )}
              {studyRhythm === "break-done" && (
                <button type="button" onClick={startFocus} disabled={!focusDurationValid} className="col-span-2 inline-flex h-9 w-full min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl bg-indigo-600 px-2 text-[10px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[11px]">
                  <Play size={14} className="shrink-0" />
                  <span className="truncate">Start another focus</span>
                </button>
              )}
              {(!focusDurationValid || !breakDurationValid) && (
                <p className="col-span-2 text-right text-[10px] text-rose-600">
                  Focus: 1–{MAX_FOCUS_MINUTES} min; break: 1–{MAX_BREAK_MINUTES} min.
                </p>
              )}
            </div>
          </section>
        )}

        {(studyRhythm === "break-offer" || studyRhythm === "break") && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="study-break-title"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl sm:p-8"
            >
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Coffee size={25} />
              </span>
              {studyRhythm === "break-offer" ? (
                <>
                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Focus session complete
                  </p>
                  <h2 id="study-break-title" className="mt-2 text-xl font-semibold text-slate-900">
                    You’ve earned a little pause.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Look away from the screen, stretch, and let what you learned settle. Taking a break is optional.
                  </p>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={startBreak} disabled={!breakDurationValid} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Coffee size={15} />
                      Take a {breakMinutes}-minute break
                    </button>
                    <button type="button" onClick={continueAfterBreak} className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                      Keep studying
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Rest your mind
                  </p>
                  <h2 id="study-break-title" className="mt-2 text-xl font-semibold text-slate-900">
                    Take a moment for yourself.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Step away from the screen, relax your eyes, and have a sip of water.
                  </p>
                  <p aria-live="polite" className="my-6 text-4xl font-semibold tabular-nums tracking-tight text-slate-800">
                    {timerLabel}
                  </p>
                  <button type="button" onClick={endBreak} className="h-11 w-full rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700">
                    I’m ready to return
                  </button>
                </>
              )}
            </section>
          </div>
        )}

        {finished ? (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><PartyPopper size={25} /></span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-600">Study session complete</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Look at you go.</h2>
            <p className="mt-2 text-sm text-slate-500">You’ve got this deck moving in the right direction.</p>
            <div className="mx-auto mt-7 grid size-32 place-items-center rounded-full" style={{ background: `conic-gradient(#10b981 ${masteryPercent * 3.6}deg, #e2e8f0 0deg)` }}>
              <div className="grid size-[104px] place-items-center rounded-full bg-white">
                <div>
                  <p className="text-2xl font-bold tracking-tight text-slate-800">{masteryPercent}%</p>
                  <p className="text-[9px] text-slate-400">mastered</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">{masteredCount} of {allCards.length} cards mastered</p>
            <div className="mx-auto mt-7 flex max-w-sm flex-col gap-2.5">
              {learningCount > 0 && (
                <button type="button" onClick={() => restartDeck("learning")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  <RotateCcw size={15} />
                  Review Still Learning Cards Only ({learningCount})
                </button>
              )}
              <button type="button" onClick={() => restartDeck("all")} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                <RotateCcw size={15} />
                Restart Full Deck
              </button>
              <Link href="/dashboard" className="mt-1 inline-flex h-10 items-center justify-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                <ArrowLeft size={14} />
                Back to Dashboard
              </Link>
            </div>
          </motion.section>
        ) : card ? (
          <>
            <div className="mt-6 flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Card {index + 1} of {queue.length}</span>
              <span>{Math.round(((index + 1) / queue.length) * 100)}% through this queue</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
            </div>

            {studyMode === "multiple-choice" ? (
              <motion.section
                key={`multiple-choice-${card.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto mt-6 min-h-[360px] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:min-h-[400px] sm:px-10 sm:py-9"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold capitalize text-indigo-700">{card.difficulty}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold capitalize text-slate-600">{cardFormat}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Choose one answer</span>
                </div>
                <h2 className="mx-auto mt-7 max-w-xl whitespace-pre-wrap text-center text-[20px] font-medium leading-[1.65] tracking-[-0.025em] text-slate-800 sm:text-[25px]">
                  {card.question}
                </h2>
                <p className="mt-2 text-center text-[10px] text-slate-400">Active recall: pause and try to answer from memory before choosing.</p>
                <div className="mx-auto mt-7 grid max-w-xl gap-2.5">
                  {answerOptions.map((option, optionIndex) => {
                    const isSelected =
                      selectedAnswer?.toLocaleLowerCase() ===
                      option.answer.toLocaleLowerCase();
                    const showCorrectAnswer = selectedOption && option.isCorrect;
                    const optionStyle = showCorrectAnswer
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : isSelected
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50";
                    return (
                      <button
                        key={option.answer}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={saving}
                        onClick={() => setSelectedAnswer(option.answer)}
                        className={`flex min-h-12 items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm leading-6 transition disabled:cursor-wait disabled:opacity-60 ${optionStyle}`}
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/80 text-[10px] font-bold text-slate-500">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="whitespace-pre-wrap">{option.answer}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedOption && (
                  <p aria-live="polite" className={`mx-auto mt-4 max-w-xl rounded-xl px-4 py-3 text-center text-sm font-medium ${selectedOption.isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                    {selectedOption.isCorrect
                      ? "That’s right!"
                      : `Not quite. The correct answer is: ${card.answer}`}
                  </p>
                )}
                {showHint && card.hint && (
                  <p className="mx-auto mt-3 max-w-xl rounded-xl bg-amber-50 px-4 py-3 text-center text-xs leading-5 text-amber-800">
                    <span className="font-semibold">Hint:</span> {card.hint}
                  </p>
                )}
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowHint((current) => !current)}
                    disabled={!card.hint}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Lightbulb size={14} />
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </button>
                </div>
              </motion.section>
            ) : (
            <motion.div
              role="button"
              tabIndex={0}
              onClick={flipCard}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  flipCard();
                }
              }}
              aria-label={flipped ? "Show question side" : "Flip to reveal answer"}
              aria-disabled={saving}
              className={`study-card mx-auto mt-6 flex min-h-[360px] w-full max-w-2xl items-stretch rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 sm:min-h-[400px] ${saving ? "cursor-wait" : "cursor-pointer"}`}
            >
              <motion.span
                className="study-card-inner min-h-[360px] w-full sm:min-h-[400px]"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="study-card-face flex min-h-[360px] flex-col items-center justify-center rounded-2xl px-6 py-9 sm:min-h-[400px] sm:px-14">
                  <span className="flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold capitalize text-indigo-700">{card.difficulty}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold capitalize text-slate-600">{cardFormat}</span>
                  </span>
                  <span className="mt-7 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Question</span>
                  <span className="mt-2 text-center text-[10px] text-slate-400">Take a breath and recall your answer before flipping.</span>
                  <span className="my-5 max-w-xl whitespace-pre-wrap text-center text-[21px] font-medium leading-[1.65] tracking-[-0.025em] text-slate-800 sm:text-[26px]">{card.question}</span>
                  {showHint && card.hint && (
                    <span className="max-w-lg rounded-xl bg-amber-50 px-4 py-3 text-center text-xs leading-5 text-amber-800">
                      <span className="font-semibold">Hint:</span> {card.hint}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); toggleHint(); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                      }
                    }}
                    className="mt-7 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium text-amber-700 transition hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <Lightbulb size={14} />
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </button>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><RotateCcw size={12} />Tap card to flip</span>
                </span>
                <span className="study-card-face study-card-back flex min-h-[360px] flex-col items-center justify-center rounded-2xl bg-indigo-50/70 px-6 py-9 sm:min-h-[400px] sm:px-14">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-600">Answer</span>
                  <span className={`my-6 max-w-xl whitespace-pre-wrap text-[20px] font-medium leading-[1.75] tracking-[-0.015em] text-slate-800 sm:text-[24px] ${cardFormat === "enumeration" ? "w-full text-left" : "text-center"}`}>{card.answer}</span>
                  {card.hint && <span className="max-w-lg text-center text-xs leading-5 text-slate-500"><span className="font-semibold text-indigo-600">Remember:</span> {card.hint}</span>}
                  <span className="mt-8 inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><RotateCcw size={12} />Tap card to flip</span>
                </span>
              </motion.span>
            </motion.div>
            )}

            <div className="mx-auto mt-5 flex max-w-2xl flex-col-reverse items-center justify-between gap-3 sm:flex-row">
              <button type="button" onClick={() => { setIndex((current) => Math.max(0, current - 1)); setFlipped(false); setShowHint(false); setSelectedAnswer(null); }} disabled={index === 0 || saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:w-auto">
                <ChevronLeft size={16} />
                Previous
              </button>
              <div className="grid w-full flex-1 grid-cols-2 gap-2 sm:max-w-[440px] sm:grid-cols-4">
                {([
                  ["again", "Again", "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"],
                  ["hard", "Hard", "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"],
                  ["good", "Good", "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"],
                  ["easy", "Easy", "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"],
                ] as const).map(([rating, label, style]) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => void markCard(rating)}
                    disabled={saving || (studyMode === "multiple-choice" ? !selectedOption : !flipped)}
                    className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
                  >
                    {saving && <LoaderCircle size={14} className="animate-spin" />}
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setIndex((current) => current + 1); setFlipped(false); setShowHint(false); setSelectedAnswer(null); }} disabled={saving} className="hidden h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:inline-flex">
                Skip
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <AnimatePresence mode="wait">
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><PartyPopper size={22} /></span>
              <h2 className="mt-4 text-base font-semibold text-slate-800">This deck doesn’t have any cards yet.</h2>
              <p className="mt-1 text-sm text-slate-500">Create a new set from your study notes to get started.</p>
              <Link href="/create" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white">Create flashcards <ArrowRight size={14} /></Link>
            </motion.section>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

export default function DeckPage() {
  return (
    <AuthGate>
      <Suspense fallback={<div className="min-h-screen bg-slate-50"><Navbar /><main className="mx-auto mt-12 h-[390px] max-w-3xl animate-pulse rounded-2xl border border-slate-200 bg-white" /></div>}>
        <StudyDeck />
      </Suspense>
    </AuthGate>
  );
}
