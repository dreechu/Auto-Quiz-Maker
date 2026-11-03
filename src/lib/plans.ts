export const USER_ROLES = ["user", "admin"] as const;
export const SUBSCRIPTION_PLANS = ["free", "pro", "unlimited"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export type UsageProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  plan: SubscriptionPlan;
  deckCount: number;
  generationsUsed: number;
  generationResetAt: number;
  createdAt: number;
  updatedAt: number;
};

export const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { decks: number | null; monthlyGenerations: number | null }
> = {
  free: { decks: 3, monthlyGenerations: 10 },
  pro: { decks: 20, monthlyGenerations: 50 },
  unlimited: { decks: null, monthlyGenerations: null },
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Free",
  pro: "Pro",
  unlimited: "Unlimited",
};

export function currentMonthStart(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return (
    typeof value === "string" &&
    SUBSCRIPTION_PLANS.includes(value as SubscriptionPlan)
  );
}

export function normalizeSubscriptionPlan(
  value: unknown,
): SubscriptionPlan | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isSubscriptionPlan(normalized) ? normalized : null;
}

export function isWithinLimit(
  current: number,
  limit: number | null,
): boolean {
  return limit === null || current < limit;
}
