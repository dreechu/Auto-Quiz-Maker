"use client";

import Link from "next/link";
import { Code2, Compass, Command, NotebookPen, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

export function Navbar() {
  const { user, profile, isAdmin } = useAuth();
  const displayName = profile?.displayName || user?.displayName || user?.email || "Student";
  const photoURL = profile?.photoURL || user?.photoURL;
  const initials = displayName
    .split(/[ @]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Command size={18} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.04em] text-slate-900">
            recall<span className="text-indigo-600">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <ThemeToggle />
          {FEATURE_FLAGS.programmingPractice && (
            <Link
              href="/programming"
              aria-label="Practice programming"
              title="Practice programming"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700 sm:px-2.5"
            >
              <Code2 size={15} />
              <span className="hidden sm:inline">Programming</span>
            </Link>
          )}
          <Link
            href="/notes"
            aria-label="Create AI study notes"
            title="Create AI study notes"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700 sm:px-2.5"
          >
            <NotebookPen size={15} />
            <span className="hidden sm:inline">Notes</span>
          </Link>
          <Link
            href="/discover"
            aria-label="Discover public decks"
            title="Discover public decks"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700 sm:px-2.5"
          >
            <Compass size={15} />
            <span className="hidden sm:inline">Discover</span>
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              aria-label="Admin dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Shield size={15} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link
            href="/profile"
            aria-label="Your profile and plan"
            title="Your profile and plan"
            className="hidden items-center gap-2 rounded-xl p-1.5 transition hover:bg-indigo-50 sm:flex"
          >
            {photoURL ? (
              <span
                role="img"
                aria-label={`${displayName} profile photo`}
                className="size-9 rounded-full border border-slate-200 bg-cover bg-center"
                style={{ backgroundImage: `url("${photoURL}")` }}
              />
            ) : (
              <span className="grid size-9 place-items-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-semibold text-indigo-700">
                {initials}
              </span>
            )}
            <span className="max-w-[160px] truncate text-xs font-medium text-slate-600">
              {displayName}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
