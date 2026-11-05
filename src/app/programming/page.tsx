"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  FilePlus2,
  LoaderCircle,
  Play,
  RotateCcw,
  Terminal,
  Trash2,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useAuth } from "@/context/AuthContext";
import {
  createStarterFiles,
  PROGRAMMING_PROBLEMS,
  type ProgrammingCategory,
  type PracticeLanguage,
} from "@/lib/programming-problems";
import { PracticeNav } from "@/components/PracticeNav";

type WorkspaceFile = { name: string; content: string };
type RunResult = {
  samplePassed: boolean;
  hiddenPassed: boolean;
  status: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
};

function ProgrammingPractice() {
  const { user } = useAuth();
  const [language, setLanguage] = useState<PracticeLanguage>("java");
  const [category, setCategory] = useState<ProgrammingCategory | "all">("Fundamentals");
  const [problemId, setProblemId] = useState(PROGRAMMING_PROBLEMS[0].id);
  const [files, setFiles] = useState<WorkspaceFile[]>(() =>
    createStarterFiles(PROGRAMMING_PROBLEMS[0].id, "java"),
  );
  const [activeFile, setActiveFile] = useState("Main.java");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);

  const problem = useMemo(
    () => PROGRAMMING_PROBLEMS.find((item) => item.id === problemId) ?? PROGRAMMING_PROBLEMS[0],
    [problemId],
  );
  const visibleProblems = useMemo(
    () => PROGRAMMING_PROBLEMS.filter((item) =>
      (category === "all" || item.category === category) &&
      item.supportedLanguages.includes(language),
    ),
    [category, language],
  );
  const activeSource = files.find((file) => file.name === activeFile);

  function chooseProblem(nextProblemId: string) {
    const nextProblem = PROGRAMMING_PROBLEMS.find((item) => item.id === nextProblemId);
    if (!nextProblem) return;
    setCategory(nextProblem.category);
    setProblemId(nextProblemId);
    const nextLanguage = nextProblem.supportedLanguages.includes(language)
      ? language
      : nextProblem.supportedLanguages[0];
    setLanguage(nextLanguage);
    const starter = createStarterFiles(nextProblemId, nextLanguage);
    setFiles(starter);
    setActiveFile(starter[0]?.name ?? "");
    setResult(null);
    setError("");
  }

  function chooseLanguage(nextLanguage: PracticeLanguage) {
    let nextProblem = problem;
    if (!problem.supportedLanguages.includes(nextLanguage)) {
      nextProblem = PROGRAMMING_PROBLEMS.find((item) =>
        item.category === category && item.supportedLanguages.includes(nextLanguage),
      ) ?? PROGRAMMING_PROBLEMS.find((item) => item.supportedLanguages.includes(nextLanguage)) ?? problem;
      setProblemId(nextProblem.id);
      setCategory(nextProblem.category);
    }
    setLanguage(nextLanguage);
    const starter = createStarterFiles(nextProblem.id, nextLanguage);
    setFiles(starter);
    setActiveFile(starter[0]?.name ?? "");
    setResult(null);
    setError("");
  }

  function chooseCategory(nextCategory: ProgrammingCategory | "all") {
    setCategory(nextCategory);
    const nextProblem = PROGRAMMING_PROBLEMS.find((item) =>
      (nextCategory === "all" || item.category === nextCategory) &&
      item.supportedLanguages.includes(language),
    ) ?? PROGRAMMING_PROBLEMS.find((item) =>
      nextCategory === "DSA" && item.category === "DSA" ||
      nextCategory === "OOP" && item.category === "OOP" ||
      nextCategory === "Fundamentals" && item.category === "Fundamentals" ||
      nextCategory === "all",
    );
    if (!nextProblem) return;
    const nextLanguage = nextProblem.supportedLanguages.includes(language)
      ? language
      : nextProblem.supportedLanguages[0];
    setLanguage(nextLanguage);
    setProblemId(nextProblem.id);
    const starter = createStarterFiles(nextProblem.id, nextLanguage);
    setFiles(starter);
    setActiveFile(starter[0]?.name ?? "");
    setResult(null);
    setError("");
  }

  function addFile() {
    const extension = language === "java" ? ".java" : ".c";
    const baseName = language === "java" ? "Helper" : "helper";
    let suffix = 1;
    let name = `${baseName}${extension}`;
    while (files.some((file) => file.name.toLowerCase() === name.toLowerCase())) {
      suffix += 1;
      name = `${baseName}${suffix}${extension}`;
    }
    if (files.length >= 8) {
      setError("A workspace can contain up to 8 source files.");
      return;
    }
    setFiles((current) => [...current, { name, content: "" }]);
    setActiveFile(name);
    setError("");
    setResult(null);
  }

  function removeFile(name: string) {
    if (name === (language === "java" ? "Main.java" : "main.c")) return;
    const remaining = files.filter((file) => file.name !== name);
    setFiles(remaining);
    if (activeFile === name) setActiveFile(remaining[0]?.name ?? "");
    setResult(null);
  }

  function updateSource(content: string) {
    setFiles((current) => current.map((file) =>
      file.name === activeFile ? { ...file, content } : file,
    ));
    setResult(null);
  }

  async function runCode() {
    if (!user || running) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/programming/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ problemId, language, files }),
      });
      const payload = (await response.json()) as RunResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The code runner couldn’t run your program.");
      setResult(payload);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The code runner couldn’t run your program.");
    } finally {
      setRunning(false);
    }
  }

  function resetCode() {
    const starter = createStarterFiles(problemId, language);
    setFiles(starter);
    setActiveFile(starter[0]?.name ?? "");
    setResult(null);
    setError("");
  }

  if (!FEATURE_FLAGS.programmingPractice) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">Programming practice is temporarily unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              We’ve paused programming practice for now. Your other study tools, including math practice, are still available.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a href="/math" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                Practice math
              </a>
              <a href="/dashboard" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Dashboard
              </a>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
        <PracticeNav active="programming" />
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            <Code2 size={13} /> Programming practice
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Practice coding</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Solve a problem, work across multiple source files, and run your Java or C program against sample and hidden tests.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label htmlFor="problem-choice" className="text-xs font-semibold text-slate-700">Choose a problem</label>
              <div className="relative mt-2">
                <select
                  aria-label="Practice category"
                  value={category}
                  onChange={(event) => chooseCategory(event.target.value as ProgrammingCategory | "all")}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="all">All categories</option>
                  <option value="Fundamentals">Programming fundamentals</option>
                  <option value="OOP">OOP and inheritance</option>
                  <option value="DSA">Data structures and algorithms (C)</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative mt-2">
                <select
                  id="problem-choice"
                  value={problemId}
                  onChange={(event) => chooseProblem(event.target.value)}
                  disabled={!visibleProblems.length}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                >
                  {visibleProblems.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">{problem.topic}</span>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700">{problem.category}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">{problem.difficulty}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">{problem.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">{problem.description}</p>
              <h3 className="mt-5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Input</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{problem.input}</p>
              <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">Output</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{problem.output}</p>
              <h3 className="mt-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">Example</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <CodeSample label="Input" value={problem.sampleInput} />
                <CodeSample label="Output" value={problem.sampleOutput} />
              </div>
            </section>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <label htmlFor="language-choice" className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Language</label>
                <div className="relative">
                  <select
                    id="language-choice"
                    value={language}
                    onChange={(event) => chooseLanguage(event.target.value as PracticeLanguage)}
                    className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-300"
                  >
                    <option value="java" disabled={!problem.supportedLanguages.includes("java")}>Java</option>
                    <option value="c" disabled={!problem.supportedLanguages.includes("c")}>C</option>
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <button type="button" onClick={resetCode} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100">
                <RotateCcw size={13} /> Reset starter
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-2 pt-2">
              {files.map((file) => (
                <div key={file.name} className={"flex shrink-0 items-center rounded-t-lg border border-b-0 " + (
                  activeFile === file.name ? "border-slate-200 bg-white" : "border-transparent"
                )}>
                  <button type="button" onClick={() => setActiveFile(file.name)} className={"h-9 px-3 text-[11px] font-medium " + (
                    activeFile === file.name ? "text-indigo-700" : "text-slate-500 hover:text-slate-800"
                  )}>{file.name}</button>
                  {file.name !== (language === "java" ? "Main.java" : "main.c") && (
                    <button type="button" onClick={() => removeFile(file.name)} aria-label={`Remove ${file.name}`} className="mr-1 grid size-6 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addFile} aria-label="Add source file" title="Add another source file" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600">
                <FilePlus2 size={15} />
              </button>
            </div>

            <div className="relative">
              <label htmlFor="source-editor" className="sr-only">Source code in {activeFile}</label>
              <textarea
                id="source-editor"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                value={activeSource?.content ?? ""}
                onChange={(event) => updateSource(event.target.value)}
                className="min-h-[420px] w-full resize-y bg-slate-950 p-4 font-mono text-[13px] leading-6 text-slate-100 outline-none selection:bg-indigo-500/40"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="text-[10px] text-slate-400">{files.length}/8 files · Execution is isolated by your self-hosted runner.</p>
              <button type="button" onClick={() => void runCode()} disabled={running} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                {running ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
                {running ? "Compiling and testing…" : "Run tests"}
              </button>
            </div>

            {(error || result) && (
              <section aria-live="polite" className="border-t border-slate-200 bg-white p-4">
                {error ? (
                  <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{error}</p>
                ) : result ? (
                  <div className="space-y-3">
                    <div className={"flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold " + (
                      result.samplePassed && result.hiddenPassed
                        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                        : "border-amber-100 bg-amber-50 text-amber-800"
                    )}>
                      {result.samplePassed && result.hiddenPassed ? <Check size={15} /> : <Terminal size={15} />}
                      {result.samplePassed && result.hiddenPassed
                        ? "All tests passed"
                        : `Tests not passed · ${result.status}`}
                      <span className="ml-auto text-[10px] font-medium opacity-80">
                        Sample {result.samplePassed ? "passed" : "failed"} · Hidden {result.hiddenPassed ? "passed" : "failed"}
                      </span>
                    </div>
                    {result.compileOutput && <OutputPanel label="Compiler output" value={result.compileOutput} />}
                    {result.stderr && <OutputPanel label="Program error" value={result.stderr} />}
                    {result.stdout && <OutputPanel label="Sample run output" value={result.stdout} />}
                  </div>
                ) : null}
              </section>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function CodeSample({ label, value }: { label: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-5 text-slate-700">{value}</pre>
    </div>
  );
}

function OutputPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <p className="bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">{label}</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-5 text-slate-700">{value}</pre>
    </div>
  );
}

export default function ProgrammingPage() {
  return <AuthGate><ProgrammingPractice /></AuthGate>;
}
