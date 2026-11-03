import { join } from "node:path";
import initSqlJs from "sql.js";
import JSZip from "jszip";
import { verifyRequestUser } from "@/lib/server-auth";
import type { Flashcard } from "@/lib/flashcards";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_DATABASE_BYTES = 80 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 120 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_CARDS = 5_000;
const DEFAULT_DECK_NAME = "Anki import";

type AnkiModel = {
  type?: number;
  flds?: { name?: string; ord?: number }[];
  tmpls?: { qfmt?: string; afmt?: string }[];
};

function cleanHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = tag.match(/\balt=["']([^"']+)["']/i)?.[1];
      const source = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const label = alt || source?.split(/[\\/]/).pop();
      return label ? `[Image: ${label}]` : "[Image]";
    })
    .replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, "[Audio]")
    .replace(/<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, "[Audio: $1]")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const point = code[0].toLowerCase() === "x"
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(point) && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : "";
    })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function fieldReferences(template: string) {
  return [...template.matchAll(/{{\s*(?:[^:}]+:)?([^{}]+?)\s*}}/g)]
    .map((match) => match[1].trim())
    .filter((name) => !/^(?:FrontSide|tags|type|deck|subdeck|card|cardFlag|c\d+::)/i.test(name));
}

function renderTemplate(
  template: string,
  fieldValues: Map<string, string>,
  frontSide = "",
) {
  const withConditionals = template.replace(
    /{{([#^])\s*([^{}]+?)\s*}}([\s\S]*?){{\/\s*\2\s*}}/g,
    (match, operator: string, rawName: string, content: string) => {
      const value = fieldValues.get(rawName.trim().toLocaleLowerCase()) ?? "";
      return (operator === "#" ? Boolean(value) : !value) ? content : "";
    },
  );
  return cleanHtml(
    withConditionals.replace(
      /{{\s*(?:[^:}]+:)?([^{}]+?)\s*}}/g,
      (match, rawName: string) => {
        const name = rawName.trim();
        if (name.toLocaleLowerCase() === "frontside") return frontSide;
        if (/^(?:tags|type|deck|subdeck|card|cardflag|c\d+::)/i.test(name)) return "";
        return fieldValues.get(name.toLocaleLowerCase()) ?? "";
      },
    ),
  );
}

function parseCloze(value: string, cardOrdinal: number) {
  const clozePattern = /{{c(\d+)::([\s\S]*?)(?:::[\s\S]*?)?}}/gi;
  const answers: string[] = [];
  const question = value.replace(clozePattern, (match, index: string, answer: string) => {
    if (Number(index) === cardOrdinal + 1) {
      answers.push(cleanHtml(answer.split("::", 1)[0]));
      return "[...]";
    }
    return answer.split("::", 1)[0];
  });
  return {
    question: cleanHtml(question),
    answer: answers.join("; "),
  };
}

function parseJsonObject<T>(value: string | null | undefined): Record<string, T> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? parsed as Record<string, T>
      : {};
  } catch {
    return {};
  }
}

function validZipEntrySize(entry: JSZip.JSZipObject) {
  const internal = entry as JSZip.JSZipObject & {
    _data?: { uncompressedSize?: number };
  };
  return internal._data?.uncompressedSize;
}

export async function POST(request: Request) {
  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in before importing an Anki deck." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return Response.json({ error: "Anki packages must be 25 MB or smaller." }, { status: 413 });
  }

  let database: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]> | null = null;
  try {
    const formData = await request.formData();
    const upload = formData.get("file");
    if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".apkg")) {
      return Response.json({ error: "Choose an Anki .apkg package to import." }, { status: 400 });
    }
    if (upload.size === 0 || upload.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Anki packages must be between 1 byte and 25 MB." }, { status: 413 });
    }

    const archive = await JSZip.loadAsync(await upload.arrayBuffer(), {
      checkCRC32: false,
      createFolders: false,
    });
    const entries = Object.values(archive.files).filter((entry) => !entry.dir);
    if (entries.length > MAX_ARCHIVE_ENTRIES) {
      return Response.json({ error: "This Anki package contains too many files to import safely." }, { status: 413 });
    }
    let totalExpandedBytes = 0;
    for (const entry of entries) {
      const size = validZipEntrySize(entry);
      if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
        return Response.json({ error: "This Anki package has invalid archive metadata." }, { status: 400 });
      }
      totalExpandedBytes += size;
      if (totalExpandedBytes > MAX_ARCHIVE_BYTES) {
        return Response.json({ error: "This Anki package expands beyond the 120 MB import limit." }, { status: 413 });
      }
    }

    const databaseEntry =
      archive.file("collection.anki2") ??
      archive.file("collection.anki21");
    if (!databaseEntry) {
      return Response.json({ error: "No supported Anki collection database was found in this .apkg file." }, { status: 400 });
    }
    const databaseSize = validZipEntrySize(databaseEntry);
    if (typeof databaseSize !== "number" || databaseSize > MAX_DATABASE_BYTES) {
      return Response.json({ error: "The Anki collection database exceeds the 80 MB import limit." }, { status: 413 });
    }

    const SQL = await initSqlJs({
      locateFile: (file) => join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
    database = new SQL.Database(await databaseEntry.async("uint8array"));
    const modelsResult = database.exec("SELECT models, decks FROM col LIMIT 1");
    const modelsJson = modelsResult[0]?.values[0]?.[0];
    const decksJson = modelsResult[0]?.values[0]?.[1];
    const models = parseJsonObject<AnkiModel>(
      typeof modelsJson === "string" ? modelsJson : null,
    );
    const decks = parseJsonObject<{ name?: string }>(
      typeof decksJson === "string" ? decksJson : null,
    );
    const notesResult = database.exec(
      "SELECT DISTINCT n.id, n.mid, n.flds, c.ord, c.did FROM notes n INNER JOIN cards c ON c.nid = n.id ORDER BY n.id, c.ord",
    );
    const rows = notesResult[0]?.values ?? [];
    if (!rows.length) {
      return Response.json({ error: "This Anki package doesn’t contain any study cards." }, { status: 400 });
    }
    if (rows.length > MAX_CARDS * 20) {
      return Response.json({ error: "This Anki package has too many card templates to import safely." }, { status: 413 });
    }

    const cards: Flashcard[] = [];
    const importedDeckNames = new Set<string>();
    for (const row of rows) {
      const [, modelIdValue, fieldsValue, ordinalValue, deckIdValue] = row;
      if (typeof modelIdValue !== "number" || typeof fieldsValue !== "string") continue;
      const model = models[String(modelIdValue)];
      const fields = fieldsValue.split("\u001f");
      const ordinal = typeof ordinalValue === "number" ? ordinalValue : 0;
      if (typeof deckIdValue === "number") {
        const deckName = decks[String(deckIdValue)]?.name;
        if (deckName && deckName !== "Default") importedDeckNames.add(deckName);
      }

      let question = "";
      let answer = "";
      const modelFields = model?.flds ?? [];
      const orderedFields = [...modelFields].sort(
        (a, b) => Number(a.ord ?? 0) - Number(b.ord ?? 0),
      );
      const fieldValues = new Map(
        fields.map((value, index) => [
          (orderedFields[index]?.name ?? `field${index + 1}`).toLocaleLowerCase(),
          value,
        ]),
      );
      const clozeField = fields.find((field) => /{{c\d+::/i.test(field));
      if (clozeField) {
        ({ question, answer } = parseCloze(clozeField, ordinal));
      } else {
        const template = model?.tmpls?.[ordinal]?.qfmt ?? "";
        const answerTemplate = model?.tmpls?.[ordinal]?.afmt ?? "";
        const references = fieldReferences(template);
        const frontField = references
          .map((name) => fieldValues.get(name.toLocaleLowerCase()) ?? "")
          .find((value) => cleanHtml(value));
        if (template && references.length && frontField) {
          question = renderTemplate(template, fieldValues);
        }

        const answerReferences = fieldReferences(
          answerTemplate.replace(/{{\s*FrontSide\s*}}/gi, ""),
        );
        const backField = answerReferences
          .filter((name) => !references.some((front) => front.toLocaleLowerCase() === name.toLocaleLowerCase()))
          .map((name) => fieldValues.get(name.toLocaleLowerCase()) ?? "")
          .find((value) => cleanHtml(value));
        if (answerTemplate && backField) {
          answer = renderTemplate(answerTemplate, fieldValues, question);
        }

        if (!question || !answer) {
          const nonEmptyFields = fields
            .map((value, index) => ({ index, value: cleanHtml(value) }))
            .filter((field) => field.value);
          const frontFieldIndex = references.length
            ? orderedFields.findIndex((field) =>
                field.name?.toLocaleLowerCase() === references[0].toLocaleLowerCase(),
              )
            : -1;
          const frontIndex = frontFieldIndex >= 0
            ? frontFieldIndex
            : nonEmptyFields[0]?.index ?? 0;
          const backIndex = nonEmptyFields.find((field) => field.index !== frontIndex)?.index;
          question ||= cleanHtml(fields[frontIndex] ?? "");
          answer ||= backIndex === undefined ? "" : cleanHtml(fields[backIndex] ?? "");
        }
      }
      if (!question || !answer) {
        const preferredFront = /^(front|question|prompt|word|term|kana|kanji|expression|sentence)$/i;
        const preferredBack = /^(back|answer|response|meaning|definition|translation|reading|explanation)$/i;
        const namedFields = orderedFields
          .map((field, index) => ({
            name: field.name ?? "",
            value: cleanHtml(fields[index] ?? ""),
          }))
          .filter((field) => field.value);
        question ||= namedFields.find((field) => preferredFront.test(field.name))?.value ?? "";
        answer ||= namedFields.find(
          (field) =>
            preferredBack.test(field.name) &&
            field.value !== question,
        )?.value ?? "";
        const firstValue = namedFields.find((field) => field.value !== answer)?.value ?? "";
        const secondValue = namedFields.find((field) => field.value !== firstValue)?.value ?? "";
        question ||= firstValue;
        answer ||= secondValue;
      }
      if (!question || !answer) continue;
      cards.push({
        question,
        answer,
        hint: "",
        difficulty: "medium",
        status: "new",
        format: answer.includes("\n") ? "enumeration" : "identification",
      });
      if (cards.length > MAX_CARDS) {
        return Response.json({ error: `Import up to ${MAX_CARDS.toLocaleString()} cards at a time.` }, { status: 413 });
      }
    }
    if (!cards.length) {
      return Response.json({
        error: "No supported question-and-answer cards were found. Check that the package contains Basic or Cloze note types.",
      }, { status: 400 });
    }

    const deckName = [...importedDeckNames][0]?.split("::").pop();
    const suggestedTitle = (deckName || upload.name.replace(/\.apkg$/i, "") || DEFAULT_DECK_NAME).slice(0, 100);
    return Response.json({
      suggestedTitle,
      summary: `Imported ${cards.length} cards from an Anki package.`,
      cards,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not import the Anki package.", error);
    return Response.json({
      error: "This Anki package couldn’t be read. Export it again as an .apkg file and try once more.",
    }, { status: 400 });
  } finally {
    database?.close();
  }
}
