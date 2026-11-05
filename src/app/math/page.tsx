"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Eye,
  EyeOff,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { Navbar } from "@/components/Navbar";
import { PracticeNav } from "@/components/PracticeNav";
import { useAuth } from "@/context/AuthContext";
import {
  generatePracticeProblem,
  MATH_DIFFICULTIES,
  MATH_LESSONS,
  MATH_TOPICS,
  type GraphSpec,
  type MathDifficulty,
  type MathLesson,
  type MathProblem,
  type MathTopic,
} from "@/lib/mathPractice";

function CoordinatePlane({ graph }: { graph: GraphSpec }) {
  const width = 560;
  const height = 340;
  const pad = 32;
  const plotWidth = width - pad * 2;
  const plotHeight = height - pad * 2;
  const toX = (x: number) => pad + ((x + 10) / 20) * plotWidth;
  const toY = (y: number) => pad + ((10 - y) / 20) * plotHeight;
  const ticks = Array.from({ length: 21 }, (_, index) => index - 10);
  let plottedPath = "";

  if (graph.type === "line" || graph.type === "parabola") {
    plottedPath = ticks.map((x, index) => {
      const y = graph.type === "line"
        ? graph.slope * x + graph.intercept
        : graph.a * x * x + graph.b * x + graph.c;
      return `${index === 0 ? "M" : "L"} ${toX(x)} ${toY(y)}`;
    }).join(" ");
  }

  return (
    <figure className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <figcaption className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <span className="text-xs font-semibold text-slate-700">Cartesian plane</span>
        <span className="max-w-[65%] truncate text-right font-mono text-[10px] text-slate-500">{graph.equation}</span>
      </figcaption>
      <div className="bg-gradient-to-b from-slate-50 to-white p-2 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Cartesian coordinate plane showing ${graph.equation}`}
          className="h-auto w-full"
        >
          <defs>
            <clipPath id="math-graph-clip">
              <rect x={pad} y={pad} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>
          <rect x={pad} y={pad} width={plotWidth} height={plotHeight} rx="10" fill="white" />
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={toX(tick)} y1={pad} x2={toX(tick)} y2={height - pad} stroke={tick === 0 ? "#64748b" : "#e2e8f0"} strokeWidth={tick === 0 ? 1.5 : 0.8} />
              <line x1={pad} y1={toY(tick)} x2={width - pad} y2={toY(tick)} stroke={tick === 0 ? "#64748b" : "#e2e8f0"} strokeWidth={tick === 0 ? 1.5 : 0.8} />
              {tick % 2 === 0 && (
                <>
                  <text x={toX(tick)} y={toY(0) + 17} textAnchor="middle" className="fill-slate-500 text-[10px]">{tick}</text>
                  {tick !== 0 && <text x={toX(0) - 8} y={toY(tick) + 3} textAnchor="end" className="fill-slate-500 text-[10px]">{tick}</text>}
                </>
              )}
            </g>
          ))}
          <text x={width - pad + 6} y={toY(0) + 4} className="fill-slate-600 text-[11px]">x</text>
          <text x={toX(0) + 5} y={pad - 8} className="fill-slate-600 text-[11px]">y</text>
          <g clipPath="url(#math-graph-clip)">
            {(graph.type === "line" || graph.type === "parabola") && (
              <path d={plottedPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {graph.type === "points" && graph.points.map((point, index) => (
              <g key={`${point.x},${point.y},${index}`}>
                <line x1={toX(0)} y1={toY(0)} x2={toX(point.x)} y2={toY(point.y)} stroke="#c7d2fe" strokeWidth="2" strokeDasharray="5 5" />
                <circle cx={toX(point.x)} cy={toY(point.y)} r="5" fill="#4f46e5" stroke="white" strokeWidth="2" />
                {point.label && (
                  <text x={toX(point.x) + 9} y={toY(point.y) - 8} className="fill-indigo-700 text-[12px] font-semibold">{point.label}</text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  );
}

function MathPractice() {
  const { user } = useAuth();
  const [topic, setTopic] = useState<MathTopic>("calculus");
  const [difficulty, setDifficulty] = useState<MathDifficulty>("Advanced");
  const [lessonId, setLessonId] = useState("derivative-rules");
  const [customTopic, setCustomTopic] = useState("");
  const [problem, setProblem] = useState<MathProblem>(() =>
    generatePracticeProblem("calculus", "Advanced"),
  );
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  function resetAttempt() {
    setSelected("");
    setChecked(false);
    setShowSolution(false);
    setError("");
  }

  function nextProblem() {
    setProblem(generatePracticeProblem(topic, difficulty));
    resetAttempt();
  }

  const lessons: MathLesson[] = topic === "mixed" ? [] : MATH_LESSONS[topic];
  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId) ?? lessons[0];

  async function generateAiProblem() {
    if (!user || aiLoading) return;
    const requestedTopic = customTopic.trim()
      ? `${selectedLesson ? `${selectedLesson.title}: ` : ""}${customTopic.trim()}`
      : selectedLesson
        ? `${selectedLesson.title}. ${selectedLesson.practicePrompt}`
        : MATH_TOPICS.find((item) => item.value === topic)?.label || "General mathematics";
    setAiLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/math/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: requestedTopic, difficulty }),
      });
      const payload = (await response.json()) as { problem?: MathProblem; error?: string };
      if (!response.ok || !payload.problem) {
        throw new Error(payload.error || "A new problem couldn’t be generated.");
      }
      setProblem(payload.problem);
      resetAttempt();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "A new problem couldn’t be generated.");
    } finally {
      setAiLoading(false);
    }
  }

  const isCorrect = checked && selected.toLocaleLowerCase() === problem.answer.toLocaleLowerCase();
  const topicLabel = MATH_TOPICS.find((item) => item.value === topic)?.label ?? topic;

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-7 pb-16 sm:px-6 lg:px-8">
        <PracticeNav active="math" />
        <header className="mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 px-6 py-8 text-white shadow-lg shadow-indigo-200/50 sm:px-9 sm:py-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-50">
                <Sparkles size={13} /> The math studio
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Explore all of mathematics.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
                From foundational number sense to advanced calculus, proof techniques, and custom AI-created challenges.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <span className="grid size-10 place-items-center rounded-xl bg-white/15"><Target size={19} /></span>
              <span>
                <span className="block text-lg font-semibold">{solvedCount}</span>
                <span className="block text-[10px] text-indigo-100">correct answers</span>
              </span>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Compass size={16} /></span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Build a practice set</h2>
                  <p className="text-[10px] text-slate-400">Choose a field and level</p>
                </div>
              </div>
              <label className="mt-5 grid gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Mathematics field
                <span className="relative">
                  <select
                    value={topic}
                    onChange={(event) => {
                      const nextTopic = event.target.value as MathTopic;
                      setTopic(nextTopic);
                      setLessonId(nextTopic === "mixed" ? "" : MATH_LESSONS[nextTopic][0]?.id ?? "");
                      setProblem(generatePracticeProblem(nextTopic, difficulty));
                      resetAttempt();
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {MATH_TOPICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </span>
              </label>
              <label className="mt-4 grid gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Lesson
                <span className="relative">
                  <select
                    value={selectedLesson?.id ?? ""}
                    disabled={!lessons.length}
                    onChange={(event) => setLessonId(event.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {lessons.length
                      ? lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)
                      : <option value="">Choose a field to see lessons</option>}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </span>
              </label>
              {selectedLesson ? (
                <section aria-label={`Lesson: ${selectedLesson.title}`} className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <h3 className="text-xs font-semibold text-indigo-950">{selectedLesson.title}</h3>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">{selectedLesson.overview}</p>
                  <ul className="mt-3 space-y-1.5">
                    {selectedLesson.keyIdeas.map((idea) => (
                      <li key={idea} className="flex gap-2 text-[10px] leading-4 text-slate-600">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-indigo-500" />
                        {idea}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 rounded-lg bg-white/80 p-2.5 text-[10px] leading-4 text-slate-600">
                    <span className="font-semibold text-indigo-800">Example: </span>{selectedLesson.example}
                  </p>
                  <button
                    type="button"
                    onClick={() => void generateAiProblem()}
                    disabled={aiLoading}
                    className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-[10px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70"
                  >
                    {aiLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Practice this lesson
                  </button>
                </section>
              ) : (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[10px] leading-4 text-slate-500">
                  Choose a math field to browse its lessons. Mixed practice includes problems from every field.
                </p>
              )}
              <label className="mt-4 grid gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Challenge level
                <span className="relative">
                  <select
                    value={difficulty}
                    onChange={(event) => {
                      const nextDifficulty = event.target.value as MathDifficulty;
                      setDifficulty(nextDifficulty);
                      setProblem(generatePracticeProblem(topic, nextDifficulty));
                      resetAttempt();
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {MATH_DIFFICULTIES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </span>
              </label>
              <button
                type="button"
                onClick={nextProblem}
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <RefreshCw size={14} /> New practice problem
              </button>
            </section>

            <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-white text-violet-600 shadow-sm"><Sparkles size={16} /></span>
                <div>
                  <h2 className="text-sm font-semibold text-violet-950">Make it your own</h2>
                  <p className="text-[10px] text-violet-700/70">Ask AI for a fresh challenge</p>
                </div>
              </div>
              <label className="mt-4 grid gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800/70">
                Topic or concept
                <input
                  value={customTopic}
                  onChange={(event) => setCustomTopic(event.target.value.slice(0, 120))}
                  maxLength={120}
                  placeholder={selectedLesson ? `Specific focus within ${selectedLesson.title}` : "e.g. Fourier analysis"}
                  className="h-11 rounded-xl border border-violet-200 bg-white px-3 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </label>
              <button
                type="button"
                onClick={() => void generateAiProblem()}
                disabled={aiLoading}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70"
              >
                {aiLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiLoading ? "Creating a checked problem…" : selectedLesson ? "Generate lesson problem" : "Generate with AI"}
              </button>
              <p className="mt-2 text-[10px] leading-4 text-violet-900/60">
                Uses your account’s monthly AI generation allowance. AI problems include worked solutions.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2.5">
                <CircleHelp size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <p className="text-[10px] leading-5 text-slate-500">
                  Need a niche subject? Enter it above—such as topology, Fourier analysis, or a specific theorem—and ask AI to make a focused problem.
                </p>
              </div>
            </section>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700">{problem.topic}</span>
                <span className="rounded-full bg-slate-200/70 px-3 py-1 text-[10px] font-medium text-slate-600">{problem.difficulty}</span>
                {problem.source === "ai" && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-semibold text-violet-700"><Sparkles size={11} /> AI generated</span>}
              </div>
              <span className="text-[10px] font-medium text-slate-400">Practice · {topic === "mixed" ? "Mixed topics" : topicLabel}</span>
            </div>

            <div className="p-5 sm:p-7 lg:p-9">
              {error && (
                <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                  {error}
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">Q</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Challenge</p>
                  <h2 className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-900 sm:text-xl">{problem.question}</h2>
                </div>
              </div>

              {problem.graph && <CoordinatePlane graph={problem.graph} />}

              <fieldset className="mt-7 grid gap-3 sm:grid-cols-2" disabled={checked}>
                <legend className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Choose your answer</legend>
                {problem.choices.map((choice, index) => {
                  const chosen = selected === choice;
                  const correctChoice = checked && choice.toLocaleLowerCase() === problem.answer.toLocaleLowerCase();
                  const incorrectChoice = checked && chosen && !isCorrect;
                  const style = correctChoice
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : incorrectChoice
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : chosen
                        ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40";
                  return (
                    <label key={`${index}-${choice}`} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${style}`}>
                      <input type="radio" name="math-answer" value={choice} checked={chosen} onChange={() => setSelected(choice)} className="accent-indigo-600" />
                      <span className="min-w-0 flex-1 font-medium">{choice}</span>
                      {correctChoice && <Check size={16} className="shrink-0 text-emerald-600" />}
                    </label>
                  );
                })}
              </fieldset>

              {checked && (
                <div role="status" className={`mt-5 rounded-xl border px-4 py-3 ${isCorrect ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className={`text-xs font-semibold ${isCorrect ? "text-emerald-800" : "text-amber-800"}`}>
                    {isCorrect ? "Correct—well reasoned!" : `Not quite. The answer is ${problem.answer}.`}
                  </p>
                  <p className="mt-1 text-[10px] leading-5 text-slate-600">Reveal the worked solution below to review the reasoning.</p>
                </div>
              )}

              {showSolution && (
                <section aria-label="Worked solution" className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-white text-indigo-600 shadow-sm"><Lightbulb size={14} /></span>
                    <h3 className="text-xs font-semibold text-indigo-950">Worked solution</h3>
                  </div>
                  <ol className="mt-4 space-y-3">
                    {problem.solution.map((step, index) => (
                      <li key={`${index}-${step}`} className="flex gap-3 text-xs leading-6 text-slate-700">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 border-t border-indigo-100 pt-3 text-xs font-semibold text-indigo-900">Answer: {problem.answer}</p>
                </section>
              )}

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowSolution((current) => !current)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  aria-expanded={showSolution}
                >
                  {showSolution ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showSolution ? "Hide solution" : "Show solution"}
                </button>
                <div className="flex flex-wrap gap-2">
                  {!checked ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!selected) return;
                        setChecked(true);
                        if (selected.toLocaleLowerCase() === problem.answer.toLocaleLowerCase()) {
                          setSolvedCount((current) => current + 1);
                        }
                      }}
                      disabled={!selected}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check size={14} /> Check answer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={nextProblem}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Another problem <ArrowRight size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={nextProblem}
                    aria-label="Skip to a new problem"
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="mt-5 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <Lightbulb size={17} className="mt-0.5 shrink-0 text-indigo-600" />
          <p className="text-xs leading-5 text-indigo-950/75">
            Try the problem first, then check your answer or reveal the solution whenever you’re ready. AI-generated problems count toward your monthly generation limit.
          </p>
        </aside>
      </main>
    </div>
  );
}

export default function MathPage() {
  return <AuthGate><MathPractice /></AuthGate>;
}
