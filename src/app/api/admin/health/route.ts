import { getAdminDatabase } from "@/lib/firebase-admin";
import {
  ANKI_MAX_ARCHIVE_BYTES,
  ANKI_MAX_ARCHIVE_ENTRIES,
  ANKI_MAX_CARDS,
  ANKI_MAX_DATABASE_BYTES,
  GENERATION_MAX_CARDS_PER_BATCH,
  GENERATION_MAX_TEXT_CHARS,
  GENERATION_REQUEST_BODY_MULTIPLIER,
  MAX_UPLOAD_BYTES,
  NOTES_MAX_DOCUMENT_TEXT_CHARS,
  NOTES_MAX_TEXT_CHUNKS,
  NOTES_TEXT_CHUNK_SIZE,
} from "@/lib/api-limits";
import { PLAN_LIMITS } from "@/lib/plans";
import { verifyRequestUser } from "@/lib/server-auth";

export async function GET(request: Request) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    const database = getAdminDatabase();
    const roleSnapshot = await database.ref(`users/${identity.uid}/profile/role`).get();
    if (roleSnapshot.val() !== "admin") {
      return Response.json({ error: "Administrator access is required." }, { status: 403 });
    }

    return Response.json(
      {
        checkedAt: Date.now(),
        services: {
          api: {
            status: "ok",
            detail: "Admin health endpoint responded successfully.",
          },
          database: {
            status: "ok",
            detail: "Firebase Realtime Database is reachable.",
          },
          gemini: {
            status: process.env.GEMINI_API_KEY ? "configured" : "missing",
            detail: process.env.GEMINI_API_KEY
              ? "API key is configured; this check does not send a billable AI request."
              : "GEMINI_API_KEY is not configured.",
            model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
            fallbackModel: "gemini-3.5-flash-lite",
          },
        },
        generation: {
          monthlyLimits: PLAN_LIMITS,
          adminMonthlyLimit: null,
          uploads: {
            maxFileBytes: MAX_UPLOAD_BYTES,
            maxRequestBodyBytes: Math.floor(MAX_UPLOAD_BYTES * GENERATION_REQUEST_BODY_MULTIPLIER),
            maxTextCharacters: GENERATION_MAX_TEXT_CHARS,
            maxCardsPerModelBatch: GENERATION_MAX_CARDS_PER_BATCH,
            totalRequestedCards: "No explicit request cap; monthly generation quota applies.",
          },
        },
        notes: {
          maxFileBytes: MAX_UPLOAD_BYTES,
          maxExtractedTextCharacters: NOTES_MAX_DOCUMENT_TEXT_CHARS,
          textChunkCharacters: NOTES_TEXT_CHUNK_SIZE,
          maxTextChunks: NOTES_MAX_TEXT_CHUNKS,
          generationQuota: "Uses the account’s monthly generation quota.",
        },
        anki: {
          maxUploadBytes: MAX_UPLOAD_BYTES,
          maxExpandedArchiveBytes: ANKI_MAX_ARCHIVE_BYTES,
          maxDatabaseBytes: ANKI_MAX_DATABASE_BYTES,
          maxArchiveEntries: ANKI_MAX_ARCHIVE_ENTRIES,
          maxCards: ANKI_MAX_CARDS,
        },
        apiRoutes: [
          { method: "POST", path: "/api/generate", purpose: "Generate flashcards with Gemini." },
          { method: "POST", path: "/api/notes", purpose: "Generate or append AI study notes." },
          { method: "POST", path: "/api/import/anki", purpose: "Import an Anki package." },
        ],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not run admin health checks.", error);
    return Response.json(
      { error: "The health checks couldn’t reach Firebase. Check the Firebase Admin configuration and connection." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
