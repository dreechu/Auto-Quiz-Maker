"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, FileText, Lightbulb, LoaderCircle, Sparkles, Tag } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import type { StudyNote } from "@/lib/notes";

const SECTIONS_PER_PAGE = 3;
type PublicNoteView = "overview" | "takeaways" | "terms" | "details";

function PublicNoteContent() {
  const { ownerUid, noteId } = useParams<{ ownerUid: string; noteId: string }>();
  const [note, setNote] = useState<StudyNote | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<PublicNoteView>("overview");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadNote() {
      try {
        const response = await fetch(
          `/api/public-notes/${encodeURIComponent(ownerUid)}/${encodeURIComponent(noteId)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as {
          note?: StudyNote;
          ownerName?: string;
          error?: string;
        };
        if (!response.ok || !result.note) {
          if (response.status === 404) {
            if (active) setUnavailable(true);
            return;
          }
          throw new Error(result.error || "This public note couldn’t be loaded.");
        }
        if (active) {
          setNote(result.note);
          setOwnerName(result.ownerName || "Recall learner");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "This public note couldn’t be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadNote();
    return () => { active = false; };
  }, [ownerUid, noteId]);

  const totalPages = note ? Math.max(1, Math.ceil(note.sections.length / SECTIONS_PER_PAGE)) : 1;
  const sectionStart = page * SECTIONS_PER_PAGE;
  const visibleSections = note?.sections.slice(sectionStart, sectionStart + SECTIONS_PER_PAGE) ?? [];
  const views: { id: PublicNoteView; label: string; count?: number }[] = note ? [
    { id: "overview", label: "Overview" },
    ...(note.keyTakeaways.length ? [{ id: "takeaways" as const, label: "Key takeaways", count: note.keyTakeaways.length }] : []),
    ...(note.keyTerms.length ? [{ id: "terms" as const, label: "Important terms", count: note.keyTerms.length }] : []),
    ...(note.sections.length ? [{ id: "details" as const, label: "Detailed notes", count: note.sections.length }] : []),
  ] : [];

  function pagination() {
    if (!note || totalPages <= 1) return null;
    return (
      <nav aria-label="Public note pages" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <ArrowLeft size={14} /> Previous
        </button>
        <span aria-live="polite" className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
        <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40">
          Next <ArrowRight size={14} />
        </button>
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <Link href="/discover" className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Discover
        </Link>
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin text-indigo-600" /> Loading public notes
          </div>
        ) : unavailable ? (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">This note is private or unavailable.</h1>
            <p className="mt-2 text-sm text-slate-500">The owner may have changed its sharing settings or removed it.</p>
            <Link href="/discover" className="mt-5 inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700">Browse public materials</Link>
          </section>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</p>
        ) : note ? (
          <>
            <header className="mb-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm sm:p-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 shadow-sm">
                <FileText size={12} /> Public study notes
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{note.title}</h1>
              <p className="mt-2 text-xs text-slate-500">Shared by {ownerName}</p>
            </header>

            <div role="group" aria-label="Choose what to view in these notes" className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {views.map((view) => (
                <button key={view.id} type="button" aria-pressed={activeView === view.id} onClick={() => setActiveView(view.id)} className={"inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition " + (activeView === view.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}>
                  {view.label}
                  {view.count !== undefined && <span className={"rounded-full px-1.5 py-0.5 text-[10px] " + (activeView === view.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{view.count}</span>}
                </button>
              ))}
            </div>

            {activeView === "overview" && (
              <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700"><Sparkles size={16} /></span>
                  <h2 className="text-sm font-semibold text-slate-800">Overview</h2>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{note.summary || "No overview available."}</p>
              </section>
            )}

            {activeView === "takeaways" && (
              <section>
                <div className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700"><Lightbulb size={16} /></span><h2 className="text-sm font-semibold text-slate-800">Key takeaways</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {note.keyTakeaways.map((item, index) => <article key={`${index}-${item.slice(0, 20)}`} className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-amber-700">{index + 1}</span><p className="text-sm leading-6 text-slate-700">{item}</p></article>)}
                </div>
              </section>
            )}

            {activeView === "terms" && (
              <section>
                <div className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-violet-100 text-violet-700"><Tag size={15} /></span><h2 className="text-sm font-semibold text-slate-800">Important terms</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {note.keyTerms.map((item) => <article key={item.term} className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm"><h3 className="text-sm font-semibold text-violet-800">{item.term}</h3><p className="mt-1.5 text-sm leading-6 text-slate-600">{item.definition}</p></article>)}
                </div>
              </section>
            )}

            {activeView === "details" && (
              <section>
                <div className="mb-3 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700"><BookOpenText size={16} /></span><h2 className="text-sm font-semibold text-slate-800">Detailed notes</h2><span className="text-xs text-slate-400">{note.sections.length} sections</span></div>
                {pagination()}
                <div className="my-3 space-y-3">
                  {visibleSections.map((section, index) => (
                    <article key={`${sectionStart + index}-${section.heading}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="mb-3 flex items-start gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">{String(sectionStart + index + 1).padStart(2, "0")}</span>
                        <h3 className="pt-1 text-base font-semibold leading-6 text-slate-800">{section.heading}</h3>
                      </div>
                      <p className="whitespace-pre-wrap pl-10 text-sm leading-7 text-slate-600">{section.content}</p>
                      {section.examples?.length ? (
                        <aside className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                          <h4 className="flex items-center gap-2 text-xs font-semibold text-amber-800"><Lightbulb size={14} />Examples</h4>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                            {section.examples.map((example, exampleIndex) => (
                              <li key={`${exampleIndex}-${example.slice(0, 24)}`} className="flex gap-2">
                                <span className="text-amber-500" aria-hidden="true">•</span>
                                <span>{example}</span>
                              </li>
                            ))}
                          </ul>
                        </aside>
                      ) : null}
                    </article>
                  ))}
                </div>
                {pagination()}
              </section>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function PublicNotePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-64 max-w-5xl items-center justify-center gap-3 px-4 text-sm text-slate-500">
          <LoaderCircle size={18} className="animate-spin text-indigo-600" />
          Loading public notes
        </main>
      </div>
    }>
      <PublicNoteContent />
    </Suspense>
  );
}
