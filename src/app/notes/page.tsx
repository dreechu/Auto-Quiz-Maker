"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  FileImage,
  FileText,
  FileUp,
  Globe2,
  Lightbulb,
  LoaderCircle,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { TaskProgress } from "@/components/TaskProgress";
import { useAuth } from "@/context/AuthContext";
import { MAX_UPLOAD_BYTES } from "@/lib/api-limits";
import { deleteNote, getNotes, renameNote, setNotePublic, type SavedNote } from "@/lib/db";
import type { NoteKeyTerm } from "@/lib/notes";

const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;
const SECTIONS_PER_PAGE = 3;
type NoteView = "overview" | "takeaways" | "terms" | "details";
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.txt,.md";
const SUPPORTED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "docx", "pptx", "txt", "md",
]);
const NOTES_PROGRESS_STEPS = [
  "Uploading your file securely",
  "Reading and reviewing the material",
  "AI is organizing your detailed notes",
];

const FILE_LABELS: Record<string, string> = {
  pdf: "PDF",
  png: "Photo",
  jpg: "Photo",
  jpeg: "Photo",
  webp: "Photo",
  docx: "Word",
  pptx: "Slides",
  txt: "Text",
  md: "Markdown",
  multiple: "Multiple sources",
};

function formattedDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function baseFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-");
}

function RichText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1.5 pl-5 marker:text-indigo-400">
        {bullets.map((bullet, index) => (
          <li key={`${index}-${bullet.slice(0, 20)}`}>{renderInline(bullet)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    blocks.push(
      heading ? (
        <h4 key={`heading-${index}`} className="mb-1 mt-4 text-sm font-semibold text-slate-800 first:mt-0">
          {renderInline(heading[1])}
        </h4>
      ) : (
        <p key={`paragraph-${index}`} className="my-2 last:mb-0">
          {renderInline(line)}
        </p>
      ),
    );
  }
  flushBullets();
  return <div className="text-sm leading-7 text-slate-600">{blocks}</div>;
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
      : part,
  );
}

function NoteReader({
  note,
  ownerUid,
  onBack,
  onAppend,
  onTogglePublic,
}: {
  note: SavedNote;
  ownerUid: string;
  onBack: () => void;
  onAppend: (noteId: string, file: File) => Promise<SavedNote>;
  onTogglePublic: (note: SavedNote) => Promise<SavedNote>;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeView, setActiveView] = useState<NoteView>("overview");
  const [addingMore, setAddingMore] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [appendError, setAppendError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const appendInputRef = useRef<HTMLInputElement>(null);
  const totalPages = Math.max(1, Math.ceil(note.sections.length / SECTIONS_PER_PAGE));
  const sectionStart = currentPage * SECTIONS_PER_PAGE;
  const visibleSections = note.sections.slice(sectionStart, sectionStart + SECTIONS_PER_PAGE);

  async function copyNotes() {
    const text = [
      `# ${note.title}`,
      note.summary,
      ...note.sections.map((section) => [
        `## ${section.heading}`,
        section.content,
        ...(section.examples?.length
          ? ["### Examples", ...section.examples.map((example) => `- ${example}`)]
          : []),
      ].join("\n\n")),
      note.keyTakeaways.length
        ? `## Key takeaways\n\n${note.keyTakeaways.map((item) => `- ${item}`).join("\n")}`
        : "",
      note.keyTerms.length
        ? `## Key terms\n\n${note.keyTerms.map((item) => `- **${item.term}:** ${item.definition}`).join("\n")}`
        : "",
    ].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Could not copy the saved notes.", error);
      setCopyError("Couldn’t copy notes. Try downloading them instead.");
    }
  }

  function downloadNotes() {
    const markdown = [
      `# ${note.title}`,
      note.summary,
      ...note.sections.map((section) => [
        `## ${section.heading}`,
        section.content,
        ...(section.examples?.length
          ? ["### Examples", ...section.examples.map((example) => `- ${example}`)]
          : []),
      ].join("\n\n")),
      note.keyTakeaways.length
        ? `## Key takeaways\n\n${note.keyTakeaways.map((item) => `- ${item}`).join("\n")}`
        : "",
      note.keyTerms.length
        ? `## Key terms\n\n${note.keyTerms.map((item) => `- **${item.term}:** ${item.definition}`).join("\n")}`
        : "",
    ].filter(Boolean).join("\n\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${baseFileName(note.title) || "study-notes"}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function toggleSharing() {
    setSharing(true);
    setShareError("");
    try {
      await onTogglePublic(note);
    } catch (error) {
      console.error("Could not change note sharing.", error);
      setShareError(error instanceof Error ? error.message : "The sharing setting couldn’t be updated.");
    } finally {
      setSharing(false);
    }
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/public-notes/${encodeURIComponent(ownerUid)}/${encodeURIComponent(note.id)}`,
      );
    } catch (error) {
      console.error("Could not copy the public note link.", error);
      setShareError("Couldn’t copy the public link. Try again or open it from Discover.");
    }
  }

  async function addMoreMaterial(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      setAppendError("Choose a PDF, PNG, JPG, WEBP, DOCX, PPTX, TXT, or Markdown file.");
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setAppendError(file.size === 0 ? "That file is empty. Choose another file." : "That file is over 200 MB. Try a smaller file.");
      return;
    }

    setAddingMore(true);
    setProgressStep(0);
    setAppendError("");
    const progressTimer = window.setInterval(
      () => setProgressStep((step) => Math.min(step + 1, NOTES_PROGRESS_STEPS.length - 1)),
      3500,
    );
    try {
      const updatedNote = await onAppend(note.id, file);
      setCurrentPage(Math.max(0, Math.ceil(updatedNote.sections.length / SECTIONS_PER_PAGE) - 1));
      setActiveView("details");
    } catch (error) {
      console.error("Could not add material to this note.", error);
      setAppendError(error instanceof Error ? error.message : "We couldn’t add this material. Please try again.");
    } finally {
      window.clearInterval(progressTimer);
      setAddingMore(false);
    }
  }

  function renderPagination() {
    if (totalPages <= 1) return null;
    const firstSection = sectionStart + 1;
    const lastSection = Math.min(sectionStart + SECTIONS_PER_PAGE, note.sections.length);
    return (
      <nav aria-label="Detailed notes pages" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
          disabled={currentPage === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={14} />
          Previous
        </button>
        <span aria-live="polite" className="text-xs text-slate-500">
          Page {currentPage + 1} of {totalPages} <span className="text-slate-300">·</span> Sections {firstSection}–{lastSection} of {note.sections.length}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
          disabled={currentPage >= totalPages - 1}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowRight size={14} />
        </button>
      </nav>
    );
  }

  const views: { id: NoteView; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    ...(note.keyTakeaways.length
      ? [{ id: "takeaways" as const, label: "Key takeaways", count: note.keyTakeaways.length }]
      : []),
    ...(note.keyTerms.length
      ? [{ id: "terms" as const, label: "Important terms", count: note.keyTerms.length }]
      : []),
    ...(note.sections.length
      ? [{ id: "details" as const, label: "Detailed notes", count: note.sections.length }]
      : []),
  ];

  return (
    <div>
      <input
        ref={appendInputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(event) => {
          void addMoreMaterial(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
        <ArrowLeft size={15} />
        All notes
      </button>
      <header className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 shadow-sm">
                {FILE_LABELS[note.sourceType] ?? note.sourceType}
              </span>
              <span className="text-xs text-slate-400">{formattedDate(note.updatedAt)}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{note.title}</h1>
            <p className="mt-2 break-words text-xs text-slate-400">From {note.sourceName}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => void toggleSharing()} disabled={sharing} className={"inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50 " + (note.isPublic ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
              {sharing ? <LoaderCircle size={14} className="animate-spin" /> : <Globe2 size={14} />}
              {note.isPublic ? "Make private" : "Publish"}
            </button>
            {note.isPublic && <button type="button" onClick={() => void copyPublicLink()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><Clipboard size={14} />Copy link</button>}
            <button
              type="button"
              onClick={() => appendInputRef.current?.click()}
              disabled={addingMore}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addingMore ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />}
              Add more
            </button>
            <button type="button" onClick={copyNotes} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={downloadNotes} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
              <BookOpenText size={14} />
              Export
            </button>
          </div>
        </div>
      </header>

      {copyError && <p role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">{copyError}</p>}
      {appendError && <p role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">{appendError}</p>}
      {shareError && <p role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">{shareError}</p>}
      {addingMore && (
        <div className="mb-5 rounded-xl border border-indigo-100 bg-white p-4">
          <TaskProgress steps={NOTES_PROGRESS_STEPS} activeStep={progressStep} />
          <p className="mt-2 text-right text-[11px] text-slate-400">New sections will be added to this note.</p>
        </div>
      )}

      <div role="group" aria-label="Choose what to view in your notes" className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={activeView === view.id}
            onClick={() => setActiveView(view.id)}
            className={"inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition " + (
              activeView === view.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {view.label}
            {view.count !== undefined && (
              <span className={"rounded-full px-1.5 py-0.5 text-[10px] " + (
                activeView === view.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>
                {view.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeView === "overview" && (
        <section aria-label="Note overview" className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700"><Sparkles size={16} /></span>
            <h2 className="text-sm font-semibold text-slate-800">Overview</h2>
          </div>
          <p className="text-sm leading-7 text-slate-600">{note.summary || "No overview is available for this note."}</p>
        </section>
      )}

      {activeView === "takeaways" && (
        <section aria-label="Key takeaways">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700"><Lightbulb size={16} /></span>
            <h2 className="text-sm font-semibold text-slate-800">Key takeaways</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {note.keyTakeaways.map((takeaway, index) => (
              <article key={`${index}-${takeaway.slice(0, 20)}`} className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-amber-700">{index + 1}</span>
                <p className="text-sm leading-6 text-slate-700">{takeaway}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeView === "terms" && (
        <section aria-label="Important terms">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-violet-100 text-violet-700"><Tag size={15} /></span>
            <h2 className="text-sm font-semibold text-slate-800">Important terms</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {note.keyTerms.map((item: NoteKeyTerm) => (
              <article key={item.term} className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-violet-800">{item.term}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.definition}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeView === "details" && (
        <section aria-label="Detailed notes">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-100 text-indigo-700"><BookOpenText size={16} /></span>
            <h2 className="text-sm font-semibold text-slate-800">Detailed notes</h2>
            <span className="text-xs text-slate-400">{note.sections.length} sections</span>
          </div>
          {renderPagination()}
          <div className="space-y-3">
            {visibleSections.map((section, index) => (
              <details key={`${index}-${section.heading}`} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">{String(sectionStart + index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold leading-6 text-slate-800">{section.heading}</span>
                    <span className="mt-1 block text-[11px] text-slate-400 group-open:hidden">Click to expand notes</span>
                    <span className="mt-1 hidden text-[11px] text-slate-400 group-open:block">Click to collapse notes</span>
                  </span>
                  <ChevronDown size={17} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                  <RichText text={section.content} />
                  {section.examples?.length ? (
                    <aside className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                      <h4 className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                        <Lightbulb size={14} />
                        Examples
                      </h4>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                        {section.examples.map((example, exampleIndex) => (
                          <li key={`${exampleIndex}-${example.slice(0, 24)}`} className="flex gap-2">
                            <span className="text-amber-500" aria-hidden="true">•</span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </aside>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
          <div className="mt-3">{renderPagination()}</div>
        </section>
      )}
    </div>
  );
}

function NotesDashboard() {
  const { user } = useAuth();
  return <NotesDashboardContent key={user?.uid ?? "signed-out"} />;
}

function NotesDashboardContent() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [actionNoteId, setActionNoteId] = useState<string | null>(null);
  const userUid = user?.uid;

  useEffect(() => {
    if (!userUid) {
      return;
    }

    let active = true;
    void getNotes(userUid)
      .then((result) => {
        if (active) {
          setNotes(result);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        console.error("Could not load notes dashboard.", error);
        if (active) setLoadError(error instanceof Error ? error.message : "Your notes couldn’t be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [userUid]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const filteredNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      [note.title, note.sourceName, note.summary, ...note.keyTerms.map((term) => term.term)]
        .join(" ").toLocaleLowerCase().includes(query),
    );
  }, [notes, search]);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setPageError("");
    setFile(null);
    const extension = nextFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      setPageError("Choose a PDF, PNG, JPG, WEBP, DOCX, PPTX, TXT, or Markdown file.");
      return;
    }
    if (nextFile.size === 0) {
      setPageError("That file is empty. Choose another file.");
      return;
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setPageError("That file is over 200 MB. Try a smaller file.");
      return;
    }
    setFile(nextFile);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !file) {
      setPageError("Choose a file before creating notes.");
      return;
    }
    setCreating(true);
    setProgressStep(0);
    setPageError("");
    const progressTimer = window.setInterval(
      () => setProgressStep((step) => Math.min(step + 1, NOTES_PROGRESS_STEPS.length - 1)),
      3500,
    );
    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { Authorization: ["Bearer", idToken].join(" ") },
        body: formData,
      });
      const result = (await response.json()) as { note?: SavedNote; error?: string };
      if (!response.ok || !result.note?.id) {
        throw new Error(result.error || "We couldn’t create notes from that file. Please try again.");
      }
      setNotes((current) => [result.note!, ...current]);
      setSelectedNoteId(result.note.id);
      setFile(null);
      setCreateOpen(false);
    } catch (error) {
      console.error("Could not create study notes.", error);
      setPageError(error instanceof Error ? error.message : "We couldn’t create notes from that file.");
    } finally {
      window.clearInterval(progressTimer);
      setCreating(false);
    }
  }

  async function handleAppend(noteId: string, file: File): Promise<SavedNote> {
    if (!user) throw new Error("Please sign in again before adding material.");
    const idToken = await user.getIdToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("noteId", noteId);
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { Authorization: ["Bearer", idToken].join(" ") },
      body: formData,
    });
    const result = (await response.json()) as { note?: SavedNote; error?: string };
    if (!response.ok || !result.note?.id) {
      throw new Error(result.error || "We couldn’t add material to this note. Please try again.");
    }
    setNotes((current) => current.map((note) => note.id === noteId ? result.note! : note));
    return result.note;
  }

  async function handleTogglePublic(note: SavedNote): Promise<SavedNote> {
    if (!user) throw new Error("Please sign in again before changing sharing settings.");
    if (!note.isPublic && !window.confirm("Publishing makes this note visible to everyone in Discover. You can make it private again at any time.")) {
      return note;
    }
    setActionNoteId(note.id);
    try {
      const result = await setNotePublic(user.uid, note.id, !note.isPublic);
      setNotes((current) => current.map((item) => item.id === note.id ? result.note : item));
      return result.note;
    } finally {
      setActionNoteId(null);
    }
  }

  async function handleRename(note: SavedNote) {
    if (!user) return;
    const title = window.prompt("Rename this note:", note.title);
    if (title === null || !title.trim() || title.trim() === note.title) return;
    setActionNoteId(note.id);
    setPageError("");
    try {
      const result = await renameNote(user.uid, note.id, title.trim());
      setNotes((current) => current.map((item) => item.id === note.id ? result.note : item));
    } catch (error) {
      console.error("Could not rename this note.", error);
      setPageError(error instanceof Error ? error.message : "This note couldn’t be renamed.");
    } finally {
      setActionNoteId(null);
    }
  }

  async function handleDelete(note: SavedNote) {
    if (!user || !window.confirm("Delete \"" + note.title + "\"? This cannot be undone.")) return;
    setActionNoteId(note.id);
    setPageError("");
    try {
      await deleteNote(user.uid, note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (selectedNoteId === note.id) setSelectedNoteId(null);
    } catch (error) {
      console.error("Could not delete this note.", error);
      setPageError(error instanceof Error ? error.message : "This note couldn’t be deleted.");
    } finally {
      setActionNoteId(null);
    }
  }

  function startNewNote() {
    setSelectedNoteId(null);
    setFile(null);
    setPageError("");
    setCreateOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6 sm:py-10 lg:px-8">
        {selectedNote ? (
          <NoteReader key={selectedNote.id} note={selectedNote} ownerUid={user?.uid ?? ""} onBack={() => setSelectedNoteId(null)} onAppend={handleAppend} onTogglePublic={handleTogglePublic} />
        ) : (
          <>
            <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
              <ArrowLeft size={15} />
              Dashboard
            </Link>
            <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                  <Sparkles size={12} />
                  Your study library
                </span>
                <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">My Notes</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">Keep your study material organized and easy to revisit.</p>
              </div>
              <button type="button" onClick={startNewNote} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                <Plus size={16} />
                Create notes
              </button>
            </header>

            {pageError && <p role="alert" className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{pageError}</p>}

            {createOpen && (
              <form onSubmit={handleCreate} className="mb-8 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Make a new set of notes</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-400">AI will organize your file into sections, key points, and terms.</p>
                  </div>
                  <button type="button" onClick={() => { setCreateOpen(false); setFile(null); setPageError(""); }} aria-label="Close upload form" className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    <X size={16} />
                  </button>
                </div>
                <input ref={inputRef} type="file" accept={ACCEPTED} onChange={handleFileChange} className="sr-only" aria-label="Choose a file to make notes from" />
                {file ? (
                  <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><FileText size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-700">{file.name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB · Processed temporarily</p>
                    </div>
                    <button type="button" onClick={() => { setFile(null); setPageError(""); }} disabled={creating} aria-label="Remove file" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"><X size={16} /></button>
                  </div>
                ) : (
                  <div
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={"rounded-2xl border border-dashed px-5 py-8 text-center transition " + (dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/60 hover:border-indigo-300")}
                  >
                    <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm"><FileUp size={20} /></span>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Drop a file here, or{" "}
                      <button type="button" onClick={() => inputRef.current?.click()} className="text-indigo-600 underline underline-offset-4">browse</button>
                    </p>
                    <p className="mt-1.5 text-xs text-slate-400">PDF, photos, DOCX, PPTX, TXT, Markdown · Up to 200 MB</p>
                  </div>
                )}
                {pageError && <p role="alert" className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{pageError}</p>}
                {creating ? (
                  <div className="mt-5">
                    <TaskProgress steps={NOTES_PROGRESS_STEPS} activeStep={progressStep} />
                    <p className="mt-2 text-right text-[11px] text-slate-400">Large files can take a little while to process.</p>
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] leading-5 text-slate-400">Your source file is processed temporarily and isn’t saved with your notes.</p>
                    <button type="submit" disabled={!file} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <Sparkles size={14} />
                      Create notes
                    </button>
                  </div>
                )}
              </form>
            )}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">All notes <span className="ml-1 font-normal text-slate-400">{notes.length}</span></h2>
              </div>
              {notes.length > 0 && (
                <label className="relative block w-full sm:w-64">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
                </label>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
                <LoaderCircle size={17} className="animate-spin text-indigo-500" />
                Loading your notes…
              </div>
            ) : loadError ? (
              <div role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">{loadError}</div>
            ) : filteredNotes.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <article key={note.id} className="group flex min-h-64 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                    <button type="button" onClick={() => { setSelectedNoteId(note.id); setPageError(""); }} className="flex flex-1 flex-col p-5 text-left">
                      <div className="mb-4 flex w-full items-start justify-between gap-3">
                        <span className={"grid size-11 place-items-center rounded-xl " + (["png", "jpg", "jpeg", "webp"].includes(note.sourceType) ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700")}>
                          {["png", "jpg", "jpeg", "webp"].includes(note.sourceType) ? <FileImage size={20} /> : <FileText size={20} />}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{FILE_LABELS[note.sourceType] ?? note.sourceType}</span>
                      </div>
                      <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-800 group-hover:text-indigo-700">{note.title}</h3>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{note.summary || note.sections[0]?.content || note.sourceName}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1"><BookOpenText size={12} />{note.sections.length} sections</span>
                        {note.keyTerms.length > 0 && <span className="inline-flex items-center gap-1"><Tag size={11} />{note.keyTerms.length} terms</span>}
                        <span className="inline-flex items-center gap-1"><Clock3 size={11} />{formattedDate(note.updatedAt)}</span>
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                      <p className="min-w-0 truncate pr-2 text-[10px] text-slate-400" title={note.sourceName}>{note.sourceName}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => void handleRename(note)} disabled={actionNoteId === note.id} aria-label="Rename note" title="Rename note" className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"><Pencil size={14} /></button>
                        <button type="button" onClick={() => void handleTogglePublic(note).catch((error: unknown) => setPageError(error instanceof Error ? error.message : "Sharing setting couldn’t be updated."))} disabled={actionNoteId === note.id} aria-label={note.isPublic ? "Make note private" : "Publish note"} title={note.isPublic ? "Public — click to make private" : "Publish note"} className={"grid size-8 place-items-center rounded-lg transition disabled:opacity-50 " + (note.isPublic ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600")}><Globe2 size={14} /></button>
                        <button type="button" onClick={() => void handleDelete(note)} disabled={actionNoteId === note.id} aria-label="Delete note" title="Delete note" className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={14} /></button>
                        <button type="button" onClick={() => setSelectedNoteId(note.id)} aria-label="Open note" title="Open note" className="grid size-8 place-items-center rounded-lg text-indigo-600 transition hover:bg-indigo-50"><ArrowRight size={15} /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><NotebookPen size={24} /></span>
                <h3 className="mt-4 text-base font-semibold text-slate-800">{search ? "No matching notes" : "Your notes library is empty"}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  {search ? "Try a different search or clear the search box." : "Create a set of organized study notes from a photo, PDF, presentation, or document."}
                </p>
                {!search && (
                  <button type="button" onClick={startNewNote} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700">
                    <Plus size={15} />
                    Create your first notes
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function NotesPage() {
  return <AuthGate><NotesDashboard /></AuthGate>;
}
