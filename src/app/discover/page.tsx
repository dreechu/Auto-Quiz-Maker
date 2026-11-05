"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Compass,
  FileImage,
  FileText,
  LoaderCircle,
  NotebookPen,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import type { PublicDeckSummary, SourceType } from "@/lib/flashcards";
import type { PublicNoteSummary } from "@/lib/notes";

type DiscoverTab = "all" | "decks" | "notes";

function sourceStyle(sourceType: SourceType) {
  return {
    pdf: { label: "PDF", icon: FileText, color: "bg-rose-50 text-rose-700" },
    image: { label: "Photo", icon: FileImage, color: "bg-violet-50 text-violet-700" },
    pptx: { label: "Slides", icon: FileText, color: "bg-amber-50 text-amber-700" },
    docx: { label: "Document", icon: FileText, color: "bg-sky-50 text-sky-700" },
    text: { label: "Notes", icon: FileText, color: "bg-emerald-50 text-emerald-700" },
    anki: { label: "Anki", icon: FileText, color: "bg-indigo-50 text-indigo-700" },
  }[sourceType];
}

function DiscoverContent() {
  const [decks, setDecks] = useState<PublicDeckSummary[]>([]);
  const [notes, setNotes] = useState<PublicNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DiscoverTab>("all");

  useEffect(() => {
    let active = true;
    async function loadPublicMaterials() {
      try {
        const [deckResponse, noteResponse] = await Promise.all([
          fetch("/api/public-decks", { cache: "no-store" }),
          fetch("/api/public-notes", { cache: "no-store" }),
        ]);
        const [deckResult, noteResult] = await Promise.all([
          deckResponse.json() as Promise<{ decks?: PublicDeckSummary[]; error?: string }>,
          noteResponse.json() as Promise<{ notes?: PublicNoteSummary[]; error?: string }>,
        ]);
        if (!deckResponse.ok || !deckResult.decks) {
          throw new Error(deckResult.error || "Public decks couldn’t be loaded.");
        }
        if (!noteResponse.ok || !noteResult.notes) {
          throw new Error(noteResult.error || "Public notes couldn’t be loaded.");
        }
        if (active) {
          setDecks(deckResult.decks);
          setNotes(noteResult.notes);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Public decks couldn’t be loaded. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPublicMaterials();
    return () => {
      active = false;
    };
  }, []);

  const filteredDecks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return decks;
    return decks.filter((deck) =>
      [deck.title, deck.description, deck.ownerName]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [decks, search]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      [note.title, note.summary, note.ownerName, note.sourceType]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [notes, search]);

  const displayedCount =
    activeTab === "decks" ? filteredDecks.length :
      activeTab === "notes" ? filteredNotes.length :
        filteredDecks.length + filteredNotes.length;
  const currentTabHasMaterials =
    activeTab === "decks" ? decks.length > 0 :
      activeTab === "notes" ? notes.length > 0 :
        decks.length + notes.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl bg-indigo-950 px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-32 size-80 rounded-full border border-white/10" />
          <span className="relative inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-indigo-100">
            <Compass size={13} />
            The community library
          </span>
          <h1 className="relative mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            Discover something new.
          </h1>
          <p className="relative mt-2 max-w-xl text-sm leading-6 text-indigo-100/75">
            Explore notes and flashcards shared by other learners and find a head start on your next topic.
          </p>
        </section>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Public study materials</h2>
            <p className="mt-1 text-xs text-slate-500">{displayedCount} shared {displayedCount === 1 ? "item" : "items"}</p>
          </div>
          <label className="relative flex h-10 w-full items-center sm:w-72">
            <Search size={15} className="absolute left-3 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search public study materials"
              placeholder="Search title, topic, or creator"
              className="h-full w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
            />
          </label>
        </div>

        <div role="group" aria-label="Filter public study materials" className="mt-4 flex flex-wrap gap-2">
          {([
            ["all", "All materials"],
            ["decks", "Flashcard decks"],
            ["notes", "Study notes"],
          ] as const).map(([tab, label]) => (
            <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)} className={"inline-flex h-9 items-center rounded-full px-3.5 text-xs font-semibold transition " + (activeTab === tab ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</p>
        ) : loading ? (
          <div className="mt-7 flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin text-indigo-600" />
            Finding shared study materials
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {(activeTab !== "notes" && filteredDecks.length > 0) && <>
              {activeTab === "all" && <h3 className="text-sm font-semibold text-slate-700">Flashcard decks</h3>}
              <div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredDecks.map((deck) => {
              const style = sourceStyle(deck.sourceType);
              const Icon = style.icon;
              return (
                <article key={`${deck.ownerUid}-${deck.id}`} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                      <BookOpen size={19} />
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${style.color}`}>
                      <Icon size={12} />
                      {style.label}
                    </span>
                  </div>
                  <h3 className="mt-5 min-h-12 line-clamp-2 text-base font-semibold leading-6 text-slate-800">{deck.title}</h3>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
                    {deck.description || "A community flashcard deck"}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><Users size={13} />{deck.ownerName}</span>
                    <span>{deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}</span>
                  </div>
                  <Link
                    href={`/shared/${encodeURIComponent(deck.ownerUid)}/${encodeURIComponent(deck.id)}`}
                    className="mt-5 inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <Sparkles size={14} />
                    View flashcards
                  </Link>
                </article>
              );
            })}
              </div>
            </>}
            {(activeTab !== "decks" && filteredNotes.length > 0) && <>
              {activeTab === "all" && <h3 className="text-sm font-semibold text-slate-700">Study notes</h3>}
              <div className="grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <article key={`${note.ownerUid}-${note.id}`} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><NotebookPen size={19} /></span>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-violet-700">Study notes</span>
                    </div>
                    <h3 className="mt-5 min-h-12 line-clamp-2 text-base font-semibold leading-6 text-slate-800">{note.title}</h3>
                    <p className="mt-2 line-clamp-3 min-h-14 text-xs leading-5 text-slate-500">{note.summary || "A community study note"}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[11px] text-slate-500">
                      <span className="inline-flex min-w-0 items-center gap-1.5 truncate"><Users size={13} className="shrink-0" />{note.ownerName}</span>
                      <span className="shrink-0">{note.sectionCount} {note.sectionCount === 1 ? "section" : "sections"}</span>
                    </div>
                    <Link href={`/public-notes/${encodeURIComponent(note.ownerUid)}/${encodeURIComponent(note.id)}`} className="mt-5 inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white transition hover:bg-violet-700">
                      <Sparkles size={14} />Read study notes
                    </Link>
                  </article>
                ))}
              </div>
            </>}
            {displayedCount === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Compass size={21} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">
              {currentTabHasMaterials ? "No materials match your search" : activeTab === "notes" ? "No public notes just yet" : activeTab === "decks" ? "No public decks just yet" : "No public materials just yet"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {currentTabHasMaterials ? "Try a different title, topic, or creator." : "Check back soon, or publish a deck or note from your library."}
            </p>
          </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DiscoverPage() {
  return <DiscoverContent />;
}
