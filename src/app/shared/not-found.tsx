import Link from "next/link";
import { ArrowLeft, BookOpen, SearchX } from "lucide-react";

export default function SharedNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fc] px-4">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <SearchX size={25} />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">404 · Shared deck</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">This shared link isn’t complete.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Open the full share link to view a deck, or browse the community library.</p>
        <Link href="/discover" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700">
          <BookOpen size={14} />
          Browse public decks
        </Link>
        <div>
          <Link href="/dashboard" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800">
            <ArrowLeft size={13} />
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
