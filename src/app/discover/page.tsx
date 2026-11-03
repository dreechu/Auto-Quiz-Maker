"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Compass,
  FileImage,
  FileText,
  LoaderCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import type { PublicDeckSummary, SourceType } from "@/lib/flashcards";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function loadPublicDecks() {
      try {
        const response = await fetch("/api/public-decks", { cache: "no-store" });
        const result = (await response.json()) as {
          decks?: PublicDeckSummary[];
          error?: string;
        };
        if (!response.ok || !result.decks) {
          throw new Error(result.error || "Public decks couldn’t be loaded.");
        }
        if (active) setDecks(result.decks);
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
    void loadPublicDecks();
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
            Explore flashcards shared by other learners and find a head start on your next topic.
          </p>
        </section>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Public study decks</h2>
            <p className="mt-1 text-xs text-slate-500">{decks.length} shared {decks.length === 1 ? "deck" : "decks"}</p>
          </div>
          <label className="relative flex h-10 w-full items-center sm:w-72">
            <Search size={15} className="absolute left-3 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search public decks"
              placeholder="Search title, topic, or creator"
              className="h-full w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</p>
        ) : loading ? (
          <div className="mt-7 flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin text-indigo-600" />
            Finding shared study decks
          </div>
        ) : filteredDecks.length ? (
          <div className="mt-6 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Compass size={21} /></span>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">
              {decks.length ? "No decks match your search" : "No public decks just yet"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {decks.length ? "Try a different title, topic, or creator." : "Check back soon, or publish one of your decks from your dashboard."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DiscoverPage() {
  return <DiscoverContent />;
}
