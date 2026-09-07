"use client";

import { useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  TerminalSquare,
  Terminal,
  Loader2,
  CircleDashed,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CadenceSettings } from "@/components/followups/cadence-settings";
import { persistCliId, readSavedCliId } from "@/lib/saved-cli";

type Cli = {
  id: string;
  name: string;
  run: string;
  url: string;
  installed: boolean;
  path: string | null;
};

type Mode = "cli" | "key" | "manual";

// The three standalone evaluators (gemini-eval.mjs / openai-eval.mjs /
// ollama-eval.mjs) — these score a JD against cv.md WITHOUT any AI CLI. The
// "key" mode wires them up so a non-technical user can pick a backend instead
// of installing an AI tool.
const PROVIDERS = [
  { id: "gemini", label: "Google (Gemini)", needsKey: true, needsUrl: false, hint: "Free tier available" },
  { id: "openai", label: "OpenAI-compatible", needsKey: true, needsUrl: true, hint: "OpenAI, OpenRouter, DeepSeek…" },
  { id: "ollama", label: "Local (Ollama)", needsKey: false, needsUrl: false, hint: "Free, fully offline" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

const STORAGE_KEY = "career-ops:config";

export function ConfigForm() {
  const [mode, setMode] = useState<Mode>("cli");
  const [clis, setClis] = useState<Cli[] | null>(null);
  const [cliId, setCliId] = useState<string>("");
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  // Load saved prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        // key/manual are now wired up: restore the mode and provider so the
        // user doesn't have to re-select them on every page load.
        if (v.mode === "cli") setMode("cli");
        if (v.mode === "key") setMode("key");
        if (v.mode === "manual") setMode("manual");
        if (v.cliId) setCliId(v.cliId);
        if (v.provider) setProvider(v.provider as ProviderId);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Detect installed CLIs
  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: Cli[] = d.clis ?? [];
        setClis(list);
        // Highlight + persist the only installed CLI when Config was never saved.
        // Highlight-only used to look configured while jobs still read empty localStorage.
        setCliId((prev) => {
          if (prev) return prev;
          const only = list.filter((c) => c.installed);
          if (only.length !== 1) return list.find((c) => c.installed)?.id || "";
          if (!readSavedCliId()) persistCliId(only[0].id);
          return only[0].id;
        });
      })
      .catch(() => setClis([]));
  }, []);

  async function save() {
    setSaving(true);
    // Persist UI prefs (mode/provider/logos) to localStorage — never the key.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, cliId, provider, logos }));

    // In "key" mode, write the key (and url/model) into the core's own .env via
    // /api/config/key — the single write path. The key never touches localStorage.
    if (mode === "key") {
      const backend = provider === "ollama" ? "ollama" : provider;
      try {
        const res = await fetch("/api/config/key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            backend,
            key: apiKey || undefined,
            url: apiUrl || undefined,
            model: apiModel || undefined,
          }),
        });
        if (!res.ok) {
          setSaved(false);
          setSaving(false);
          return;
        }
      } catch {
        setSaved(false);
        setSaving(false);
        return;
      }
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backend: provider,
          input: "This is a connection test. Reply with the single word: OK",
          key: apiKey || undefined,
          url: apiUrl || undefined,
          model: apiModel || undefined,
          test: true,
        }),
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  }

  const installed = clis?.filter((c) => c.installed) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Config</h1>
      <p className="mt-1 text-sm text-muted">
        Run career-ops on your own AI, right on your computer. Your CV and data never leave your machine.
      </p>

      {/* Engine mode */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        AI Engine
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <ModeCard
          active={mode === "cli"}
          onClick={() => setMode("cli")}
          icon={Terminal}
          title="Use an AI tool you have"
          hint="Recommended"
        />
        <ModeCard
          active={mode === "key"}
          onClick={() => setMode("key")}
          icon={KeyRound}
          title="Paste an AI key"
          hint="No AI tool needed"
        />
        <ModeCard
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon={TerminalSquare}
          title="No setup needed"
          hint="Local & free"
        />
      </div>

      <div className="mt-6">
        {mode === "cli" && (
          <div>
            <p className="mb-1 text-sm text-muted">
              career-ops uses an AI tool you already have — signed in, your own usage, nothing to paste.
            </p>
            <p className="mb-3 text-xs text-faint">Works with Claude Code, Codex, OpenCode and more — free ones work great.</p>
            {clis === null ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> Checking what&apos;s on your computer…
              </div>
            ) : installed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
                No AI tool yet? Free options like <span className="text-foreground">OpenCode</span> with Qwen or GLM work great.{" "}
                <a href="https://career-ops.org/docs/free-ai-engine" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">
                  Get one free <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {clis.map((c) => {
                  const selected = c.id === cliId;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                        selected
                          ? "border-brand/50 bg-brand-soft"
                          : c.installed
                            ? "border-border bg-surface/50"
                            : "border-border/60 bg-surface/20",
                      )}
                    >
                      {c.installed ? (
                        <Check className="size-4 shrink-0 text-emerald-400" />
                      ) : (
                        <CircleDashed className="size-4 shrink-0 text-faint" />
                      )}
                      <button
                        type="button"
                        disabled={!c.installed}
                        onClick={() => setCliId(c.id)}
                        className={cn(
                          "flex flex-1 items-center gap-2 text-left max-sm:min-h-[44px]",
                          c.installed ? "" : "cursor-default",
                        )}
                      >
                        <span
                          className={cn(
                            "font-medium",
                            selected ? "text-foreground" : c.installed ? "" : "text-muted",
                          )}
                        >
                          {c.name}
                        </span>
                        <span className="font-mono text-xs text-faint">{c.run}</span>
                      </button>
                      {c.installed ? (
                        <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-faint sm:block">
                          {c.path}
                        </span>
                      ) : (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center justify-center gap-1 text-xs text-brand hover:underline max-sm:min-h-[44px]"
                        >
                          Install <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
                {installed.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-xs text-muted">
                    No supported CLI found on your PATH. Install one (e.g. Claude Code, Gemini CLI, OpenCode) to get started.
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  Best on <span className="text-muted">Claude Code</span> (live progress, the agentic apply + AI search,
                  reliable evaluation persistence). Other CLIs work for the core flows with reduced features.
                </p>
              </div>
            )}
          </div>
        )}

        {mode === "key" && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Provider
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setTestResult(null);
                    }}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                      provider === p.id
                        ? "border-brand/50 bg-brand-soft text-foreground"
                        : "border-border bg-surface/50 text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <span className="block font-medium">{p.label}</span>
                    <span className="mt-0.5 block text-xs text-faint">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {provider === "ollama" ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
                <p className="font-medium text-foreground">Local &amp; free — nothing to paste.</p>
                <p className="mt-1 text-xs text-faint">
                  Uses <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-brand hover:underline">Ollama</a> running
                  on your computer. Install it, pull a model (e.g. <span className="font-mono">llama3.3</span>), and
                  evaluation runs fully offline — your CV and job text never leave your machine.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    API key
                  </label>
                  <p className="mb-2 text-xs text-faint">
                    {provider === "gemini"
                      ? "Get a free key at aistudio.google.com/apikey"
                      : "Bring a key from OpenAI, OpenRouter, DeepSeek, or any compatible endpoint."}
                  </p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === "gemini" ? "AIza…" : "sk-…"}
                    autoComplete="off"
                    className="w-full rounded-xl border border-border bg-surface/60 px-4 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50"
                  />
                </div>

                {provider === "openai" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Base URL <span className="font-normal normal-case text-faint">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        autoComplete="off"
                        className="w-full rounded-xl border border-border bg-surface/60 px-4 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Model <span className="font-normal normal-case text-faint">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={apiModel}
                        onChange={(e) => setApiModel(e.target.value)}
                        placeholder="gpt-4o-mini"
                        autoComplete="off"
                        className="w-full rounded-xl border border-border bg-surface/60 px-4 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50"
                      />
                    </div>
                  </>
                )}

                <p className="text-xs text-faint">
                  Stored only in your local <span className="font-mono">.env</span> file — never in the browser,
                  never sent anywhere but your chosen provider.
                </p>
              </>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={testConnection}
                disabled={testing}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-55 max-sm:min-h-[44px]"
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : null}
                {testing ? "Testing…" : "Test connection"}
              </button>
              {testResult === "ok" && (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
                  <Check className="size-4" /> Connected
                </span>
              )}
              {testResult === "fail" && (
                <span className="text-sm text-red-400">Connection failed — check your key.</span>
              )}
            </div>
          </div>
        )}

        {mode === "manual" && (
          <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
            <p className="font-medium text-foreground">No setup needed — local &amp; free.</p>
            <p className="mt-1 text-xs text-faint">
              This is the same as choosing <span className="text-foreground">Local (Ollama)</span> in the
              &ldquo;Paste an AI key&rdquo; tab. Pick that option to run evaluation fully offline with no key.
            </p>
          </div>
        )}
      </div>

      {/* Appearance / privacy */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Appearance
      </label>
      <button
        type="button"
        onClick={() => setLogos((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Company logos</span>
          <span className="mt-0.5 block text-xs text-faint">
            Show each company&apos;s real logo. Fetched once through your local server and cached on
            disk — only the employer domain is sent to a third party. Off = colored monograms only.
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            logos ? "bg-brand" : "bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              logos ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      <CadenceSettings />

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-55 max-sm:min-h-[44px]"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save config"}
        </button>
        <span className="text-xs text-faint">Local-first · your data stays on this machine</span>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-surface/30 opacity-55"
          : active
            ? "border-brand/50 bg-brand-soft"
            : "border-border bg-surface/50 hover:bg-surface-hover",
      )}
    >
      <Icon className={cn("size-4", active && !disabled ? "text-brand" : "text-muted")} />
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-xs text-faint">{hint}</span>
    </button>
  );
}
