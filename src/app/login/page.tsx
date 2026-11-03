"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Command,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function friendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    "auth/invalid-email": "That email address doesn’t look quite right.",
    "auth/invalid-credential": "That email and password combination didn’t work. Check your details or create an account.",
    "auth/user-not-found": "We couldn’t find an account with that email.",
    "auth/wrong-password": "That password doesn’t match this account.",
    "auth/email-already-in-use": "An account with that email already exists. Switch to Sign In.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
    "auth/unauthorized-domain": "This domain isn’t enabled for Firebase sign-in yet.",
    "auth/network-request-failed": "We couldn’t connect. Check your internet and try again.",
    "auth/too-many-requests": "Too many attempts. Give it a moment, then try again.",
  };
  if (code && messages[code]) return messages[code];
  if (error instanceof Error && error.message.startsWith("Firebase is not configured")) {
    return error.message;
  }
  return "We couldn’t complete sign-in. Please check your details and try again.";
}

export default function LoginPage() {
  const {
    user,
    loading,
    firebaseConfigured,
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
  } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [loading, user, router]);

  async function handleGoogleSignIn() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (signInError) {
      setError(friendlyAuthError(signInError));
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isSignup) await registerWithEmail(email.trim(), password, displayName);
      else await loginWithEmail(email.trim(), password);
      router.push("/dashboard");
    } catch (signInError) {
      setError(friendlyAuthError(signInError));
      setBusy(false);
    }
  }

  if (loading || user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <LoaderCircle className="animate-spin text-indigo-600" size={22} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Command size={20} />
          </span>
          <span className="text-lg font-semibold tracking-[-0.04em] text-slate-900">
            recall<span className="text-indigo-600">.</span>
          </span>
        </Link>

        <div className="mt-7 text-center">
          <span className="mx-auto grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles size={17} />
          </span>
          <h1 className="mt-3 text-[25px] font-semibold tracking-[-0.05em] text-slate-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {isSignup
              ? "A study space that’s ready when you are."
              : "Sign in to pick up where you left off."}
          </p>
        </div>

        {!firebaseConfigured && (
          <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            Firebase isn’t configured. Add your Firebase web app settings to <code>.env.local</code> to enable sign-in.
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy || !firebaseConfigured}
          className="mt-7 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            or use email
          </span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Account action">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
            className={`h-9 rounded-lg text-xs font-semibold transition ${
              !isSignup ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`h-9 rounded-lg text-xs font-semibold transition ${
              isSignup ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
          {isSignup && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Display name</span>
              <input
                type="text"
                autoComplete="name"
                minLength={1}
                maxLength={80}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should we address you?"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</span>
            <span className="relative block">
              <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password</span>
            <span className="relative block">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 6 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "Your password"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
              />
            </span>
          </label>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !firebaseConfigured}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {isSignup ? "Create account" : "Sign in"}
            {!busy && <ArrowRight size={15} />}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
          Your study materials stay private and are only used to create your cards.
        </p>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-[17px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.75 6c4.53-4.18 7.09-10.34 7.09-17.71Z" transform="translate(0 1)" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.75-6c-2.15 1.45-4.92 2.3-8.15 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
