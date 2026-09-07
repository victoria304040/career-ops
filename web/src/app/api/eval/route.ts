import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { careerOpsRoot, rootScript } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // a real evaluation is heavy and multi-step

// The three standalone evaluators (gemini-eval.mjs / openai-eval.mjs /
// ollama-eval.mjs) score a JD against cv.md WITHOUT any AI CLI installed. They
// read modes/oferta.md + modes/_shared.md + cv.md, and write reports/ + the
// tracker themselves through the core's own single write path — so this route
// orchestrates the core, it never reimplements it (web/AGENTS.md rule #1).

type EvalBackend = "gemini" | "openai" | "ollama";

type EvalBody = {
  backend?: EvalBackend;
  input?: string;
  postingUrl?: string;
  model?: string;
  url?: string; // OpenAI-compatible base URL
  key?: string; // API key (never persisted; passed to the child only)
  test?: boolean; // connection test: skip cv.md guard + don't save a report
};

const SCRIPT: Record<EvalBackend, string> = {
  gemini: "gemini-eval.mjs",
  openai: "openai-eval.mjs",
  ollama: "ollama-eval.mjs",
};

// A posting URL is the tracker's dedup key; only accept a complete http(s) URL
// (mirrors the evaluators' own isPostingUrl guard).
function isPostingUrl(v: string): boolean {
  return /^https?:\/\/\S+$/i.test(v);
}

export async function POST(req: Request) {
  let body: EvalBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }

  const backend: EvalBackend = body.backend ?? "gemini";
  const input = body.input?.trim();
  if (!input) {
    return new Response(JSON.stringify({ error: "input (job description) required" }), { status: 400 });
  }
  if (!SCRIPT[backend]) {
    return new Response(JSON.stringify({ error: `unknown backend '${backend}'` }), { status: 400 });
  }

  const root = careerOpsRoot();
  const script = rootScript(SCRIPT[backend]);
  if (!fs.existsSync(script)) {
    return new Response(
      JSON.stringify({ error: `This needs a complete career-ops checkout (${SCRIPT[backend]}).` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // A score is meaningless without a CV to score against (same guard as /api/run).
  // A connection test doesn't need a CV — it only proves the key/endpoint works.
  if (!body.test && !fs.existsSync(path.join(root, "cv.md"))) {
    return new Response(
      JSON.stringify({ error: "Add your CV first so I can score this against you — drop it on the home page." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Write the JD to a temp file and pass --file: avoids command-line length
  // limits and any shell-injection surface from pasted job text.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-eval-"));
  const jdFile = path.join(tmpDir, "jd.txt");
  fs.writeFileSync(jdFile, input, "utf8");

  const args: string[] = ["--file", jdFile];
  if (body.postingUrl && isPostingUrl(body.postingUrl)) {
    args.push("--posting-url", body.postingUrl);
  }
  if (body.model) {
    args.push("--model", body.model);
  }
  if (backend === "openai" && body.url) {
    args.push("--url", body.url);
  }
  if (backend === "openai" && body.key) {
    args.push("--key", body.key);
  }
  if (body.test) {
    args.push("--no-save");
  }

  // Pass the data root explicitly so the evaluator writes to the same files the
  // web app reads, regardless of the child's cwd. Keys are passed via env only
  // (gemini has no --key flag) and never written to disk.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CAREER_OPS_ROOT: root,
  };
  if (backend === "gemini" && body.key) {
    env.GEMINI_API_KEY = body.key;
  }

  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          /* client gone */
        }
      };
      child.stdout.on("data", (chunk: string) => send(chunk));
      child.stderr.on("data", (chunk: string) => send(chunk));
      child.on("error", (err) => send(`\n[error] ${err.message}\n`));
      child.on("close", (code) => {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        if (code !== 0) {
          send(`\n[exited with code ${code}]\n`);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
