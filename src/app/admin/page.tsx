"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Crown,
  Database,
  Eye,
  FileText,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
  type UsageProfile,
  type UserRole,
} from "@/lib/plans";
import { sourceLabel, type SourceType } from "@/lib/flashcards";
import type { StudyNote } from "@/lib/notes";

type AdminUser = UsageProfile;
type AdminNote = StudyNote & {
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
};
type AdminTab = "users" | "decks" | "notes" | "health";
const PAGE_SIZE = 10;
type AdminHealth = {
  checkedAt: number;
  services: {
    api: { status: "ok"; detail: string };
    database: { status: "ok"; detail: string };
    gemini: { status: "configured" | "missing"; detail: string; model: string; fallbackModel: string };
  };
  generation: {
    monthlyLimits: Record<SubscriptionPlan, { decks: number | null; monthlyGenerations: number | null }>;
    adminMonthlyLimit: number | null;
    uploads: {
      maxFileBytes: number;
      maxRequestBodyBytes: number;
      maxTextCharacters: number;
      maxCardsPerModelBatch: number;
      totalRequestedCards: string;
    };
  };
  notes: {
    maxFileBytes: number;
    maxExtractedTextCharacters: number;
    textChunkCharacters: number;
    maxTextChunks: number;
    generationQuota: string;
  };
  anki: {
    maxUploadBytes: number;
    maxExpandedArchiveBytes: number;
    maxDatabaseBytes: number;
    maxArchiveEntries: number;
    maxCards: number;
  };
  apiRoutes: { method: string; path: string; purpose: string }[];
};
type AdminDeck = {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  title: string;
  description: string;
  sourceType: SourceType | null;
  cardCount: number;
  createdAt: number;
  isPublic: boolean;
};
type AdminDeckDetails = {
  title?: string;
  cards?: Record<
    string,
    { question?: string; answer?: string; hint?: string; difficulty?: string }
  >;
};
type AdminSummary = {
  totalUsers: number;
  admins: number;
  proUsers: number;
  unlimitedUsers: number;
  decks: number;
  generationsThisMonth: number;
};

function AdminPageContent() {
  const { user, loading, isAdmin, profile, profileError } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [search, setSearch] = useState("");
  const [deckSearch, setDeckSearch] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [userPage, setUserPage] = useState(0);
  const [deckPage, setDeckPage] = useState(0);
  const [notePage, setNotePage] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [busyUid, setBusyUid] = useState("");
  const [busyContentKey, setBusyContentKey] = useState("");
  const [deckError, setDeckError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [selectedDeck, setSelectedDeck] = useState<AdminDeckDetails | null>(null);
  const [loadingDeckId, setLoadingDeckId] = useState("");
  const [expandedNoteKey, setExpandedNoteKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoadingUsers(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json()) as {
        users?: AdminUser[];
        summary?: AdminSummary;
        error?: string;
      };
      if (!response.ok || !result.users || !result.summary) {
        throw new Error(result.error || "The user list couldn’t be loaded.");
      }
      setUsers(result.users);
      setSummary(result.summary);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The admin dashboard couldn’t be loaded.",
      );
    } finally {
      setLoadingUsers(false);
    }
  }, [user, isAdmin]);

  const loadDecks = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoadingDecks(true);
    setDeckError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/decks", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json()) as {
        decks?: AdminDeck[];
        error?: string;
      };
      if (!response.ok || !result.decks) {
        throw new Error(result.error || "The deck list couldn’t be loaded.");
      }
      setDecks(result.decks);
    } catch (loadError) {
      setDeckError(
        loadError instanceof Error
          ? loadError.message
          : "The admin dashboard couldn’t load decks.",
      );
    } finally {
      setLoadingDecks(false);
    }
  }, [user, isAdmin]);

  const loadNotes = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoadingNotes(true);
    setNoteError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/notes", {
        headers: { Authorization: ["Bearer", token].join(" ") },
        cache: "no-store",
      });
      const result = (await response.json()) as { notes?: AdminNote[]; error?: string };
      if (!response.ok || !result.notes) {
        throw new Error(result.error || "The note list couldn’t be loaded.");
      }
      setNotes(result.notes);
    } catch (loadError) {
      setNoteError(loadError instanceof Error ? loadError.message : "The admin dashboard couldn’t load notes.");
    } finally {
      setLoadingNotes(false);
    }
  }, [user, isAdmin]);

  const loadHealth = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoadingHealth(true);
    setHealthError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/health", {
        headers: { Authorization: ["Bearer", token].join(" ") },
        cache: "no-store",
      });
      const result = (await response.json()) as AdminHealth & { error?: string };
      if (!response.ok || !result.services || !result.generation || !result.apiRoutes) {
        throw new Error(result.error || "The system health report couldn’t be loaded.");
      }
      setHealth(result);
    } catch (loadError) {
      setHealthError(loadError instanceof Error ? loadError.message : "The system health report couldn’t be loaded.");
    } finally {
      setLoadingHealth(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!loading && user && profile && !isAdmin) router.replace("/dashboard");
  }, [loading, user, profile, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => {
      void loadUsers();
      void loadDecks();
      void loadNotes();
      void loadHealth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, loadUsers, loadDecks, loadNotes, loadHealth]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) =>
      [item.displayName, item.email, item.uid, item.plan, item.role]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [users, search]);

  const filteredDecks = useMemo(() => {
    const query = deckSearch.trim().toLowerCase();
    if (!query) return decks;
    return decks.filter((deck) =>
      [
        deck.title,
        deck.description,
        deck.ownerName,
        deck.ownerEmail,
        deck.ownerUid,
        deck.id,
        deck.sourceType ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [decks, deckSearch]);

  const filteredNotes = useMemo(() => {
    const query = noteSearch.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      [note.title, note.summary, note.sourceName, note.ownerName, note.ownerEmail, note.ownerUid]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [notes, noteSearch]);

  const visibleUsers = filteredUsers.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);
  const visibleDecks = filteredDecks.slice(deckPage * PAGE_SIZE, (deckPage + 1) * PAGE_SIZE);
  const visibleNotes = filteredNotes.slice(notePage * PAGE_SIZE, (notePage + 1) * PAGE_SIZE);

  async function toggleDeckDetails(deck: AdminDeck) {
    if (!user || loadingDeckId) return;
    const deckKey = `${deck.ownerUid}/${deck.id}`;
    if (selectedDeckId === deckKey && selectedDeck) {
      setSelectedDeckId("");
      setSelectedDeck(null);
      return;
    }
    setSelectedDeckId(deckKey);
    setSelectedDeck(null);
    setLoadingDeckId(deckKey);
    setDeckError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/decks/${encodeURIComponent(deck.ownerUid)}/${encodeURIComponent(deck.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const result = (await response.json()) as {
        deck?: AdminDeckDetails;
        error?: string;
      };
      if (!response.ok || !result.deck) {
        throw new Error(result.error || "That deck couldn’t be loaded.");
      }
      setSelectedDeck(result.deck);
    } catch (loadError) {
      setDeckError(
        loadError instanceof Error
          ? loadError.message
          : "That deck couldn’t be loaded. Please try again.",
      );
      setSelectedDeckId("");
    } finally {
      setLoadingDeckId("");
    }
  }

  async function deleteDeck(deck: AdminDeck) {
    const deckKey = `${deck.ownerUid}/${deck.id}`;
    if (!user || busyContentKey || !window.confirm(
      `Delete "${deck.title}" from ${deck.ownerName}? This permanently removes the deck and its public listing.`,
    )) return;
    setBusyContentKey(deckKey);
    setDeckError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/decks/${encodeURIComponent(deck.ownerUid)}/${encodeURIComponent(deck.id)}`,
        { method: "DELETE", headers: { Authorization: ["Bearer", token].join(" ") } },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "That deck couldn’t be deleted.");
      const remainingDecks = decks.filter((item) => item.ownerUid !== deck.ownerUid || item.id !== deck.id);
      setDecks(remainingDecks);
      const deckQuery = deckSearch.trim().toLowerCase();
      const matchingDeckCount = remainingDecks.filter((item) =>
        !deckQuery || [item.title, item.description, item.ownerName, item.ownerEmail, item.ownerUid, item.id, item.sourceType ?? ""]
          .join(" ").toLowerCase().includes(deckQuery),
      ).length;
      setDeckPage((page) => Math.min(page, Math.max(0, Math.ceil(matchingDeckCount / PAGE_SIZE) - 1)));
      if (selectedDeckId === deckKey) {
        setSelectedDeckId("");
        setSelectedDeck(null);
      }
      setNotice(`Deleted “${deck.title}”.`);
      await loadUsers();
    } catch (deleteError) {
      setDeckError(deleteError instanceof Error ? deleteError.message : "That deck couldn’t be deleted.");
    } finally {
      setBusyContentKey("");
    }
  }

  async function deleteNote(note: AdminNote) {
    const noteKey = `${note.ownerUid}/${note.id}`;
    if (!user || busyContentKey || !window.confirm(
      `Delete "${note.title}" owned by ${note.ownerName}? This cannot be undone.`,
    )) return;
    setBusyContentKey(noteKey);
    setNoteError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/notes/${encodeURIComponent(note.ownerUid)}/${encodeURIComponent(note.id)}`,
        { method: "DELETE", headers: { Authorization: ["Bearer", token].join(" ") } },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "That note couldn’t be deleted.");
      const remainingNotes = notes.filter((item) => item.ownerUid !== note.ownerUid || item.id !== note.id);
      setNotes(remainingNotes);
      const noteQuery = noteSearch.trim().toLowerCase();
      const matchingNoteCount = remainingNotes.filter((item) =>
        !noteQuery || [item.title, item.summary, item.sourceName, item.ownerName, item.ownerEmail, item.ownerUid]
          .join(" ").toLowerCase().includes(noteQuery),
      ).length;
      setNotePage((page) => Math.min(page, Math.max(0, Math.ceil(matchingNoteCount / PAGE_SIZE) - 1)));
      setNotice(`Deleted “${note.title}”.`);
    } catch (deleteError) {
      setNoteError(deleteError instanceof Error ? deleteError.message : "That note couldn’t be deleted.");
    } finally {
      setBusyContentKey("");
    }
  }

  async function updateUser(
    target: AdminUser,
    changes: { role?: UserRole; plan?: SubscriptionPlan },
  ) {
    if (!user || busyUid) return;
    setBusyUid(target.uid);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(target.uid)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      });
      const result = (await response.json()) as {
        profile?: AdminUser;
        error?: string;
      };
      if (!response.ok || !result.profile) {
        throw new Error(result.error || "That account couldn’t be updated.");
      }
      setUsers((current) =>
        current.map((item) => (item.uid === target.uid ? result.profile! : item)),
      );
      setNotice(`${target.displayName || target.email || "Account"} updated.`);
      await loadUsers();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "That account couldn’t be updated. Please try again.",
      );
    } finally {
      setBusyUid("");
    }
  }

  if (loading || !user || !profile || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto mt-12 max-w-3xl px-4">
          {profileError ? (
            <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
              {profileError}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle size={17} className="animate-spin text-indigo-600" />
              Checking administrator access
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
              <ShieldCheck size={12} />
              Administrator tools
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">
              Admin dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review accounts, manage plans, inspect content, and moderate saved material.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadUsers();
              void loadDecks();
              void loadNotes();
              void loadHealth();
            }}
            disabled={loadingUsers || loadingDecks || loadingNotes || loadingHealth}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingUsers || loadingDecks || loadingNotes || loadingHealth ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>
        </div>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard icon={<Users size={17} />} label="Total accounts" value={summary?.totalUsers} />
          <SummaryCard icon={<BookOpen size={17} />} label="Total decks" value={summary?.decks} />
          <SummaryCard icon={<Crown size={17} />} label="Pro & unlimited" value={summary ? summary.proUsers + summary.unlimitedUsers : undefined} />
          <SummaryCard icon={<FileText size={17} />} label="Saved notes" value={loadingNotes ? undefined : notes.length} />
          <SummaryCard icon={<Activity size={17} />} label="Generations this month" value={summary?.generationsThisMonth} />
          <SummaryCard icon={<Shield size={17} />} label="Administrators" value={summary?.admins} />
        </section>

        <nav aria-label="Admin dashboard sections" className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {([
            ["users", "Users", <Users key="users-icon" size={15} />, users.length],
            ["decks", "Decks", <BookOpen key="decks-icon" size={15} />, decks.length],
            ["notes", "Notes", <FileText key="notes-icon" size={15} />, notes.length],
            ["health", "Health", <Activity key="health-icon" size={15} />, undefined],
          ] as const).map(([tab, label, icon, count]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? "page" : undefined}
              className={"inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition " + (
                activeTab === tab ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              {icon}
              {label}
              {count !== undefined && <span className={"rounded-full px-1.5 py-0.5 text-[10px] " + (
                activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>{count}</span>}
              {tab === "health" && health && (
                <span className={"size-2 rounded-full " + (
                  health.services.gemini.status === "configured" ? "bg-emerald-300" : "bg-amber-300"
                )} aria-label={`Gemini key ${health.services.gemini.status}`} />
              )}
            </button>
          ))}
        </nav>

        {activeTab === "users" && <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">User accounts</h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Plan limits are enforced on the server for every generation and new deck.
              </p>
            </div>
            <label className="relative flex h-9 w-full items-center sm:w-64">
              <Search size={15} className="absolute left-3 text-slate-400" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setUserPage(0); }}
                placeholder="Search name, email or ID"
                aria-label="Search users"
                className="h-full w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
          </div>

          {(error || notice) && (
            <p
              role={error ? "alert" : "status"}
              className={`mx-5 mt-4 rounded-xl px-4 py-3 text-xs leading-5 sm:mx-6 ${
                error
                  ? "border border-rose-100 bg-rose-50 text-rose-700"
                  : "border border-emerald-100 bg-emerald-50 text-emerald-700"
              }`}
            >
              {error || notice}
            </p>
          )}

          {loadingUsers ? (
            <div className="flex items-center justify-center gap-3 px-5 py-16 text-xs text-slate-400">
              <LoaderCircle size={16} className="animate-spin text-indigo-600" />
              Loading accounts
            </div>
          ) : filteredUsers.length ? (
            <div className="divide-y divide-slate-100">
              {visibleUsers.map((account) => (
                <UserRow
                  key={account.uid}
                  account={account}
                  isCurrentUser={account.uid === user.uid}
                  busy={busyUid === account.uid}
                  disabled={Boolean(busyUid)}
                  onRoleChange={(role) => void updateUser(account, { role })}
                  onPlanChange={(plan) => void updateUser(account, { plan })}
                />
              ))}
            </div>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              No accounts match that search.
            </div>
          )}
          {!loadingUsers && <PaginationControls page={userPage} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setUserPage} label="users" />}
        </section>}

        {activeTab === "decks" && <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">All decks</h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Browse decks from every account and inspect their flashcards.
              </p>
            </div>
            <label className="relative flex h-9 w-full items-center sm:w-64">
              <Search size={15} className="absolute left-3 text-slate-400" />
              <input
                value={deckSearch}
                onChange={(event) => { setDeckSearch(event.target.value); setDeckPage(0); }}
                placeholder="Search title, owner or ID"
                aria-label="Search all decks"
                className="h-full w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
          </div>

          {deckError && (
            <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700 sm:mx-6">
              {deckError}
            </p>
          )}
          {notice && <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700 sm:mx-6">{notice}</p>}

          {loadingDecks ? (
            <div className="flex items-center justify-center gap-3 px-5 py-16 text-xs text-slate-400">
              <LoaderCircle size={16} className="animate-spin text-indigo-600" />
              Loading decks
            </div>
          ) : filteredDecks.length ? (
            <div className="divide-y divide-slate-100">
              {visibleDecks.map((deck) => {
                const deckKey = `${deck.ownerUid}/${deck.id}`;
                return (
                <article key={deckKey}>
                  <div className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(160px,.8fr)_minmax(110px,.55fr)_auto] lg:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <BookOpen size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{deck.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {deck.description || "No description"}
                        </p>
                        <p className="mt-1 truncate font-mono text-[9px] text-slate-300">{deck.id}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-slate-700">{deck.ownerName}</p>
                      <p className="truncate text-[10px] text-slate-400">{deck.ownerEmail || deck.ownerUid}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{deck.sourceType ? sourceLabel(deck.sourceType) : "Unknown format"}</span>
                      {deck.isPublic && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Public</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void toggleDeckDetails(deck)}
                        disabled={Boolean(loadingDeckId) || Boolean(busyContentKey)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
                      >
                        {loadingDeckId === deckKey ? <LoaderCircle size={13} className="animate-spin" /> : <Eye size={13} />}
                        {selectedDeckId === deckKey ? "Hide cards" : "View cards"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDeck(deck)}
                        disabled={Boolean(busyContentKey)}
                        aria-label={`Delete ${deck.title}`}
                        title="Delete deck"
                        className="grid size-8 place-items-center rounded-lg border border-rose-100 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {busyContentKey === deckKey ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                  {selectedDeckId === deckKey && selectedDeck && (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                      {Object.values(selectedDeck.cards ?? {}).length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {Object.values(selectedDeck.cards ?? {}).map((card, index) => (
                            <article key={`${deck.id}-card-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-indigo-600">Card {index + 1}</p>
                              <p className="mt-2 whitespace-pre-wrap text-xs font-medium leading-5 text-slate-800">{card.question || "No question"}</p>
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{card.answer || "No answer"}</p>
                              {card.hint && <p className="mt-2 text-[10px] text-slate-400">Hint: {card.hint}</p>}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="py-4 text-center text-xs text-slate-500">This deck has no flashcards.</p>
                      )}
                    </div>
                  )}
                </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              {decks.length ? "No decks match that search." : "No decks have been created yet."}
            </div>
          )}
          {!loadingDecks && <PaginationControls page={deckPage} totalItems={filteredDecks.length} pageSize={PAGE_SIZE} onPageChange={setDeckPage} label="decks" />}
        </section>}

        {activeTab === "notes" && <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">All saved notes</h2>
              <p className="mt-1 text-[11px] text-slate-400">Review note titles, owners, sources, and summaries. Deleting a note is permanent.</p>
            </div>
            <label className="relative flex h-9 w-full items-center sm:w-64">
              <Search size={15} className="absolute left-3 text-slate-400" />
              <input
                value={noteSearch}
                onChange={(event) => { setNoteSearch(event.target.value); setNotePage(0); }}
                placeholder="Search title, owner or ID"
                aria-label="Search all notes"
                className="h-full w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
          </div>
          {noteError && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700 sm:mx-6">{noteError}</p>}
          {notice && <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700 sm:mx-6">{notice}</p>}
          {loadingNotes ? (
            <div className="flex items-center justify-center gap-3 px-5 py-16 text-xs text-slate-400">
              <LoaderCircle size={16} className="animate-spin text-indigo-600" />
              Loading notes
            </div>
          ) : visibleNotes.length ? (
            <div className="divide-y divide-slate-100">
              {visibleNotes.map((note) => {
                const noteKey = `${note.ownerUid}/${note.id}`;
                return (
                  <article key={noteKey} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-semibold text-slate-800">{note.title || "Untitled note"}</h3>
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-indigo-600">{note.sourceType}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {note.ownerName} {note.ownerEmail ? `· ${note.ownerEmail}` : ""} · {note.sections?.length ?? 0} sections · {note.keyTerms?.length ?? 0} terms
                        </p>
                        <p className="mt-2 line-clamp-2 max-w-3xl text-[11px] leading-5 text-slate-500">{note.summary || note.sourceName}</p>
                        <p className="mt-1 break-all font-mono text-[9px] text-slate-300">{note.id}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedNoteKey((current) => current === noteKey ? "" : noteKey)}
                          aria-expanded={expandedNoteKey === noteKey}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                        >
                          <Eye size={13} />
                          {expandedNoteKey === noteKey ? "Hide preview" : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteNote(note)}
                          disabled={Boolean(busyContentKey)}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-100 px-2.5 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          {busyContentKey === noteKey ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Delete
                        </button>
                      </div>
                    </div>
                    {expandedNoteKey === noteKey && (
                      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Overview</p>
                          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{note.summary || "No overview available."}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Sections</p>
                          <div className="mt-2 space-y-3">
                            {(note.sections ?? []).slice(0, 3).map((section, index) => (
                              <div key={`${index}-${section.heading}`}>
                                <p className="text-[11px] font-semibold text-slate-700">{section.heading}</p>
                                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[10px] leading-5 text-slate-500">{section.content}</p>
                              </div>
                            ))}
                            {(note.sections?.length ?? 0) > 3 && (
                              <p className="text-[10px] text-slate-400">Showing the first 3 of {note.sections.length} sections.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              {notes.length ? "No notes match that search." : "No notes have been created yet."}
            </div>
          )}
          {!loadingNotes && <PaginationControls page={notePage} totalItems={filteredNotes.length} pageSize={PAGE_SIZE} onPageChange={setNotePage} label="notes" />}
        </section>}

        {activeTab === "health" && (
          <section className="mt-5 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">System health & API limits</h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Configuration and server-enforced limits. Gemini is checked for key configuration only, not live inference availability.
                </p>
              </div>
              {health && <p className="text-[10px] text-slate-400">Last checked {new Date(health.checkedAt).toLocaleString()}</p>}
            </div>

            {healthError && (
              <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                {healthError}
              </p>
            )}

            {loadingHealth && !health ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-16 text-xs text-slate-400">
                <LoaderCircle size={16} className="animate-spin text-indigo-600" />
                Checking API and service configuration
              </div>
            ) : health ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <HealthStatusCard
                    icon={<Activity size={17} />}
                    label="Admin API"
                    status="Healthy"
                    detail={health.services.api.detail}
                    healthy
                  />
                  <HealthStatusCard
                    icon={<Database size={17} />}
                    label="Firebase Realtime Database"
                    status="Reachable"
                    detail={health.services.database.detail}
                    healthy
                  />
                  <HealthStatusCard
                    icon={<Sparkles size={17} />}
                    label="Gemini"
                    status={health.services.gemini.status === "configured" ? "Key configured" : "Key missing"}
                    detail={health.services.gemini.detail}
                    healthy={health.services.gemini.status === "configured"}
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <LimitCard title="Flashcard generation" icon={<Gauge size={16} />}>
                    <LimitRow label="Max upload" value={formatBytes(health.generation.uploads.maxFileBytes)} />
                    <LimitRow label="Max request body" value={formatBytes(health.generation.uploads.maxRequestBodyBytes)} />
                    <LimitRow label="Text input" value={`${health.generation.uploads.maxTextCharacters.toLocaleString()} characters`} />
                    <LimitRow label="Cards per model batch" value={health.generation.uploads.maxCardsPerModelBatch.toLocaleString()} />
                    <LimitRow label="Total cards per request" value={health.generation.uploads.totalRequestedCards} />
                    <LimitRow label="Admin monthly quota" value="Unlimited" />
                  </LimitCard>
                  <LimitCard title="AI study notes" icon={<FileText size={16} />}>
                    <LimitRow label="Max upload" value={formatBytes(health.notes.maxFileBytes)} />
                    <LimitRow label="Extracted text cap" value={`${health.notes.maxExtractedTextCharacters.toLocaleString()} characters`} />
                    <LimitRow label="Text chunk size" value={`${health.notes.textChunkCharacters.toLocaleString()} characters`} />
                    <LimitRow label="Max chunks" value={health.notes.maxTextChunks.toLocaleString()} />
                    <LimitRow label="Quota" value={health.notes.generationQuota} />
                  </LimitCard>
                  <LimitCard title="Anki import" icon={<BookOpen size={16} />}>
                    <LimitRow label="Max upload" value={formatBytes(health.anki.maxUploadBytes)} />
                    <LimitRow label="Expanded archive" value={formatBytes(health.anki.maxExpandedArchiveBytes)} />
                    <LimitRow label="Database file" value={formatBytes(health.anki.maxDatabaseBytes)} />
                    <LimitRow label="Archive entries" value={health.anki.maxArchiveEntries.toLocaleString()} />
                    <LimitRow label="Cards per import" value={health.anki.maxCards.toLocaleString()} />
                  </LimitCard>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="text-sm font-semibold text-slate-800">Generation quotas by plan</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div key={plan} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold text-slate-800">{PLAN_LABELS[plan]}</p>
                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          {health.generation.monthlyLimits[plan].decks === null
                            ? "Unlimited decks and generations"
                            : `${health.generation.monthlyLimits[plan].decks} decks · ${health.generation.monthlyLimits[plan].monthlyGenerations} generations per month`}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[10px] leading-5 text-slate-400">
                    Generations reset at the start of each UTC calendar month. Billing checkout is not connected; administrators assign plans here.
                  </p>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                    <h3 className="text-sm font-semibold text-slate-800">Generation endpoints</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Registered API handlers and their purpose. These entries are not individual uptime probes.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {health.apiRoutes.map((route) => (
                      <div key={`${route.method}-${route.path}`} className="grid gap-1 px-5 py-3 sm:grid-cols-[100px_220px_1fr] sm:items-center sm:px-6">
                        <span className="w-fit rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">{route.method}</span>
                        <code className="text-[11px] font-semibold text-slate-700">{route.path}</code>
                        <p className="text-[10px] text-slate-500">{route.purpose}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

function formatBytes(bytes: number) {
  const mebibytes = bytes / (1024 * 1024);
  return Number.isInteger(mebibytes) ? `${mebibytes} MiB` : `${mebibytes.toFixed(1)} MiB`;
}

function HealthStatusCard({
  icon,
  label,
  status,
  detail,
  healthy,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  detail: string;
  healthy: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          {icon}
          <h3 className="text-xs font-semibold text-slate-800">{label}</h3>
        </div>
        <span className={"rounded-full px-2.5 py-1 text-[9px] font-bold " + (
          healthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        )}>{status}</span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function LimitCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800">
        <span className="text-indigo-600">{icon}</span>
        {title}
      </h3>
      <div className="mt-4 divide-y divide-slate-100">{children}</div>
    </article>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-right text-[10px] font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function PaginationControls({
  page,
  totalItems,
  pageSize,
  onPageChange,
  label,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;
  const firstItem = page * pageSize + 1;
  const lastItem = Math.min((page + 1) * pageSize, totalItems);
  return (
    <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-6">
      <span className="text-[10px] text-slate-400">
        Showing {firstItem}–{lastItem} of {totalItems} {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={13} />
          Previous
        </button>
        <span aria-live="polite" className="min-w-16 text-center text-[10px] text-slate-500">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={13} />
        </button>
      </div>
    </nav>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
}) {
  return (
    <article className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-medium text-slate-400">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-800">{value ?? "—"}</p>
      </div>
    </article>
  );
}

function UserRow({
  account,
  isCurrentUser,
  busy,
  disabled,
  onRoleChange,
  onPlanChange,
}: {
  account: AdminUser;
  isCurrentUser: boolean;
  busy: boolean;
  disabled: boolean;
  onRoleChange: (role: UserRole) => void;
  onPlanChange: (plan: SubscriptionPlan) => void;
}) {
  const roleColor =
    account.role === "admin"
      ? "bg-violet-50 text-violet-700"
      : "bg-slate-100 text-slate-600";
  const usageLimit = PLAN_LIMITS[account.plan].monthlyGenerations;
  const usagePercent =
    usageLimit === null
      ? 0
      : Math.min(100, Math.round((account.generationsUsed / usageLimit) * 100));

  return (
    <article className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(220px,1.3fr)_minmax(160px,.8fr)_minmax(180px,1fr)_minmax(160px,.9fr)] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {account.photoURL ? (
          <span
            role="img"
            aria-label={`${account.displayName || "User"} profile photo`}
            className="size-10 shrink-0 rounded-full border border-slate-200 bg-cover bg-center"
            style={{ backgroundImage: `url("${account.photoURL}")` }}
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
            {(account.displayName || account.email || "U").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800">
            {account.displayName || "Unnamed account"}
            {isCurrentUser && <span className="ml-1.5 text-[9px] font-medium text-slate-400">You</span>}
          </p>
          <p className="truncate text-[10px] text-slate-400">{account.email}</p>
          <p className="mt-0.5 truncate font-mono text-[9px] text-slate-300">{account.uid}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${roleColor}`}>
          {account.role}
        </span>
        <button
          type="button"
          onClick={() => onRoleChange(account.role === "admin" ? "user" : "admin")}
          disabled={disabled || isCurrentUser}
          title={isCurrentUser ? "Your own admin role can’t be changed here" : undefined}
          className="h-8 rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <LoaderCircle size={13} className="animate-spin" /> : account.role === "admin" ? "Remove admin" : "Make admin"}
        </button>
      </div>

      <div>
        <label className="sr-only" htmlFor={`plan-${account.uid}`}>Subscription plan for {account.email}</label>
        <select
          id={`plan-${account.uid}`}
          value={account.plan}
          disabled={disabled}
          onChange={(event) => onPlanChange(event.target.value as SubscriptionPlan)}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 disabled:opacity-50"
        >
          {SUBSCRIPTION_PLANS.map((plan) => (
            <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{account.deckCount} {account.deckCount === 1 ? "deck" : "decks"}</span>
          <span>{account.generationsUsed}/{usageLimit ?? "∞"} generations</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${usagePercent}%` }} />
        </div>
        {busy && <p className="mt-1 text-[9px] text-indigo-600">Saving account changes…</p>}
      </div>
    </article>
  );
}

export default function AdminPage() {
  return <AuthGate><AdminPageContent /></AuthGate>;
}
