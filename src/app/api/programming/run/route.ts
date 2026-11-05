import JSZip from "jszip";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { verifyRequestUser } from "@/lib/server-auth";
import { PROGRAMMING_PROBLEMS } from "@/lib/programming-problems";
import { PROGRAMMING_TESTS } from "@/lib/programming-tests";
import type { PracticeLanguage } from "@/lib/programming-problems";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

export const maxDuration = 40;

const MAX_SOURCE_FILES = 8;
const MAX_FILE_CHARS = 20_000;
const MAX_TOTAL_CHARS = 50_000;
const MAX_OUTPUT_CHARS = 4_000;
const RUN_WINDOW_MS = 60_000;
const MAX_RUNS_PER_WINDOW = 3;

type SourceFile = { name: string; content: string };
type JudgeLanguage = { id: number; name: string; is_archived?: boolean };
type JudgeResult = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  status?: { id?: number; description?: string };
};

async function reserveRun(uid: string) {
  const now = Date.now();
  const windowStart = Math.floor(now / RUN_WINDOW_MS) * RUN_WINDOW_MS;
  const ref = getAdminDatabase().ref(`practiceRunnerLimits/${uid}`);
  const result = await ref.transaction((current) => {
    if (
      current &&
      current.windowStart === windowStart &&
      typeof current.count === "number" &&
      current.count >= MAX_RUNS_PER_WINDOW
    ) {
      return;
    }
    return {
      windowStart,
      count: current?.windowStart === windowStart && typeof current.count === "number"
        ? current.count + 1
        : 1,
    };
  });
  if (!result.committed) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + RUN_WINDOW_MS - now) / 1000));
    return { allowed: false as const, retryAfter };
  }
  return { allowed: true as const };
}

function encodeText(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeText(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  return Buffer.from(value, "base64").toString("utf8").slice(0, MAX_OUTPUT_CHARS);
}

function getRunnerConfig() {
  const rawUrl = process.env.CODE_RUNNER_URL?.trim();
  const token = process.env.CODE_RUNNER_TOKEN?.trim();
  if (!rawUrl || !token) {
    throw new Error("The self-hosted code runner is not configured. Set CODE_RUNNER_URL and CODE_RUNNER_TOKEN on the server.");
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("CODE_RUNNER_URL must be a valid HTTP or HTTPS URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("CODE_RUNNER_URL must be a base HTTP or HTTPS URL without credentials, query, or fragment.");
  }
  return { baseUrl: url.toString().replace(/\/+$/, ""), token };
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

async function getLanguageId(
  baseUrl: string,
  token: string,
  language: PracticeLanguage,
) {
  const response = await fetch(`${baseUrl}/languages`, {
    headers: { "X-Judge0-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`The self-hosted code runner returned HTTP ${response.status} while listing languages.`);
  }
  const languages = (await response.json()) as JudgeLanguage[];
  const pattern = language === "java" ? /^Java \(OpenJDK\b/i : /^C \(GCC\b/i;
  const match = languages.find(
    (item) => typeof item.id === "number" && !item.is_archived && pattern.test(item.name),
  );
  if (!match) {
    throw new Error(`The self-hosted runner has no active ${language === "java" ? "Java (OpenJDK)" : "C (GCC)"} language. Install it in Judge0 and try again.`);
  }
  return match.id;
}

function addExecutableFile(zip: JSZip, name: string, content: string) {
  zip.file(name, content, { unixPermissions: 0o755 });
}

async function makeWorkspace(files: SourceFile[], language: PracticeLanguage) {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.content);

  if (language === "java") {
    addExecutableFile(zip, "compile", "#!/bin/bash\nset -eu\njavac -encoding UTF-8 ./*.java\n");
    addExecutableFile(zip, "run", "#!/bin/bash\nset -eu\nexec java -cp . Main\n");
  } else {
    addExecutableFile(zip, "compile", "#!/bin/bash\nset -eu\ngcc -std=c17 -O2 -Wall -Wextra ./*.c -lm -o /tmp/recall-main\n");
    addExecutableFile(zip, "run", "#!/bin/bash\nset -eu\nexec /tmp/recall-main\n");
  }
  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
}

async function submitToRunner(
  baseUrl: string,
  token: string,
  languageId: number,
  archive: string,
  stdin: string,
  expectedOutput: string,
) {
  const response = await fetch(
    `${baseUrl}/submissions?base64_encoded=true&wait=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Judge0-Token": token,
      },
      body: JSON.stringify({
        source_code: encodeText(""),
        language_id: languageId,
        stdin: encodeText(stdin),
        expected_output: encodeText(expectedOutput),
        additional_files: archive,
        cpu_time_limit: 2,
        cpu_extra_time: 0.5,
        wall_time_limit: 5,
        memory_limit: 128_000,
        stack_limit: 64_000,
        max_file_size: 1_024,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    },
  );
  const body = (await response.json().catch(() => null)) as
    | (JudgeResult & { error?: string })
    | null;
  if (!response.ok || !body) {
    const detail = body?.error || `The self-hosted code runner returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return {
    statusId: body.status?.id ?? 0,
    status: body.status?.description || body.message || "Unknown runner status",
    stdout: decodeText(body.stdout),
    stderr: decodeText(body.stderr),
    compileOutput: decodeText(body.compile_output),
  };
}

export async function POST(request: Request) {
  if (!FEATURE_FLAGS.programmingPractice) {
    return Response.json(
      { error: "Programming practice is temporarily unavailable." },
      { status: 503 },
    );
  }

  const identity = await verifyRequestUser(request);
  if (!identity) {
    return Response.json({ error: "Please sign in before running code." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      problemId?: unknown;
      language?: unknown;
      files?: unknown;
    };
    if (
      typeof payload.problemId !== "string" ||
      !(payload.language === "java" || payload.language === "c") ||
      !Array.isArray(payload.files)
    ) {
      return Response.json({ error: "Choose a problem, language, and source files." }, { status: 400 });
    }
    const tests = PROGRAMMING_TESTS[payload.problemId];
    if (!tests) {
      return Response.json({ error: "That programming problem is not available." }, { status: 404 });
    }
    const language: PracticeLanguage = payload.language;
    const problem = PROGRAMMING_PROBLEMS.find((item) => item.id === payload.problemId);
    if (!problem?.supportedLanguages.includes(language)) {
      return Response.json(
        { error: `This problem is only available in ${problem?.supportedLanguages.join(" and ") || "its supported language"}.` },
        { status: 400 },
      );
    }
    if (payload.files.length < 1 || payload.files.length > MAX_SOURCE_FILES) {
      return Response.json({ error: `Add between 1 and ${MAX_SOURCE_FILES} source files.` }, { status: 400 });
    }

    const expectedMainFile = language === "java" ? "Main.java" : "main.c";
    const validExtension = language === "java" ? /\.java$/i : /\.(?:c|h)$/i;
    const names = new Set<string>();
    let totalChars = 0;
    const files: SourceFile[] = [];
    for (const item of payload.files) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.name !== "string" ||
        typeof item.content !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_-]{0,39}\.(?:java|c|h)$/i.test(item.name) ||
        !validExtension.test(item.name) ||
        item.content.length > MAX_FILE_CHARS ||
        names.has(item.name.toLowerCase())
      ) {
        return Response.json({ error: "Source filenames must be unique and use the selected language. Each file is limited to 20,000 characters." }, { status: 400 });
      }
      names.add(item.name.toLowerCase());
      totalChars += item.content.length;
      files.push({ name: item.name, content: item.content });
    }
    if (totalChars > MAX_TOTAL_CHARS) {
      return Response.json({ error: "Keep all source files under 50,000 characters total." }, { status: 413 });
    }
    if (!names.has(expectedMainFile.toLowerCase())) {
      return Response.json({ error: `The workspace must include ${expectedMainFile}.` }, { status: 400 });
    }

    const { baseUrl, token } = getRunnerConfig();
    const reservation = await reserveRun(identity.uid);
    if (!reservation.allowed) {
      return Response.json(
        { error: `You’ve reached the code runner limit. Try again in ${reservation.retryAfter} seconds.` },
        { status: 429, headers: { "Retry-After": String(reservation.retryAfter) } },
      );
    }
    const languageId = await getLanguageId(baseUrl, token, language);
    const archive = await makeWorkspace(files, language);
    const [sample, hidden] = await Promise.all([
      submitToRunner(baseUrl, token, languageId, archive, tests.sample.stdin, tests.sample.expected),
      submitToRunner(baseUrl, token, languageId, archive, tests.hidden.stdin, tests.hidden.expected),
    ]);
    if (sample.statusId === 6) {
      return Response.json({
        samplePassed: false,
        hiddenPassed: false,
        status: sample.status,
        stdout: sample.stdout,
        stderr: sample.stderr,
        compileOutput: sample.compileOutput,
      });
    }
    if (sample.statusId !== 3 || hidden.statusId === 6) {
      return Response.json({
        samplePassed: false,
        hiddenPassed: false,
        status: sample.statusId !== 3 ? sample.status : hidden.status,
        stdout: sample.stdout,
        stderr: sample.statusId !== 3 ? sample.stderr : hidden.stderr,
        compileOutput: sample.compileOutput || hidden.compileOutput,
      });
    }
    return Response.json({
      samplePassed: sample.statusId === 3,
      hiddenPassed: hidden.statusId === 3,
      status: hidden.status,
      stdout: sample.stdout,
      stderr: hidden.statusId === 3 ? "" : hidden.stderr,
      compileOutput: hidden.compileOutput,
    });
  } catch (error) {
    console.error("Could not run a programming practice submission.", error);
    const message = error instanceof Error ? error.message : "The code runner is unavailable. Please try again.";
    const status = message.includes("not configured") ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
