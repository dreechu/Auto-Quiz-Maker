"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Command, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function friendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    "auth/invalid-email": "That email address doesn’t look quite right.",
    "auth/user-not-found": "We couldn’t find an account with that email.",
    "auth/wrong-password": "That password doesn’t match this account.",
    "auth/invalid-credential": "That email and password combination didn’t work.",
    "auth/email-already-in-use": "An account with that email already exists. Try signing in.",
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
  return "We couldn’t sign you in. Please check your details and try again.";
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const { user, loading, firebaseConfigured, signInWithGoogle, loginWithEmail, registerWithEmail } =
    useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (signInError) {
      setError(friendlyAuthError(signInError));
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isSignup) await registerWithEmail(email.trim(), password, displayName);
      else await loginWithEmail(email.trim(), password);
      router.replace("/dashboard");
    } catch (signInError) {
      setError(friendlyAuthError(signInError));
      setBusy(false);
    }
  }

  if (loading || user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f8fc]">
        <LoaderCircle className="animate-spin text-indigo-600" size={22} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-white">
      <section className="relative hidden w-[48%] flex-col overflow-hidden bg-[#22234a] px-12 py-10 text-white lg:flex xl:px-16">
        <div className="absolute -right-32 -top-32 size-[520px] rounded-full border border-white/10" />
        <div className="absolute -right-12 -top-12 size-[280px] rounded-full border border-white/10" />
        <Link href="/" className="relative flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white text-indigo-700">
            <Command size={19} />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.04em]">
            recall<span className="text-indigo-300">.</span>
          </span>
        </Link>
        <div className="relative my-auto max-w-[470px] pb-10">
          <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium tracking-wide text-indigo-100">
            A calmer way to remember
          </div>
          <h1 className="text-[42px] font-semibold leading-[1.14] tracking-[-0.05em] xl:text-[52px]">
            Make the most of what you’re learning.
          </h1>
          <p className="mt-5 max-w-[390px] text-sm leading-7 text-indigo-100/70">
            Turn your notes into a study habit that feels a little more like you.
          </p>
          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["A", "J", "M", "S"].map((letter, index) => (
                <span
                  key={letter}
                  className="grid size-8 place-items-center rounded-full border-2 border-[#22234a] text-[10px] font-semibold text-white"
                  style={{ backgroundColor: ["#6e75d4", "#b487cf", "#4b9f9b", "#d18c6f"][index] }}
                >
                  {letter}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-indigo-100/70">
              A little progress, every day.
            </p>
          </div>
        </div>
        <p className="relative text-[10px] text-indigo-100/40">
          Your study space, just the way you left it.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[390px]">
          <Link href="/" className="mb-10 flex items-center justify-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <Command size={16} />
            </span>
            <span className="font-semibold tracking-tight">recall.</span>
          </Link>
          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
              {isSignup ? "Your next chapter" : "Welcome back"}
            </p>
            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-slate-900">
              {isSignup ? "Create your account" : "Sign in to Recall"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isSignup
                ? "A study space that’s ready when you are."
                : "Pick up right where your learning left off."}
            </p>
          </div>

          {!firebaseConfigured && (
            <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800">
              Firebase isn’t configured. Add your Firebase web app settings to <code>.env.local</code> to enable sign-in.
            </div>
          )}

          <button
            type="button"
            disabled={busy || !firebaseConfigured}
            onClick={handleGoogle}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">
              or with email
            </span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Display name</span>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  minLength={1}
                  maxLength={80}
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
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={isSignup ? 6 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                />
              </span>
            </label>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !firebaseConfigured}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[13px] font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {isSignup ? "Create account" : "Sign in"}
              {!busy && <ArrowRight size={15} />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            {isSignup ? "Already have an account?" : "New to Recall?"}{" "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="mt-8 text-center text-[10px] leading-5 text-slate-400">
            By continuing, you agree to keep your study materials private and use Recall for learning.
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-[17px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.75 6c4.53-4.18 7.09-10.34 7.09-17.71Z" transform="translate(0 1)" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.75-6c-2.15 1.45-4.92 2.3-8.15 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
