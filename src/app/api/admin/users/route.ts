import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import {
  currentMonthStart,
  normalizeSubscriptionPlan,
  isUserRole,
  type UsageProfile,
} from "@/lib/plans";

export async function GET(request: Request) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    const database = getAdminDatabase();
    const requester = await database.ref(`users/${identity.uid}/profile/role`).get();
    if (requester.val() !== "admin") {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const usersSnapshot = await database.ref("users").get();
    const users = Object.entries(
      (usersSnapshot.val() as Record<string, { profile?: UsageProfile }> | null) ?? {},
    )
      .filter((entry): entry is [string, { profile: UsageProfile }] => Boolean(entry[1]?.profile))
      .map(([uid, value]) => ({
        ...value.profile,
        uid,
        role: isUserRole(value.profile.role) ? value.profile.role : "user",
        plan: normalizeSubscriptionPlan(value.profile.plan) ?? "free",
        deckCount: Number(value.profile.deckCount || 0),
        generationsUsed:
          value.profile.generationResetAt === currentMonthStart()
            ? Number(value.profile.generationsUsed || 0)
            : 0,
      }))
      .sort((a, b) => a.createdAt - b.createdAt);

    return Response.json({
      users,
      summary: {
        totalUsers: users.length,
        admins: users.filter((user) => user.role === "admin").length,
        proUsers: users.filter((user) => user.plan === "pro").length,
        unlimitedUsers: users.filter((user) => user.plan === "unlimited").length,
        decks: users.reduce((sum, user) => sum + (user.deckCount || 0), 0),
        generationsThisMonth: users.reduce(
          (sum, user) => sum + (user.generationsUsed || 0),
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Could not load the admin user list.", error);
    return Response.json(
      { error: "The admin dashboard couldn’t load users. Check Firebase Admin configuration." },
      { status: 500 },
    );
  }
}
