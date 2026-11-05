import { GoogleGenAI } from "@google/genai";
import {
  GENERATION_MAX_CARDS_PER_BATCH,
  GENERATION_MAX_TEXT_CHARS,
  GENERATION_REQUEST_BODY_MULTIPLIER,
  MAX_UPLOAD_BYTES,
} from "@/lib/api-limits";
import type {
  CardFormat,
  Difficulty,
  Flashcard,
  GenerationFormat,
  SourceType,
} from "@/lib/flashcards";
import {
  ensureUserProfile,
  releaseGeneration,
  reserveGeneration,
  verifyRequestUser,
} from "@/lib/server-auth";

const allowedTypes: Record<string, SourceType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "text",
  "text/markdown": "text",
};

function validateCards(value: unknown, generationFormat: GenerationFormat): Flashcard[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > GENERATION_MAX_CARDS_PER_BATCH
  ) {
    throw new Error("The generated card list was empty or too large.");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Flashcard ${index + 1} was not valid.`);
    }
    const card = item as Record<string, unknown>;
    if (
      typeof card.question !== "string" ||
      typeof card.answer !== "string" ||
      typeof card.hint !== "string" ||
      !["easy", "medium", "hard"].includes(String(card.difficulty)) ||
      !["identification", "enumeration"].includes(String(card.format))
    ) {
      throw new Error(`Flashcard ${index + 1} was not valid.`);
    }
    const format = card.format as CardFormat;
    if (
      generationFormat !== "mixed" &&
      format !== generationFormat
    ) {
      throw new Error(`Flashcard ${index + 1} did not match the requested format.`);
    }
    return {
      question: card.question.trim(),
      answer: card.answer.trim(),
      hint: card.hint.trim(),
      difficulty: card.difficulty as Difficulty,
      status: "new",
      format,
    };
  });
}

function getGeminiStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const errObj = error as Record<string, unknown>;
  if (typeof errObj.status === "number") return errObj.status;
  if (typeof errObj.statusCode === "number") return errObj.statusCode;
  return undefined;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES * GENERATION_REQUEST_BODY_MULTIPLIER) {
    return Response.json({ error: "Please choose a file smaller than 200 MB." }, { status: 413 });
  }

  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in to generate flashcards." }, { status: 401 });
  }

  let reservationPeriod: number | null = null;
  try {
    const body = (await request.json()) as {
      fileName?: unknown;
      mimeType?: unknown;
      sourceType?: unknown;
      data?: unknown;
      text?: unknown;
      count?: unknown;
      style?: unknown;
      difficulty?: unknown;
      format?: unknown;
    };
    const generationFormat =
      body.format === undefined ? "mixed" : body.format;
    if (
      typeof body.fileName !== "string" ||
      typeof body.mimeType !== "string" ||
      typeof body.sourceType !== "string" ||
      typeof body.count !== "number" ||
      !Number.isSafeInteger(body.count) ||
      body.count < 1 ||
      !["standard", "definitions", "exam"].includes(String(body.style)) ||
      !["easy", "medium", "hard"].includes(String(body.difficulty)) ||
      !["identification", "enumeration", "mixed"].includes(String(generationFormat))
    ) {
      return Response.json(
        { error: "Some generation settings are invalid. Please check them and try again." },
        { status: 400 },
      );
    }

    const sourceType = body.sourceType as SourceType;
    if (!["image", "pdf", "docx", "pptx", "text"].includes(sourceType)) {
      return Response.json({ error: "This file type is not supported." }, { status: 415 });
    }
    if (
      sourceType !== "text" &&
      allowedTypes[body.mimeType] !== sourceType
    ) {
      return Response.json({ error: "The uploaded file type doesn’t match its contents." }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "Flashcard generation is not configured yet." }, { status: 503 });
    }

    const data =
      typeof body.data === "string"
        ? body.data.replace(/^data:[^,]*;base64,/, "")
        : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if ((sourceType === "image" || sourceType === "pdf") && !data) {
      return Response.json({ error: "The uploaded file could not be read." }, { status: 400 });
    }
    if (data.length > Math.ceil((MAX_UPLOAD_BYTES * 4) / 3)) {
      return Response.json({ error: "Please choose a file smaller than 200 MB." }, { status: 413 });
    }
    if (data && Buffer.from(data, "base64").length > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Please choose a file smaller than 200 MB." }, { status: 413 });
    }
    if (!text && sourceType !== "image" && sourceType !== "pdf") {
      return Response.json({ error: "No readable text was found in that file." }, { status: 422 });
    }
    if (text.length > GENERATION_MAX_TEXT_CHARS) {
      return Response.json({ error: "That document has too much text to process at once." }, { status: 413 });
    }

    await ensureUserProfile(identity);
    const reservation = await reserveGeneration(identity);
    if (!reservation.allowed) {
      if (reservation.reason === "missing-profile") {
        return Response.json({ error: "Your account profile isn’t ready yet. Refresh and try again." }, { status: 409 });
      }
      return Response.json(
        {
          error: `You’ve used all ${reservation.limit} ${reservation.plan === "free" ? "Free" : "Pro"} plan generations for this month. Your limit resets ${new Date(reservation.resetAt).toLocaleDateString()}.`,
          usage: { used: reservation.used, limit: reservation.limit, resetAt: reservation.resetAt },
        },
        { status: 429 },
      );
    }
    reservationPeriod = reservation.period;

    const count = body.count;
    const styleInstructions: Record<string, string> = {
      standard: "Use a balanced mix of concise recall questions and clear answers.",
      definitions: "Focus on key terms, definitions, and the distinctions between concepts.",
      exam: "Use exam-preparation questions that test application, comparisons, and common misconceptions.",
    };
    const formatInstructions: Record<GenerationFormat, string> = {
      identification:
        'Make every card an identification question: ask the learner to name, identify, or briefly define one specific concept. Set each card format to "identification".',
      enumeration:
        'Make every card an enumeration question that asks the learner to list related items, steps, properties, or conditions. Set each card format to "enumeration" and write its answer as a numbered list with one item per line.',
      mixed:
        'Create a useful mix of identification questions and enumeration questions. Identification cards ask for one concept or definition. Enumeration cards ask for multiple related items and use a numbered list with one item per line. Set each card format to match its question.',
    };
    const materialInput: Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mime_type: string }
      | { type: "document"; data: string; mime_type: string }
    > = [];

    if (sourceType === "image") {
      materialInput.push({ type: "image", mime_type: body.mimeType, data });
    } else if (sourceType === "pdf") {
      materialInput.push({ type: "document", mime_type: body.mimeType, data });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Fallback model chain to bypass 503 high-demand spikes on a single model pool
    const candidateModels = Array.from(
      new Set([
        process.env.GEMINI_MODEL || "gemini-3.8-flash",
        "gemini-3.5-flash-lite"
      ]),
    );

    const cards: Flashcard[] = [];
    let suggestedTitle = "";
    let summary = "";
    const totalBatches = Math.ceil(count / GENERATION_MAX_CARDS_PER_BATCH);
    let remainingCards = count;
    let batchNumber = 0;
    while (remainingCards > 0) {
      batchNumber += 1;
      const batchCount = Math.min(GENERATION_MAX_CARDS_PER_BATCH, remainingCards);
      const previouslyAsked = cards
        .slice(-40)
        .map((card) => card.question.slice(0, 240))
        .join("\n");
      const prompt = [
        `Create exactly ${batchCount} useful study flashcards from the supplied material.`,
        `This is batch ${batchNumber} of ${totalBatches} for one deck.`,
        "Keep each question focused on one idea; make answers accurate, concise, and self-contained.",
        "Use a short memory cue for each hint.",
        `Write every card at ${body.difficulty} difficulty.`,
        styleInstructions[String(body.style)],
        formatInstructions[generationFormat as GenerationFormat],
        "Suggest a concise deck title and a one-sentence summary of the study material.",
        previouslyAsked
          ? `Avoid repeating these questions from earlier batches:\n${previouslyAsked}`
          : "",
        `Source: ${body.fileName.slice(0, 120)}`,
        text ? `Study material:\n${text}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const input = [{ type: "text" as const, text: prompt }, ...materialInput];

      let interaction: Awaited<ReturnType<typeof ai.interactions.create>> | null = null;
      let lastError: unknown = null;
      for (const modelName of candidateModels) {
        try {
          interaction = await ai.interactions.create({
            model: modelName,
            input,
            store: false,
            stream: false,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: {
                type: "object",
                properties: {
                  suggestedTitle: { type: "string" },
                  summary: { type: "string" },
                  cards: {
                    type: "array",
                    minItems: batchCount,
                    maxItems: batchCount,
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        answer: { type: "string" },
                        hint: { type: "string" },
                        format: {
                          type: "string",
                          enum: ["identification", "enumeration"],
                        },
                        difficulty: {
                          type: "string",
                          enum: ["easy", "medium", "hard"],
                        },
                      },
                      required: ["question", "answer", "hint", "format", "difficulty"],
                    },
                  },
                },
                required: ["suggestedTitle", "summary", "cards"],
              },
            },
          });
          break;
        } catch (err) {
          lastError = err;
          const status = getGeminiStatus(err);
          if (status === 503 || status === 429 || status === 404) {
            console.warn(`[Gemini Fallback] ${modelName} returned ${status}, trying next model...`);
            continue;
          }
          throw err;
        }
      }

      if (!interaction) {
        throw lastError ?? new Error("All Gemini models are currently unavailable.");
      }
      if (!("output_text" in interaction) || !interaction.output_text) {
        throw new Error("The AI returned no flashcards.");
      }
      const generated = JSON.parse(interaction.output_text) as {
        suggestedTitle?: unknown;
        summary?: unknown;
        cards?: unknown;
      };
      if (
        typeof generated.suggestedTitle !== "string" ||
        typeof generated.summary !== "string"
      ) {
        throw new Error("The AI returned incomplete deck details.");
      }
      const batchCards = validateCards(
        generated.cards,
        generationFormat as GenerationFormat,
      );
      if (batchCards.length !== batchCount) {
        throw new Error("The AI returned a different number of flashcards than requested.");
      }
      if (!suggestedTitle) suggestedTitle = generated.suggestedTitle.trim();
      if (!summary) summary = generated.summary.trim();
      cards.push(...batchCards);
      remainingCards -= batchCount;
    }

    reservationPeriod = null;
    return Response.json({
      suggestedTitle,
      summary,
      cards,
    });
  } catch (error) {
    console.error("Flashcard generation failed.", error);
    if (reservationPeriod !== null) {
      try {
        await releaseGeneration(identity.uid, reservationPeriod);
      } catch (releaseError) {
        console.error("Could not release the failed generation reservation.", releaseError);
      }
    }
    const status = getGeminiStatus(error);
    if (status === 404) {
      return Response.json(
        { error: "Gemini couldn’t find this model for your project. Check your API key and model access." },
        { status: 502 },
      );
    }
    if (status === 429 || status === 503) {
      return Response.json(
        { error: "Gemini is experiencing high demand right now. Please try again in a few seconds." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "We couldn’t read that material or generate cards. Please try again." },
      { status: 500 },
    );
  }
}