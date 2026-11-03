"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Crown,
  LoaderCircle,
  LogOut,
  Save,
  UserRound,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/plans";

function formatDate(timestamp: number | undefined) {
  if (!timestamp || !Number.isFinite(timestamp)) return "Not available";
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ProfileContent() {
  const { user, profile, profileError, logout } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    const name = (nameEdited ? displayName : profile?.displayName ?? "").trim();
    if (!name || name.length > 80) {
      setError("Your display name must be between 1 and 80 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName: name }),
      });
      const result = (await response.json()) as {
        profile?: { displayName?: string };
        error?: string;
      };
      if (!response.ok || !result.profile) {
        throw new Error(result.error || "Your profile couldn’t be updated.");
      }
      setDisplayName(result.profile.displayName ?? name);
      setNameEdited(true);
      setNotice("Your display name has been saved.");
    } catch (saveError) {
      console.error("Could not save your profile.", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile couldn’t be updated. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    if (signingOut || !window.confirm("Are you sure you want to sign out?")) {
      return;
    }
    setSigningOut(true);
    setError("");
    try {
      await logout();
      router.replace("/login");
    } catch (signOutError) {
      console.error("Could not sign out.", signOutError);
      setError("We couldn’t sign you out. Please try again.");
      setSigningOut(false);
    }
  }

  const plan = profile ? PLAN_LIMITS[profile.plan] : null;
  const generationLimit = plan?.monthlyGenerations;
  const deckLimit = plan?.decks;
  const generationPercent =
    generationLimit === null || generationLimit === undefined
      ? 0
      : Math.min(100, (profile!.generationsUsed / generationLimit) * 100);
  const deckPercent =
    deckLimit === null || deckLimit === undefined
      ? 0
      : Math.min(100, (profile!.deckCount / deckLimit) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-600">
            Account settings
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            Your profile
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Update how your account appears and check your current plan usage.
          </p>
        </div>

        {profileError && (
          <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {profileError}
          </p>
        )}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <UserRound size={19} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
              <p className="mt-0.5 text-xs text-slate-500">Your account name and email address.</p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Display name</span>
              <input
                type="text"
                autoComplete="name"
                required
                minLength={1}
                maxLength={80}
                value={nameEdited ? displayName : profile?.displayName ?? ""}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setNameEdited(true);
                  setError("");
                  setNotice("");
                }}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</span>
              <p className="flex h-11 items-center rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm text-slate-500">
                {profile?.email || user?.email || "—"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Account ID</span>
              <p className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 font-mono text-xs text-slate-500">
                {profile?.uid || user?.uid || "—"}
              </p>
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700 sm:col-span-2">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 sm:col-span-2">
                <Check size={15} />
                {notice}
              </p>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving || !profile}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                Save changes
              </button>
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Crown size={19} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Plan and usage</h2>
                <p className="mt-0.5 text-xs text-slate-500">Your current limits and account activity.</p>
              </div>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              {profile ? PLAN_LABELS[profile.plan] : "Loading plan"}
            </span>
          </div>

          {profile ? (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <UsageMeter
                  label="Decks"
                  used={profile.deckCount}
                  limit={deckLimit}
                  percent={deckPercent}
                />
                <UsageMeter
                  label="Generations this month"
                  used={profile.generationsUsed}
                  limit={generationLimit}
                  percent={generationPercent}
                />
              </div>
              <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-slate-400">Account type</p>
                  <p className="mt-1 font-medium capitalize text-slate-700">{profile.role}</p>
                </div>
                <div>
                  <p className="text-slate-400">Member since</p>
                  <p className="mt-1 font-medium text-slate-700">{formatDate(profile.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Generation limit resets</p>
                  <p className="mt-1 font-medium text-slate-700">{formatDate(profile.generationResetAt ? nextMonthStart(profile.generationResetAt) : undefined)}</p>
                </div>
              </div>
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                Plan changes are managed by an administrator. Contact your administrator if you need a plan upgrade.
              </p>
            </>
          ) : (
            <div className="mt-7 flex items-center justify-center gap-2 py-5 text-sm text-slate-400">
              <LoaderCircle size={16} className="animate-spin" />
              Loading plan details
            </div>
          )}
        </section>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Sign out</h2>
            <p className="mt-1 text-xs text-slate-500">
              Sign out of Recall on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <LogOut size={15} />
            )}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </section>
      </main>
    </div>
  );
}

function nextMonthStart(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

function UsageMeter({
  label,
  used,
  limit,
  percent,
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
  percent: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="text-slate-500">
          {used} / {limit === null || limit === undefined ? "Unlimited" : limit}
        </span>
      </div>
      {limit !== null && limit !== undefined && (
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={`${label} usage`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
        >
          <div
            className={`h-full rounded-full transition-all ${percent >= 90 ? "bg-amber-500" : "bg-indigo-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGate>
      <ProfileContent />
    </AuthGate>
  );
}
