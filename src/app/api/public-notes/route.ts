import { getAdminDatabase } from "@/lib/firebase-admin";
import type { PublicNoteSummary } from "@/lib/notes";

export async function GET() {
  try {
    const snapshot = await getAdminDatabase()
      .ref("publicNotes")
      .orderByChild("updatedAt")
      .get();
    const notes = Object.values(
      (snapshot.val() as Record<string, PublicNoteSummary> | null) ?? {},
    ).sort((a, b) => b.updatedAt - a.updatedAt);
    return Response.json({ notes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load public notes.", error);
    return Response.json(
      { error: "Public notes couldn’t be loaded. Please try again." },
      { status: 500 },
    );
  }
}
