"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import {
  auth,
  database,
  loginWithEmail,
  logout,
  registerWithEmail,
  signInWithGoogle,
} from "@/lib/firebase";
import type { UsageProfile } from "@/lib/plans";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  profileError: string | null;
  profile: UsageProfile | null;
  isAdmin: boolean;
  firebaseConfigured: boolean;
  signInWithGoogle: typeof signInWithGoogle;
  loginWithEmail: typeof loginWithEmail;
  registerWithEmail: typeof registerWithEmail;
  logout: typeof logout;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(auth));
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UsageProfile | null>(null);

  useEffect(() => {
    if (!auth) return;

    let profileUnsubscribe: (() => void) | undefined;
    let activeUserUid: string | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      profileUnsubscribe?.();
      profileUnsubscribe = undefined;
      activeUserUid = nextUser?.uid ?? null;
      setUser(nextUser);
      setProfile(null);
      setProfileError(null);
      if (!nextUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const idToken = await nextUser.getIdToken();
        const response = await fetch("/api/profile/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const result = (await response.json()) as {
          profile?: UsageProfile;
          error?: string;
        };
        if (!response.ok || !result.profile) {
          throw new Error(result.error || "Your profile couldn’t be synced.");
        }
        if (activeUserUid !== nextUser.uid) return;
        setProfile(result.profile);
        setLoading(false);

        if (database) {
          profileUnsubscribe = onValue(
            ref(database, `users/${nextUser.uid}/profile`),
            (snapshot) => {
              if (activeUserUid !== nextUser.uid || !snapshot.exists()) return;
              setProfile(snapshot.val() as UsageProfile);
            },
            (error) => {
              console.error("Could not subscribe to the signed-in user's profile.", error);
              setProfileError("Your account details may be out of date. Refresh the page to try again.");
            },
          );
        }
      } catch (error) {
        if (activeUserUid !== nextUser.uid) return;
        console.error("Could not sync the signed-in user's profile.", error);
        setProfileError(
          error instanceof Error
            ? error.message
            : "Your profile couldn’t be synced. Please refresh and try again.",
        );
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      profileUnsubscribe?.();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      profileError,
      profile,
      isAdmin: profile?.role === "admin",
      firebaseConfigured: Boolean(auth),
      signInWithGoogle,
      loginWithEmail,
      registerWithEmail,
      logout,
    }),
    [user, loading, profileError, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return value;
}
