import JSZip from "jszip";
import mammoth from "mammoth";
import type { SourceType } from "@/lib/flashcards";

export type ProcessedSource = {
  fileName: string;
  sourceType: SourceType;
  mimeType: string;
  data?: string;
  text?: string;
  previewDataUrl?: string;
};

const MIME_TYPES: Record<SourceType, string> = {
  image: "image/jpeg",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  text: "text/plain",
  anki: "application/vnd.anki",
};

function extensionOf(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Your file couldn’t be read."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Your file couldn’t be read."));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image couldn’t be opened. Try another image.");
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser couldn’t prepare this image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { data: dataUrl.split(",")[1], previewDataUrl: dataUrl };
  } finally {
    bitmap.close();
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractPptxText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(
      (a, b) =>
        Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0) -
        Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0),
    );
  const slides = await Promise.all(
    slideNames.map(async (name) => {
      const xml = await zip.files[name].async("text");
      return [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join(" ");
    }),
  );
  return slides.join("\n").trim();
}

export async function processFile(file: File): Promise<ProcessedSource> {
  const extension = extensionOf(file);
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) {
    const image = await compressImage(file);
    return {
      fileName: file.name,
      sourceType: "image",
      mimeType: MIME_TYPES.image,
      ...image,
    };
  }
  if (extension === "pdf") {
    const dataUrl = await readAsDataUrl(file);
    return {
      fileName: file.name,
      sourceType: "pdf",
      mimeType: MIME_TYPES.pdf,
      data: dataUrl.split(",")[1],
    };
  }
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (!result.value.trim()) throw new Error("No readable text was found in that document.");
    return {
      fileName: file.name,
      sourceType: "docx",
      mimeType: MIME_TYPES.docx,
      text: result.value.trim(),
    };
  }
  if (extension === "pptx") {
    const text = await extractPptxText(await file.arrayBuffer());
    if (!text) throw new Error("No readable text was found in those slides.");
    return {
      fileName: file.name,
      sourceType: "pptx",
      mimeType: MIME_TYPES.pptx,
      text,
    };
  }
  if (["txt", "md"].includes(extension)) {
    const text = (await file.text()).trim();
    if (!text) throw new Error("This file is empty. Choose another file or paste your notes.");
    return {
      fileName: file.name,
      sourceType: "text",
      mimeType: MIME_TYPES.text,
      text,
    };
  }
  throw new Error("Choose a PNG, JPG, WEBP, PDF, DOCX, PPTX, or TXT file.");
}

export function processNotes(text: string): ProcessedSource {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error("Add some notes before generating flashcards.");
  return {
    fileName: "Pasted notes",
    sourceType: "text",
    mimeType: MIME_TYPES.text,
    text: trimmedText,
  };
}
