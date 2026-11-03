"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  Flame,
  FileImage,
  FileText,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Share2,
  Globe2,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { deleteDeck, getStudyInsights, setDeckPublic, subscribeToDecks, type DeckWithId, type StudyInsights } from "@/lib/db";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";
import type { SourceType } from "@/lib/flashcards";

function relativeDate(timestamp: number) {
  const date = new Date(timestamp);
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return "Recently created";
  if (Math.abs(days) < 1) return "Today";
  if (Math.abs(days) < 7) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day");
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function DashboardContent() {
  const { user, profile, isAdmin } = useAuth();
  const [decks, setDecks] = useState<DeckWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [insights, setInsights] = useState<StudyInsights | null>(null);
  const [insightsError, setInsightsError] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!user) return;
    return subscribeToDecks(
      user.uid,
      (nextDecks) => {
        setDecks(nextDecks);
        setError("");
        setLoading(false);
      },
      () => {
        setError("Your decks couldn’t be loaded. Check your connection and database rules.");
        setLoading(false);
      },
    );
  }, [user]);

  useEffect(() => {
    let interval: number;
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      interval = window.setInterval(() => setNow(Date.now()), 60_000);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getStudyInsights(user.uid)
      .then((result) => {
        if (active) {
          setInsights(result);
          setInsightsError("");
        }
      })
      .catch((loadError: unknown) => {
        console.error("Could not load study insights.", loadError);
        if (active) {
          setInsightsError(
            loadError instanceof Error
              ? loadError.message
              : "Study insights couldn’t be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const deckStats = useMemo(
    () =>
      decks.map((deck) => {
        const cards = Object.values(deck.cards ?? {});
        const dueCount = cards.filter(
          (card) => !card.nextReviewAt || card.nextReviewAt <= now,
        ).length;
        const practiceCards = Object.entries(deck.cards ?? {})
          .filter(([, card]) => card.status === "learning" || (card.lapseCount ?? 0) >= 2)
          .map(([cardId, card]) => ({ deckId: deck.id, deckTitle: deck.title, cardId, question: card.question, lapses: card.lapseCount ?? 0 }));
        return { deck, dueCount, cards, practiceCards };
      }),
    [decks, now],
  );
  const dueDecks = deckStats.filter((item) => item.dueCount > 0);
  const topics = [...new Set(decks.flatMap((deck) => deck.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const practiceCards = deckStats
    .flatMap((item) => item.practiceCards)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 5);
  const filteredDecks = useMemo(
    () =>
      deckStats
        .filter(({ deck, cards, dueCount }) => {
          const query = search.trim().toLocaleLowerCase();
          const matchesSearch =
            !query ||
            [deck.title, deck.description, ...(deck.tags ?? [])]
              .join(" ")
              .toLocaleLowerCase()
              .includes(query);
          const matchesTopic = topicFilter === "all" || (deck.tags ?? []).includes(topicFilter);
          const matchesFormat =
            formatFilter === "all" ||
            cards.some((card) => (card.format ?? "identification") === formatFilter);
          const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "due" && dueCount > 0) ||
            (statusFilter === "learning" && cards.some((card) => card.status === "learning" || card.status === "new")) ||
            (statusFilter === "mastered" && cards.length > 0 && cards.every((card) => card.status === "mastered"));
          return matchesSearch && matchesTopic && matchesFormat && matchesStatus;
        })
        .map(({ deck }) => deck),
    [deckStats, search, topicFilter, formatFilter, statusFilter],
  );
  const firstName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  async function handleDelete(deck: DeckWithId) {
    if (!user || deletingId) return;
    const confirmed = window.confirm(`Delete “${deck.title}”? This will permanently remove its flashcards.`);
    if (!confirmed) return;
    setDeletingId(deck.id);
    setToast("");
    try {
      await deleteDeck(user.uid, deck.id);
      setToast(`“${deck.title}” was deleted.`);
      window.setTimeout(() => setToast(""), 3500);
    } catch (deleteError) {
      console.error("Could not delete the deck.", deleteError);
      setError("That deck couldn’t be deleted. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleSharing(deck: DeckWithId) {
    if (!user || sharingId) return;
    const makePublic = !deck.isPublic;
    if (
      makePublic &&
      !window.confirm(
        `Make “${deck.title}” public? Anyone will be able to find it in Discover and view its questions, answers, and hints.`,
      )
    ) {
      return;
    }
    setSharingId(deck.id);
    setError("");
    setToast("");
    try {
      await setDeckPublic(user.uid, deck.id, makePublic);
      if (!makePublic) {
        setToast(`“${deck.title}” is now private.`);
      } else {
        const shareUrl = `${window.location.origin}/shared/${encodeURIComponent(user.uid)}/${encodeURIComponent(deck.id)}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          setToast(`“${deck.title}” is public. Share link copied.`);
        } catch {
          setToast(`“${deck.title}” is public. Share this link: ${shareUrl}`);
        }
      }
      window.setTimeout(() => setToast(""), 7000);
    } catch (shareError) {
      console.error("Could not change deck sharing.", shareError);
      setError(
        shareError instanceof Error
          ? shareError.message
          : "That sharing setting couldn’t be updated. Please try again.",
      );
    } finally {
      setSharingId(null);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl bg-indigo-950 px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-32 size-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-3 -top-24 size-56 rounded-full border border-white/10" />
          <div className="relative max-w-xl">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-indigo-100">
              <Sparkles size={12} />
              A fresh start, whenever you need one
            </div>
            <h1 className="text-[27px] font-semibold tracking-[-0.05em] sm:text-[34px]">
              Good to see you, {firstName}.
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-indigo-100/75">
              Drop your first lecture slide, photo, or PDF to generate flashcards in seconds.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              <Plus size={16} />
              Create a deck
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Layers3 size={17} />} label="Study sets" value={loading ? "—" : String(decks.length)} />
          <StatCard icon={<BookOpen size={17} />} label="Cards to explore" value={loading ? "—" : String(decks.reduce((sum, deck) => sum + deck.cardCount, 0))} />
          <StatCard icon={<Sparkles size={17} />} label="Cards mastered" value={loading ? "—" : String(decks.reduce((sum, deck) => sum + deck.masteredCount, 0))} />
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400">Current plan</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                {profile ? PLAN_LABELS[profile.plan] : "—"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {profile
                  ? `${profile.deckCount}/${PLAN_LIMITS[profile.plan].decks ?? "∞"} decks · ${profile.generationsUsed}/${PLAN_LIMITS[profile.plan].monthlyGenerations ?? "∞"} generations`
                  : "Usage unavailable"}
              </p>
            </div>
            {isAdmin && (
              <Link href="/admin" className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">
                Manage
              </Link>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Your momentum</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">Progress insights</h2>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><Flame size={18} /></span>
            </div>
            {insightsError ? (
              <p role="status" className="mt-4 text-xs text-rose-600">{insightsError}</p>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <InsightValue icon={<Flame size={14} />} label="Day streak" value={insights ? `${insights.streakDays}` : "—"} />
                  <InsightValue icon={<Target size={14} />} label="7-day accuracy" value={insights ? `${insights.accuracy}%` : "—"} />
                  <InsightValue icon={<CalendarDays size={14} />} label="Reviews · 7 days" value={insights ? String(insights.totalReviews) : "—"} />
                </div>
                <p className="mt-5 text-[10px] font-medium text-slate-400">Daily accuracy · past 7 days</p>
                <div role="img" aria-label={`Daily accuracy over the past seven days: ${(insights?.recentDays ?? []).map((day) => `${day.date}, ${day.reviews ? `${Math.round((day.correct / day.reviews) * 100)} percent across ${day.reviews} reviews` : "no reviews"}`).join("; ")}`} className="mt-2 flex h-24 items-end gap-2">
                  {(insights?.recentDays ?? Array.from({ length: 7 }, (_, index) => ({ date: "", reviews: 0, correct: 0 }))).map((day, index) => {
                    const accuracy = day.reviews ? Math.round((day.correct / day.reviews) * 100) : 3;
                    const label = day.date
                      ? new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
                      : ["6d", "5d", "4d", "3d", "2d", "1d", "Today"][index];
                    return (
                      <div key={`${day.date}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        <div
                          title={day.reviews ? `${accuracy}% accuracy · ${day.reviews} reviews` : "No reviews"}
                          className={`w-full max-w-8 rounded-t-md ${day.reviews ? "bg-indigo-500" : "bg-slate-100"}`}
                          style={{ height: `${accuracy}%` }}
                        />
                        <span className="text-[9px] text-slate-400">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Keep the momentum</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">Due today</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {loading ? "—" : dueDecks.reduce((sum, item) => sum + item.dueCount, 0)} cards
              </span>
            </div>
            {loading ? (
              <p className="mt-4 text-xs text-slate-400">Loading your cards…</p>
            ) : dueDecks.length ? (
              <div className="mt-4 space-y-2">
                {dueDecks.slice(0, 4).map(({ deck, dueCount }) => (
                  <Link key={deck.id} href={`/deck/${encodeURIComponent(deck.id)}?due=1`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 transition hover:border-indigo-200 hover:bg-indigo-50/50">
                    <span className="truncate text-xs font-semibold text-slate-700">{deck.title}</span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500">{dueCount} due →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-emerald-50/70 px-3 py-4 text-xs leading-5 text-emerald-800">You’re all caught up. New cards will appear here when they’re ready for review.</p>
            )}
          </div>
        </section>

        {practiceCards.length > 0 && (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">A little extra practice</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">Cards that need another look</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {practiceCards.map((item) => (
                <Link key={`${item.deckId}-${item.cardId}`} href={`/deck/${encodeURIComponent(item.deckId)}`} className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2.5 transition hover:border-amber-300">
                  <span className="block line-clamp-1 text-xs font-medium text-slate-800">{item.question}</span>
                  <span className="mt-1 block text-[10px] text-slate-500">{item.deckTitle}{item.lapses > 0 ? ` · missed ${item.lapses} ${item.lapses === 1 ? "time" : "times"}` : " · still learning"}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">Your library</p>
              <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.045em] text-slate-900">Your study decks</h2>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <label className="relative flex h-10 min-w-0 flex-1 items-center sm:w-56 sm:flex-none">
                <Search size={15} className="absolute left-3 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search decks"
                  placeholder="Search decks"
                  className="h-full w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                />
              </label>
              <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} aria-label="Filter by topic" className="h-10 min-w-0 max-w-32 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-indigo-300 sm:max-w-40">
                <option value="all">All topics</option>
                {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
              </select>
              <Link href="/create" className="hidden h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 sm:flex">
                <Plus size={15} />
                New deck
              </Link>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-medium text-slate-500">
              Format
              <select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)} aria-label="Filter by card format" className="max-w-36 bg-transparent text-xs font-semibold text-slate-700 outline-none">
                <option value="all">All formats</option>
                <option value="identification">Identification</option>
                <option value="enumeration">Enumeration</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-medium text-slate-500">
              Study status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by study status" className="max-w-36 bg-transparent text-xs font-semibold text-slate-700 outline-none">
                <option value="all">Any status</option>
                <option value="due">Due today</option>
                <option value="learning">Still learning</option>
                <option value="mastered">Mastered</option>
              </select>
            </label>
          </div>

          <AnimatePresence>
            {toast && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="mb-4 break-all rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {toast}
              </motion.p>
            )}
          </AnimatePresence>

          {error ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
          ) : loading ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
            </div>
          ) : filteredDecks.length ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredDecks.map((deck, index) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  index={index}
                  deleting={deletingId === deck.id}
                  sharing={sharingId === deck.id}
                  onDelete={() => handleDelete(deck)}
                  onToggleSharing={() => void handleToggleSharing(deck)}
                />
              ))}
            </div>
          ) : decks.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700">No decks match “{search}”</p>
              <p className="mt-1 text-xs text-slate-400">Try changing your search or filters.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm sm:py-16">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BookOpen size={24} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-800">Your first study set starts here</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Drop your first lecture slide, photo, or PDF to generate flashcards in seconds.
              </p>
              <Link href="/create" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                <Plus size={16} />
                Create Your First Deck
              </Link>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</span>
      <div>
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function InsightValue({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-slate-400">{icon}{label}</span>
      <p className="mt-1 truncate text-base font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function DeckCard({ deck, index, deleting, sharing, onDelete, onToggleSharing }: { deck: DeckWithId; index: number; deleting: boolean; sharing: boolean; onDelete: () => void; onToggleSharing: () => void }) {
  const visual = {
    pdf: { label: "PDF", icon: FileText, tint: "bg-rose-50 text-rose-700" },
    image: { label: "Photo", icon: FileImage, tint: "bg-violet-50 text-violet-700" },
    pptx: { label: "PPTX", icon: FileText, tint: "bg-amber-50 text-amber-700" },
    docx: { label: "DOCX", icon: FileText, tint: "bg-sky-50 text-sky-700" },
    text: { label: "Notes", icon: FileText, tint: "bg-emerald-50 text-emerald-700" },
    anki: { label: "Anki", icon: FileText, tint: "bg-indigo-50 text-indigo-700" },
  }[deck.sourceType as SourceType] ?? { label: "Notes", icon: FileText, tint: "bg-slate-100 text-slate-600" };
  const Icon = visual.icon;
  const progress = deck.cardCount > 0 ? Math.min(100, Math.round((deck.masteredCount / deck.cardCount) * 100)) : 0;

  return (
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.2) }} className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/deck/${deck.id}`} aria-label={`Study ${deck.title}`} className="absolute inset-0 rounded-2xl focus-visible:outline-indigo-500" />
      <div className="relative flex items-start justify-between pointer-events-none">
        <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Layers3 size={19} />
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${visual.tint}`}>
          <Icon size={12} />
          {visual.label}
        </span>
      </div>
      <h3 className="relative mt-5 line-clamp-1 text-[15px] font-semibold text-slate-800 pointer-events-none">{deck.title}</h3>
      <p className="relative mt-1 line-clamp-1 min-h-4 text-xs text-slate-400 pointer-events-none">{deck.description || "Your study notes"}</p>
      {!!deck.tags?.length && (
        <div className="relative mt-3 flex flex-wrap gap-1.5 pointer-events-none">
          {deck.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-medium text-indigo-700">{tag}</span>
          ))}
          {deck.tags.length > 3 && <span className="px-1 py-1 text-[9px] text-slate-400">+{deck.tags.length - 3}</span>}
        </div>
      )}
      <div className="relative mt-5 flex items-center justify-between text-[11px] text-slate-500 pointer-events-none">
        <span>{deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}</span>
        <span>{relativeDate(deck.createdAt)}</span>
      </div>
      <div className="relative mt-3 flex items-center gap-2 pointer-events-none">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-9 text-right text-[10px] font-medium text-slate-400">{progress}%</span>
      </div>
      <div className="relative mt-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-indigo-600 pointer-events-none">Continue studying →</span>
        <div className="relative z-10 flex items-center gap-1">
          <Link
            href={`/deck/${encodeURIComponent(deck.id)}/edit`}
            aria-label={`Edit ${deck.title}`}
            title="Edit deck"
            className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Pencil size={15} />
          </Link>
          <button type="button" onClick={onToggleSharing} disabled={sharing || deleting} aria-label={deck.isPublic ? `Make ${deck.title} private` : `Share ${deck.title}`} title={deck.isPublic ? "Public — click to make private" : "Share deck publicly"} className={`grid size-8 place-items-center rounded-lg transition disabled:opacity-50 ${deck.isPublic ? "text-indigo-600 hover:bg-indigo-50" : "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"}`}>
            {sharing ? <LoaderCircle size={15} className="animate-spin" /> : deck.isPublic ? <Globe2 size={15} /> : <Share2 size={15} />}
          </button>
          <button type="button" onClick={onDelete} disabled={deleting || sharing} aria-label={`Delete ${deck.title}`} title="Delete deck" className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
            {deleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function DashboardPage() {
  return <AuthGate><DashboardContent /></AuthGate>;
}
