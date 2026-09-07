import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Writes AI-provider keys into the core's own .env (the file the standalone
// evaluators read via dotenv). This is the single write path for keys: they
// never touch localStorage, and the web app never reimplements the evaluators'
// key resolution — it just puts the value where the core already looks.
//
// Merge-safe: only the keys named below are touched; every other line in .env
// (comments, other providers, plugin tokens) is preserved verbatim.

type KeyBody = {
  backend?: "gemini" | "openai";
  key?: string;
  url?: string; // OpenAI-compatible base URL
  model?: string;
};

// The env var each field maps to, per backend.
const ENV_VARS: Record<"gemini" | "openai", { key: string; url?: string; model?: string }> = {
  gemini: { key: "GEMINI_API_KEY", model: "GEMINI_MODEL" },
  openai: { key: "OPENAI_API_KEY", url: "OPENAI_BASE_URL", model: "OPENAI_MODEL" },
};

function envPath(): string {
  return path.join(careerOpsRoot(), ".env");
}

/** Merge `updates` (varName → value) into dotenv text, preserving all other lines. */
function mergeEnv(existing: string, updates: Record<string, string>): string {
  const lines = existing.split("\n");
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && updates[m[1]] !== undefined) {
      out.push(`${m[1]}=${updates[m[1]]}`);
      seen.add(m[1]);
    } else {
      out.push(line);
    }
  }

  // Append any requested vars that weren't already present.
  for (const [name, value] of Object.entries(updates)) {
    if (!seen.has(name)) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(`${name}=${value}`);
    }
  }

  return out.join("\n");
}

export async function POST(req: Request) {
  let body: KeyBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }

  const backend = body.backend ?? "gemini";
  const vars = ENV_VARS[backend];
  if (!vars) {
    return new Response(JSON.stringify({ error: `unknown backend '${backend}'` }), { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (body.key) updates[vars.key] = body.key;
  if (vars.url && body.url) updates[vars.url] = body.url;
  if (vars.model && body.model) updates[vars.model] = body.model;

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: "nothing to save" }), { status: 400 });
  }

  const file = envPath();
  let existing = "";
  try {
    existing = fs.readFileSync(file, "utf8");
  } catch {
    // No .env yet — start fresh (dotenv silently skips a missing file, so
    // creating one with only the requested keys is safe and non-clobbering).
  }

  const merged = mergeEnv(existing, updates);
  atomicWriteWithBackup(file, merged);

  return Response.json({ ok: true });
}

// Reports which keys are already set, WITHOUT returning their values — the
// frontend only needs to know "configured or not" to show a hint.
export async function GET() {
  const file = envPath();
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return Response.json({ gemini: false, openai: false });
  }
  const has = (name: string) => new RegExp(`^\\s*${name}\\s*=\\s*\\S`, "m").test(text);
  return Response.json({
    gemini: has("GEMINI_API_KEY"),
    openai: has("OPENAI_API_KEY"),
  });
}
