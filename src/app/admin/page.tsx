"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Crown,
  LoaderCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
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

type AdminUser = UsageProfile;
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
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busyUid, setBusyUid] = useState("");
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

  useEffect(() => {
    if (!loading && user && profile && !isAdmin) router.replace("/dashboard");
  }, [loading, user, profile, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, loadUsers]);

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
              Accounts & plans
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review account activity and manage access and subscription plans.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loadingUsers}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingUsers ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>
        </div>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={<Users size={17} />} label="Total accounts" value={summary?.totalUsers} />
          <SummaryCard icon={<Crown size={17} />} label="Pro & unlimited" value={summary ? summary.proUsers + summary.unlimitedUsers : undefined} />
          <SummaryCard icon={<Activity size={17} />} label="Generations this month" value={summary?.generationsThisMonth} />
          <SummaryCard icon={<Shield size={17} />} label="Administrators" value={summary?.admins} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                onChange={(event) => setSearch(event.target.value)}
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
              {filteredUsers.map((account) => (
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
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">Plan limits</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div key={plan} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold text-slate-800">{PLAN_LABELS[plan]}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {PLAN_LIMITS[plan].decks === null
                    ? "Unlimited decks and generations"
                    : `${PLAN_LIMITS[plan].decks} decks · ${PLAN_LIMITS[plan].monthlyGenerations} generations per month`}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-5 text-slate-400">
            Generations reset at the start of each UTC calendar month. Billing checkout is not connected; administrators assign plans here.
          </p>
        </section>
      </main>
    </div>
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
