import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDatabase } from "@/lib/firebase-admin";
import {
  currentMonthStart,
  normalizeSubscriptionPlan,
  isUserRole,
  PLAN_LIMITS,
  type UsageProfile,
} from "@/lib/plans";

export async function verifyRequestUser(request: Request): Promise<DecodedIdToken | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const idToken = authorization.slice(7).trim();
  if (!idToken) return null;

  const adminAuth = getAdminAuth();
  try {
    return await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return null;
  }
}

export async function getServerProfile(uid: string): Promise<UsageProfile | null> {
  const snapshot = await getAdminDatabase().ref(`users/${uid}/profile`).get();
  return snapshot.exists() ? (snapshot.val() as UsageProfile) : null;
}

export async function ensureUserProfile(identity: DecodedIdToken) {
  const database = getAdminDatabase();
  const profileRef = database.ref(`users/${identity.uid}/profile`);
  const decksSnapshot = await database.ref(`decks/${identity.uid}`).get();
  const existingDeckCount = Object.keys(
    (decksSnapshot.val() as Record<string, unknown> | null) ?? {},
  ).length;
  const now = Date.now();
  const monthStart = currentMonthStart(now);
  const result = await profileRef.transaction((current) => {
    const existing = (current ?? {}) as Record<string, unknown>;
    const existingResetAt =
      typeof existing.generationResetAt === "number"
        ? existing.generationResetAt
        : monthStart;
    return {
      ...existing,
      uid: identity.uid,
      email: identity.email ?? (typeof existing.email === "string" ? existing.email : ""),
      displayName:
        typeof existing.displayName === "string" &&
        existing.displayName.trim()
          ? existing.displayName
          : identity.name ?? "",
      photoURL:
        identity.picture ??
        (typeof existing.photoURL === "string" ? existing.photoURL : ""),
      role: isBootstrapAdmin(identity.email, identity.uid)
        ? "admin"
        : existing.role === "admin"
          ? "admin"
          : "user",
      plan: normalizeSubscriptionPlan(existing.plan) ?? "free",
      deckCount:
        typeof existing.deckCount === "number"
          ? existing.deckCount
          : existingDeckCount,
      generationsUsed:
        existingResetAt === monthStart &&
        typeof existing.generationsUsed === "number"
          ? existing.generationsUsed
          : 0,
      generationResetAt: monthStart,
      createdAt:
        typeof existing.createdAt === "number" ? existing.createdAt : now,
      updatedAt: now,
    };
  });
  if (!result.committed || !result.snapshot.exists()) {
    throw new Error("The authenticated user's profile could not be initialized.");
  }
  return result.snapshot.val() as UsageProfile;
}

export async function isServerAdmin(uid: string) {
  const profile = await getServerProfile(uid);
  return profile?.role === "admin";
}

export async function reserveGeneration(identity: DecodedIdToken) {
  const uid = identity.uid;
  const database = getAdminDatabase();
  const decksSnapshot = await database.ref(`decks/${uid}`).get();
  const deckCount = Object.keys(
    (decksSnapshot.val() as Record<string, unknown> | null) ?? {},
  ).length;
  const profileRef = database.ref(`users/${uid}/profile`);
  const now = Date.now();
  const monthStart = currentMonthStart(now);
  const result = await profileRef.transaction((storedProfile) => {
    const profile = (storedProfile ?? {
      uid,
      email: identity.email ?? "",
      displayName: identity.name ?? "",
      photoURL: identity.picture ?? "",
      role: isBootstrapAdmin(identity.email, uid) ? "admin" : "user",
      plan: "free",
      deckCount,
      generationsUsed: 0,
      generationResetAt: monthStart,
      createdAt: now,
      updatedAt: now,
    }) as Record<string, unknown>;
    const plan = normalizeSubscriptionPlan(profile.plan) ?? "free";
    const resetAt =
      typeof profile.generationResetAt === "number"
        ? profile.generationResetAt
        : monthStart;
    const used =
      resetAt === monthStart && typeof profile.generationsUsed === "number"
        ? profile.generationsUsed
        : 0;
    const role = isBootstrapAdmin(identity.email, uid)
      ? "admin"
      : isUserRole(profile.role)
        ? profile.role
        : "user";
    const limit =
      role === "admin" ? null : PLAN_LIMITS[plan].monthlyGenerations;
    if (limit !== null && used >= limit) return;
    return {
      ...profile,
      uid,
      email: identity.email ?? profile.email ?? "",
      displayName: profile.displayName || identity.name || "",
      photoURL: identity.picture ?? profile.photoURL ?? "",
      role,
      plan,
      deckCount:
        typeof profile.deckCount === "number" ? profile.deckCount : deckCount,
      generationsUsed: used + 1,
      generationResetAt: monthStart,
      createdAt:
        typeof profile.createdAt === "number" ? profile.createdAt : now,
      updatedAt: now,
    };
  });

  if (result.committed) {
    return { allowed: true as const, period: monthStart };
  }
  const profile = result.snapshot.val() as UsageProfile | null;
  if (!profile) {
    return { allowed: false as const, reason: "missing-profile" as const };
  }
  const plan = normalizeSubscriptionPlan(profile.plan) ?? "free";
  const used =
    profile.generationResetAt === monthStart
      ? Number(profile.generationsUsed || 0)
      : 0;
  const limit =
    profile.role === "admin" ? null : PLAN_LIMITS[plan].monthlyGenerations;
  if (limit !== null && used >= limit) {
    return {
      allowed: false as const,
      reason: "limit" as const,
      plan,
      used,
      limit,
      resetAt: Date.UTC(
        new Date(monthStart).getUTCFullYear(),
        new Date(monthStart).getUTCMonth() + 1,
        1,
      ),
    };
  }
  throw new Error("Generation usage could not be reserved.");
}

export async function releaseGeneration(uid: string, period: number) {
  const profileRef = getAdminDatabase().ref(`users/${uid}/profile`);
  await profileRef.transaction((profile) => {
    if (!profile || profile.generationResetAt !== period) return profile;
    profile.generationsUsed = Math.max(0, Number(profile.generationsUsed || 0) - 1);
    profile.updatedAt = Date.now();
    return profile;
  });
}

export function isBootstrapAdmin(email: string | undefined, uid: string) {
  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowedUids = (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    (email ? allowedEmails.includes(email.toLowerCase()) : false) ||
    allowedUids.includes(uid)
  );
}

export function errorResponse(error: unknown) {
  console.error("Authenticated server operation failed.", error);
  return Response.json(
    { error: "We couldn’t complete that request. Please try again." },
    { status: 500 },
  );
}
