import Link from "next/link";
import { ArrowLeft, Compass, SearchX } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <span className="grid size-16 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <SearchX size={28} />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">404 · Page not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
          We couldn’t find that page.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
          The link may be incorrect, or the page may have moved. Head back to your study space or explore public decks.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700">
            <ArrowLeft size={14} />
            Go to dashboard
          </Link>
          <Link href="/discover" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700">
            <Compass size={14} />
            Discover decks
          </Link>
        </div>
      </main>
    </div>
  );
}
