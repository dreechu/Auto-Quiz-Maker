"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  Command,
  LayoutDashboard,
  LogOut,
  Plus,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "My decks", href: "/dashboard#decks", icon: BookOpen },
];

export function AppShell({
  children,
  activeLabel,
}: {
  children: ReactNode;
  activeLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, profileError } = useAuth();
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    try {
      await logout();
      router.replace("/login");
    } catch {
      setSignOutError("We couldn’t sign you out. Please try again.");
    }
  }

  const initials = (user?.displayName || user?.email || "S")
    .split(/[ @]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] flex-col border-r border-slate-200/80 bg-white px-5 py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Command size={19} strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.04em]">
            recall<span className="text-indigo-600">.</span>
          </span>
        </Link>

        <Link
          href="/create"
          className="mt-10 flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700"
        >
          <Plus size={17} />
          Create flashcards
        </Link>

        <div className="mt-9">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Workspace
          </p>
          <nav className="space-y-1">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active =
                pathname === href || (href.includes("#") && pathname === "/dashboard" && activeLabel === label);
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  {label}
                  {label === "My decks" && (
                    <ArrowUpRight className="ml-auto opacity-45" size={14} />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
            <span className="mb-2 grid size-8 place-items-center rounded-lg bg-white text-indigo-600 shadow-sm">
              <Sparkles size={16} />
            </span>
            <p className="text-[13px] font-semibold text-slate-800">
              Small sessions add up.
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              A few cards today can make tomorrow’s review a little easier.
            </p>
          </div>
          <button
            type="button"
            className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50"
            onClick={() =>
              window.open("mailto:support@recall.study", "_blank", "noopener,noreferrer")
            }
          >
            <CircleHelp size={15} />
            Help & feedback
          </button>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <Command size={16} />
            </span>
            <span className="font-semibold tracking-tight">
              recall<span className="text-indigo-600">.</span>
            </span>
          </Link>
          <div className="hidden text-[13px] text-slate-400 lg:block">
            Workspace <span className="mx-2 text-slate-300">/</span>
            <span className="font-medium text-slate-600">{activeLabel}</span>
          </div>
          <Link
            href="/create"
            className="ml-auto flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white transition hover:bg-indigo-700 lg:hidden"
          >
            <Plus size={15} />
            Create
          </Link>
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-700">
                {user?.displayName || user?.email?.split("@")[0] || "Student"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Your study space</p>
            </div>
            <div
              className="grid size-9 place-items-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-semibold text-indigo-700"
              aria-label="Your profile"
            >
              {initials}
            </div>
            <button
              type="button"
              title="Sign out"
              onClick={handleSignOut}
              className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10"
        >
          {(profileError || signOutError) && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              {profileError || signOutError}
            </div>
          )}
          {children}
        </motion.main>
      </div>
    </div>
  );
}
