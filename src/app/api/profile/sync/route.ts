import { ensureUserProfile, verifyRequestUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const identity = await verifyRequestUser(request);
    if (!identity) {
      return Response.json({ error: "Please sign in again." }, { status: 401 });
    }

    const profile = await ensureUserProfile(identity);
    return Response.json({ profile });
  } catch (error) {
    console.error("Could not sync the authenticated user's profile.", error);
    return Response.json(
      { error: "Your profile couldn’t be synced. Check your Firebase Admin settings and try again." },
      { status: 500 },
    );
  }
}
