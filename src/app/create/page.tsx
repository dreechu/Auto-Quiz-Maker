"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  FileImage,
  FileText,
  FileUp,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { TaskProgress } from "@/components/TaskProgress";
import { useAuth } from "@/context/AuthContext";
import { MAX_UPLOAD_BYTES } from "@/lib/api-limits";
import { createDeck } from "@/lib/db";
import { processFile, processNotes, type ProcessedSource } from "@/lib/fileProcessors";
import type {
  Deck,
  Difficulty,
  Flashcard,
  GenerationFormat,
  SourceType,
} from "@/lib/flashcards";

const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;
const MAX_ANKI_FILE_BYTES = MAX_UPLOAD_BYTES;
const ACCEPTED = ".png,.jpg,.jpeg,.webp,.pdf,.docx,.pptx,.txt,.md,.apkg";
const REVIEW_PAGE_SIZE = 5;
const STUDY_STYLES = [
  { value: "standard", label: "Standard Q&A" },
  { value: "definitions", label: "Key Definitions" },
  { value: "exam", label: "Exam Prep" },
] as const;
const PROGRESS_STEPS = [
  "Reading and preparing your material",
  "AI is analyzing key concepts",
  "Organizing and checking your flashcards",
];
const ANKI_PROGRESS_STEPS = [
  "Reading your Anki package",
  "Extracting cards and answers",
  "Preparing your review",
];
const SAVE_PROGRESS_STEPS = ["Preparing your deck", "Saving your cards"];
type StudyStyle = (typeof STUDY_STYLES)[number]["value"];
type ReviewCard = Flashcard & { id: string };
type GenerationResult = {
  suggestedTitle: string;
  summary: string;
  cards: Flashcard[];
};

function CreateDeckForm() {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardsListRef = useRef<HTMLDivElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "notes" | "manual">("file");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [cardCount, setCardCount] = useState<number>(15);
  const [style, setStyle] = useState<StudyStyle>("standard");
  const [questionFormat, setQuestionFormat] =
    useState<GenerationFormat>("mixed");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [saveProgressStep, setSaveProgressStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<GenerationResult | null>(null);
  const [importedAnki, setImportedAnki] = useState(false);
  const [manualDeck, setManualDeck] = useState(false);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [deckSourceType, setDeckSourceType] = useState<SourceType>("text");
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState("");
  const reviewPageCount = Math.max(1, Math.ceil(cards.length / REVIEW_PAGE_SIZE));
  const visibleCards = useMemo(
    () =>
      cards.slice(
        (reviewPage - 1) * REVIEW_PAGE_SIZE,
        reviewPage * REVIEW_PAGE_SIZE,
      ),
    [cards, reviewPage],
  );
  const isAnkiPackage =
    inputMode === "file" &&
    (file?.name.toLowerCase().endsWith(".apkg") ?? false);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setError("");
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!["png", "jpg", "jpeg", "webp", "pdf", "docx", "pptx", "txt", "md", "apkg"].includes(extension || "")) {
      setError("Choose a PNG, JPG, WEBP, PDF, DOCX, PPTX, TXT, or Anki APKG file.");
      return;
    }
    const isAnki = extension === "apkg";
    if (nextFile.size > (isAnki ? MAX_ANKI_FILE_BYTES : MAX_FILE_BYTES)) {
      setError("That file is over 200 MB. Try a smaller file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(nextFile.type.startsWith("image/") ? URL.createObjectURL(nextFile) : "");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function removeFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setError("");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setError("Please sign in before creating a deck.");
      return;
    }
    if (inputMode === "manual") {
      setDeckSourceType("text");
      setImportedAnki(false);
      setManualDeck(true);
      setReview({ suggestedTitle: "", summary: "", cards: [] });
      setTitle("");
      setSummary("");
      setCards([{
        id: crypto.randomUUID(),
        question: "",
        answer: "",
        hint: "",
        difficulty,
        status: "new",
        format: questionFormat === "enumeration" ? "enumeration" : "identification",
      }]);
      setReviewPage(1);
      setError("");
      return;
    }
    if (inputMode === "file" && !file) {
      setError("Choose a file to continue.");
      return;
    }
    if (inputMode === "notes" && !notes.trim()) {
      setError("Paste some notes to continue.");
      return;
    }
    const importingAnki = inputMode === "file" && isAnkiPackage && file;
    if (!importingAnki && (!Number.isSafeInteger(cardCount) || cardCount < 1)) {
      setError("Enter a whole number of cards greater than zero.");
      return;
    }

    setGenerating(true);
    setProgressStep(0);
    setError("");
    let progressTimer: number | undefined;
    try {
      if (importingAnki) {
        setProgressStep(1);
        const idToken = await user.getIdToken();
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/import/anki", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        });
        const result = (await response.json()) as GenerationResult & { error?: string };
        if (!response.ok || !Array.isArray(result.cards) || !result.cards.length) {
          throw new Error(result.error || "We couldn’t import this Anki deck. Please try again.");
        }
        setProgressStep(2);
        setDeckSourceType("anki");
        setImportedAnki(true);
        setManualDeck(false);
        setReview(result);
        setTitle(result.suggestedTitle);
        setSummary(result.summary);
        setCards(result.cards.map((card) => ({ ...card, id: crypto.randomUUID() })));
        setReviewPage(1);
        setFile(null);
        setNotes("");
        return;
      }

      let source: ProcessedSource;
      if (inputMode === "file" && file) {
        source = await processFile(file);
      } else {
        source = processNotes(notes);
      }

      setProgressStep(1);
      const idToken = await user.getIdToken();
      setDeckSourceType(source.sourceType);
      progressTimer = window.setInterval(() => {
        setProgressStep((step) => Math.min(step + 1, 2));
      }, 2500);
      const response = await fetch("/api/generate-flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...source,
          count: cardCount,
          style,
          format: questionFormat,
          difficulty,
        }),
      });
      if (progressTimer) window.clearInterval(progressTimer);
      const result = (await response.json()) as GenerationResult & { error?: string };
      if (!response.ok || !Array.isArray(result.cards) || !result.cards.length) {
        throw new Error(result.error || "We couldn’t generate flashcards. Please try again.");
      }

      setProgressStep(2);
      setImportedAnki(false);
      setManualDeck(false);
      setReview(result);
      setTitle(result.suggestedTitle);
      setSummary(result.summary);
      setCards(
        result.cards.map((card) => ({
          ...card,
          format:
            card.format ??
            (questionFormat === "enumeration" ? "enumeration" : "identification"),
          id: crypto.randomUUID(),
        })),
      );
      setReviewPage(1);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setFile(null);
      setNotes("");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while generating flashcards.",
      );
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setGenerating(false);
    }
  }

  function updateCard<Key extends keyof Flashcard>(
    id: string,
    field: Key,
    value: Flashcard[Key],
  ) {
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, [field]: value } : card,
      ),
    );
  }

  function addManualCard() {
    setReviewPage(Math.ceil((cards.length + 1) / REVIEW_PAGE_SIZE));
    setCards((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        question: "",
        answer: "",
        hint: "",
        difficulty,
        status: "new",
        format:
          questionFormat === "enumeration"
            ? "enumeration"
            : "identification",
      },
    ]);
  }

  function removeCard(id: string) {
    const remainingCount = cards.length - (cards.some((card) => card.id === id) ? 1 : 0);
    setCards((current) => current.filter((card) => card.id !== id));
    setReviewPage((page) =>
      Math.min(
        page,
        Math.max(1, Math.ceil(remainingCount / REVIEW_PAGE_SIZE)),
      ),
    );
  }

  function changeReviewPage(page: number) {
    setReviewPage(Math.min(reviewPageCount, Math.max(1, page)));
    cardsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSave() {
    if (!user || !review) {
      setError("Your session expired. Sign in again to save this deck.");
      return;
    }
    const cleanCards = cards.filter((card) => card.question.trim() && card.answer.trim());
    if (!title.trim()) {
      setError("Give your deck a name before saving.");
      return;
    }
    if (!cleanCards.length) {
      setError("Keep at least one card with a question and answer.");
      return;
    }
    setSaving(true);
    setSaveProgressStep(0);
    setError("");
    let saveProgressTimer: number | undefined;
    try {
      saveProgressTimer = window.setInterval(
        () => setSaveProgressStep(1),
        1800,
      );
      const now = Date.now();
      const deckCards = Object.fromEntries(
        cleanCards.map(({ id, ...card }) => [id, { ...card, status: "new" as const }]),
      );
      const deck: Deck = {
        title: title.trim(),
        description: summary.trim(),
        sourceType: deckSourceType,
        cardCount: cleanCards.length,
        masteredCount: 0,
        createdAt: now,
        updatedAt: now,
        cards: deckCards,
      };
      const deckId = await createDeck(user.uid, deck);
      setSuccess("Deck saved. Opening your cards…");
      router.push(`/deck/${deckId}`);
    } catch (saveError) {
      console.error("Could not save the new deck.", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your deck couldn’t be saved. Check your connection and try again.",
      );
      setSaving(false);
    } finally {
      if (saveProgressTimer) window.clearInterval(saveProgressTimer);
    }
  }

  function startOver() {
    setReview(null);
    setImportedAnki(false);
    setManualDeck(false);
    setCards([]);
    setReviewPage(1);
    setTitle("");
    setSummary("");
    setError("");
    setSuccess("");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <AnimatePresence mode="wait">
        {!review ? (
          <motion.main
            key="configure"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-3xl px-4 py-8 pb-12 sm:px-6 sm:py-10"
          >
            <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
              <ArrowLeft size={15} />
              Dashboard
            </Link>
            <div className="mb-7">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                <Sparkles size={12} />
                Create a study deck
              </span>
              <h1 className="text-[30px] font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">
                Turn your material into momentum.
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Add a file or paste your notes. Review every card before it’s saved.
              </p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Material input method">
                  <button type="button" role="tab" aria-selected={inputMode === "file"} onClick={() => { setInputMode("file"); setError(""); }} className={`h-10 rounded-lg text-xs font-semibold transition ${inputMode === "file" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    Upload File / Photo
                  </button>
                  <button type="button" role="tab" aria-selected={inputMode === "notes"} onClick={() => { setInputMode("notes"); setError(""); }} className={`h-10 rounded-lg text-xs font-semibold transition ${inputMode === "notes" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    Paste Raw Notes
                  </button>
                  <button type="button" role="tab" aria-selected={inputMode === "manual"} onClick={() => { setInputMode("manual"); setError(""); }} className={`h-10 rounded-lg text-xs font-semibold transition ${inputMode === "manual" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    Create Manually
                  </button>
                </div>

                {inputMode === "manual" ? (
                  <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <p className="text-sm font-semibold text-slate-800">Build your own flashcards</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Set a title, then add each question, answer, hint, format, and difficulty yourself. You can edit or remove cards before saving.</p>
                    <button type="submit" className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                      <Plus size={14} /> Start adding cards
                    </button>
                  </div>
                ) : inputMode === "file" ? (
                  <>
                    <input ref={inputRef} type="file" accept={ACCEPTED} onChange={handleFileChange} className="sr-only" aria-label="Choose a study file" />
                    {file ? (
                      <div className="mt-5 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                        {previewUrl ? (
                          <span role="img" aria-label="Selected image preview" className="size-14 rounded-lg border border-white bg-cover bg-center shadow-sm" style={{ backgroundImage: `url("${previewUrl}")` }} />
                        ) : (
                          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
                            {file.name.match(/\.(png|jpe?g|webp)$/i) ? <FileImage size={20} /> : <FileText size={20} />}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-700">{file.name}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB · Processed temporarily</p>
                        </div>
                        <button type="button" onClick={removeFile} disabled={generating} aria-label="Remove file" className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-rose-600">
                          <X size={17} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className={`mt-5 rounded-2xl border border-dashed px-5 py-10 text-center transition sm:py-12 ${dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/60 hover:border-indigo-300"}`}
                      >
                        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm"><FileUp size={21} /></span>
                        <p className="mt-4 text-sm font-semibold text-slate-700">
                          Drop your file here, or{" "}
                          <button type="button" onClick={() => inputRef.current?.click()} className="text-indigo-600 underline decoration-indigo-200 underline-offset-4">browse</button>
                        </p>
                        <p className="mt-2 text-xs text-slate-400">PNG, JPG, WEBP, PDF, DOCX, PPTX, TXT, Anki APKG · 200 MB</p>
                      </div>
                    )}
                    {isAnkiPackage && (
                      <p className="mt-3 rounded-xl bg-indigo-50 px-3.5 py-3 text-xs leading-5 text-indigo-800">
                        Anki package detected. Cards will be imported directly—no AI generation required. You can review and edit them before saving.
                      </p>
                    )}
                  </>
                ) : (
                  <label className="mt-5 block">
                    <span className="mb-2 block text-xs font-semibold text-slate-700">Paste class notes or a reading excerpt</span>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={100000} rows={8} placeholder="Paste your notes here…" className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
                    <span className="mt-1 block text-right text-[10px] text-slate-400">{notes.length.toLocaleString()} / 100,000</span>
                  </label>
                )}
              </section>

              {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{error}</p>}

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                {!isAnkiPackage && inputMode !== "manual" && <>
                <label className="mb-5 block">
                  <span className="mb-2.5 block text-xs font-semibold text-slate-700">Number of cards</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={cardCount}
                    onChange={(event) => setCardCount(event.target.value === "" ? 0 : Number(event.target.value))}
                    className="h-10 w-32 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                  />
                  <span className="ml-3 text-[10px] text-slate-400">Large requests are generated in batches.</span>
                </label>
                <PillGroup<StudyStyle> label="Study style" values={STUDY_STYLES.map((item) => item.value)} labels={Object.fromEntries(STUDY_STYLES.map((item) => [item.value, item.label]))} selected={style} onChange={setStyle} />
                <PillGroup<GenerationFormat> label="Question format" values={["identification", "enumeration", "mixed"]} labels={{ identification: "Identification", enumeration: "Enumeration", mixed: "Mixed" }} selected={questionFormat} onChange={setQuestionFormat} />
                <PillGroup<Difficulty> label="Difficulty" values={["easy", "medium", "hard"]} labels={{ easy: "Easy", medium: "Medium", hard: "Hard" }} selected={difficulty} onChange={setDifficulty} />
                </>}

                {inputMode === "manual" ? (
                  <p className="mt-5 text-center text-[10px] leading-5 text-slate-400">Manual decks are saved only when you finish reviewing them.</p>
                ) : generating ? (
                  <div className="mt-6">
                    <TaskProgress
                      steps={isAnkiPackage ? ANKI_PROGRESS_STEPS : PROGRESS_STEPS}
                      activeStep={progressStep}
                    />
                  </div>
                ) : (
                  <button type="submit" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                    <Sparkles size={16} />
                    {isAnkiPackage ? "Import Anki cards" : "Generate flashcards"}
                  </button>
                )}
                <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">{inputMode === "manual" ? "No AI generation is used. Your deck is saved when you finish reviewing it." : "Your original file is processed temporarily and is never saved."}</p>
              </section>
            </form>
          </motion.main>
        ) : (
          <motion.main
            key="review"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-4xl px-4 py-8 pb-36 sm:px-6 sm:py-10"
          >
            <button type="button" onClick={startOver} className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
              <ArrowLeft size={15} />
              Start over
            </button>
            <div className="mb-7">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                <Check size={12} />
                {manualDeck ? "Manual deck" : importedAnki ? "Anki cards imported" : "Your first draft is ready"}
              </span>
              <h1 className="text-[30px] font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">Review your flashcards</h1>
              <p className="mt-2 text-sm text-slate-500">{manualDeck ? "Add and edit your own cards below. Nothing is saved until you’re ready." : importedAnki ? "Review and edit your imported cards. Nothing is saved until you’re ready." : "Make any changes you like. Nothing is saved until you’re ready."}</p>
            </div>

            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Deck title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
              </label>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Summary</span>
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} maxLength={500} className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm leading-5 text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
              </label>
            </section>

            <div ref={cardsListRef} className="mb-4 flex scroll-mt-24 items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Cards to study</h2>
              <span className="text-xs text-slate-400">{cards.length} {cards.length === 1 ? "card" : "cards"}</span>
            </div>
            <div className="space-y-4">
              {visibleCards.map((card, index) => {
                const cardNumber = (reviewPage - 1) * REVIEW_PAGE_SIZE + index + 1;
                return (
                <motion.article layout key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Card {cardNumber}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1" role="group" aria-label={`Question format for card ${cardNumber}`}>
                        {(["identification", "enumeration"] as const).map((format) => (
                          <button
                            key={format}
                            type="button"
                            onClick={() => updateCard(card.id, "format", format)}
                            aria-pressed={(card.format ?? "identification") === format}
                            className={`rounded-full border px-2 py-1 text-[9px] font-semibold transition ${(card.format ?? "identification") === format ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                          >
                            {format === "identification" ? "Identify" : "Enumerate"}
                          </button>
                        ))}
                      </div>
                      {(["easy", "medium", "hard"] as const).map((level) => (
                        <button key={level} type="button" onClick={() => updateCard(card.id, "difficulty", level)} aria-pressed={card.difficulty === level} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize transition ${card.difficulty === level ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>
                          {level}
                        </button>
                      ))}
                      <button type="button" onClick={() => removeCard(card.id)} aria-label={`Delete card ${cardNumber}`} className="ml-1 grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Question</span>
                    <textarea value={card.question} onChange={(event) => updateCard(card.id, "question", event.target.value)} rows={2} maxLength={2000} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                      {(card.format ?? "identification") === "enumeration" ? "Answer · one item per line" : "Answer"}
                    </span>
                    <textarea value={card.answer} onChange={(event) => updateCard(card.id, "answer", event.target.value)} rows={(card.format ?? "identification") === "enumeration" ? 5 : 3} maxLength={5000} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">Hint <span className="font-normal text-slate-400">(optional)</span></span>
                    <input value={card.hint} onChange={(event) => updateCard(card.id, "hint", event.target.value)} maxLength={500} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-600 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
                  </label>
                </motion.article>
                );
              })}
            </div>

            {cards.length > REVIEW_PAGE_SIZE && (
              <nav aria-label="Flashcard review pages" className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => changeReviewPage(reviewPage - 1)}
                  disabled={reviewPage === 1}
                  className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span aria-live="polite" className="text-xs font-medium text-slate-500">
                  Page {reviewPage} of {reviewPageCount}
                  <span className="hidden sm:inline"> · Cards {(reviewPage - 1) * REVIEW_PAGE_SIZE + 1}–{Math.min(reviewPage * REVIEW_PAGE_SIZE, cards.length)} of {cards.length}</span>
                </span>
                <button
                  type="button"
                  onClick={() => changeReviewPage(reviewPage + 1)}
                  disabled={reviewPage === reviewPageCount}
                  className="h-9 rounded-lg px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}

            <button type="button" onClick={addManualCard} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700">
              <Plus size={15} />
              Add Manual Card
            </button>
            {error && <p role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{error}</p>}
            {success && <p role="status" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{success}</p>}
          </motion.main>
        )}
      </AnimatePresence>

      {review && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{cards.length} {cards.length === 1 ? "card" : "cards"}</p>
              {saving ? (
                <div className="mt-2 w-56 max-w-[48vw]">
                  <TaskProgress steps={SAVE_PROGRESS_STEPS} activeStep={saveProgressStep} />
                </div>
              ) : (
                <p className="hidden text-[10px] text-slate-400 sm:block">Ready when you are</p>
              )}
            </div>
            <button type="button" onClick={handleSave} disabled={saving || !cards.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-sm">
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={15} />}
              {saving ? "Saving deck…" : "Save & Start Studying"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PillGroup<T extends string | number>({
  label,
  values,
  selected,
  onChange,
  labels,
}: {
  label: string;
  values: T[];
  selected: T;
  onChange: (value: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-2.5 text-xs font-semibold text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button key={value} type="button" aria-pressed={selected === value} onClick={() => onChange(value)} className={`min-h-9 rounded-full border px-3.5 text-xs font-medium transition ${selected === value ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}>
            {labels?.[String(value)] ?? value}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CreatePage() {
  return <AuthGate><CreateDeckForm /></AuthGate>;
}
