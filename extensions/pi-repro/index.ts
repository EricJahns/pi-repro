/**
 * pi-repro — reproduce the quantitative results of an academic paper.
 *
 * This extension is domain-agnostic machinery: it scaffolds a `.repro/` session,
 * tracks the paper's claims and how our reproduction compares, runs reproduction
 * commands, and surfaces a live status dashboard. The domain knowledge — how to
 * read a paper, gap-analyze the code, and run experiments — lives in the skills.
 */
import { existsSync, writeFileSync } from "node:fs";
import type {
  AgentToolResult,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

import {
  CLAIM_STATUSES,
  compare,
  readClaims,
  STATUS_GLYPH,
  summarize,
  upsertClaim,
  writeClaims,
  type Claim,
  type ClaimStatus,
} from "./claims.ts";
import { makeConfig, readConfig, writeConfig } from "./config.ts";
import { buildFullscreenLines } from "./dashboard.ts";
import { appendLog } from "./jsonl.ts";
import { ensureReproDirs, hasReproSession, reproPaths } from "./paths.ts";
import { refreshWidget, textResult, WIDGET_KEY } from "./render.ts";
import { resolveRoot, runtimeStore, sessionKey } from "./runtime.ts";
import { loadShortcuts } from "./shortcuts.ts";

const MAX_OUTPUT_CHARS = 16_000;

const truncate = (s: string): string =>
  s.length <= MAX_OUTPUT_CHARS
    ? s
    : s.slice(0, MAX_OUTPUT_CHARS) + `\n…[truncated ${s.length - MAX_OUTPUT_CHARS} chars]`;

function claimsTable(claims: Claim[]): string {
  if (claims.length === 0) return "(no claims registered)";
  const lines = claims.map((c) => {
    const rep = c.reproduced_value === undefined ? "—" : String(c.reproduced_value);
    return `  ${STATUS_GLYPH[c.status]} ${c.id} [${c.status}] — ${c.metric_name}: reported ${c.reported_value}${c.unit ?? ""}, reproduced ${rep}${c.reproduced_value !== undefined ? (c.unit ?? "") : ""}`;
  });
  const s = summarize(claims);
  lines.push(
    `  totals: ${s.reproduced} reproduced / ${s.partial} partial / ${s.mismatch} mismatch / ${s.blocked} blocked / ${s.pending} pending (of ${s.total})`,
  );
  return lines.join("\n");
}

export default function reproExtension(pi: ExtensionAPI): void {
  // ── init_reproduction ────────────────────────────────────────────────────
  const InitParams = Type.Object({
    name: Type.String({ description: "Human-readable name for this reproduction session, e.g. 'ResNet CIFAR-10 reproduction'." }),
    paper_source: Type.String({ description: "The paper: an arXiv id/URL, DOI, web URL, or local PDF path." }),
    repo_url: Type.Optional(Type.String({ description: "Optional reference implementation (GitHub URL or local path) to start from. Even when given, expect it to be incomplete — verify what is and isn't implemented." })),
    default_tolerance: Type.Optional(Type.Number({ description: "Default relative tolerance for matching reported values (fraction, e.g. 0.05 = 5%). Defaults to 0.05." })),
    max_claim_loop_iters: Type.Optional(Type.Number({ description: "Max iterations for the optional per-claim debug loop. Defaults to 8." })),
    working_dir: Type.Optional(Type.String({ description: "Directory in which reproduction commands run. Defaults to the project root." })),
  });

  pi.registerTool({
    name: "init_reproduction",
    label: "Init reproduction",
    description:
      "Scaffold a .repro/ session for reproducing a paper. Idempotent: if a session already exists it is reported, not overwritten. Call this once at the start.",
    parameters: InitParams,
    async execute(_id, params: Static<typeof InitParams>, _signal, _onUpdate, ctx): Promise<AgentToolResult<{ created: boolean; dir: string }>> {
      const root = params.working_dir ?? ctx.cwd;
      const p = reproPaths(root);
      const existing = readConfig(p.config);
      if (existing) {
        refreshWidget(ctx, root);
        return textResult(
          `A reproduction session already exists: "${existing.name}" (paper: ${existing.paperSource}).\nSession files are under ${p.dir}. Continue from the existing claims.json / plan.md.`,
          { created: false, dir: p.dir },
        );
      }

      ensureReproDirs(root);
      const config = makeConfig({
        name: params.name,
        paperSource: params.paper_source,
        repoUrl: params.repo_url,
        workingDir: params.working_dir,
        defaultTolerance: params.default_tolerance,
        maxClaimLoopIters: params.max_claim_loop_iters,
      });
      writeConfig(p.config, config);
      writeClaims(p.claims, []);
      writeFileIfAbsent(p.paper, paperStub(config.name, config.paperSource, config.repoUrl));
      writeFileIfAbsent(p.envSetup, envSetupStub());
      appendLog(p.log, { event: "init", name: config.name, paperSource: config.paperSource, repoUrl: config.repoUrl });

      refreshWidget(ctx, root);
      return textResult(
        [
          `Initialized reproduction session "${config.name}".`,
          `Session dir: ${p.dir}`,
          `Next: ingest the paper into ${p.paper}, then register each quantitative result with register_claim.`,
          config.repoUrl
            ? `A reference repo was provided (${config.repoUrl}) — gap-analyze it (implemented vs missing) into ${p.gap} before reproducing.`
            : `No reference repo provided — you will implement the method from the paper.`,
        ].join("\n"),
        { created: true, dir: p.dir },
      );
    },
  });

  // ── register_claim ─────────────────────────────────────────────────────────
  const ClaimParams = Type.Object({
    id: Type.String({ description: "Stable identifier, e.g. 'table2-cifar10-acc'." }),
    description: Type.String({ description: "What the claim asserts, in words." }),
    metric_name: Type.String({ description: "Metric display name, e.g. 'top-1 accuracy'." }),
    reported_value: Type.Number({ description: "The value reported in the paper." }),
    unit: Type.Optional(Type.String({ description: "Unit for display, e.g. '%' or 'ms'." })),
    direction: Type.Optional(Type.Union([Type.Literal("higher"), Type.Literal("lower")], { description: "Which direction is better. Used so that beating the paper still counts as reproduced." })),
    tolerance: Type.Optional(Type.Number({ description: "Relative tolerance for this claim (fraction). Falls back to the session default." })),
    source_ref: Type.Optional(Type.String({ description: "Where in the paper this comes from, e.g. 'Table 2, row CIFAR-10'." })),
    dataset: Type.Optional(Type.String({ description: "Dataset the claim pertains to." })),
    notes: Type.Optional(Type.String({ description: "Caveats, assumptions, or context." })),
  });

  pi.registerTool({
    name: "register_claim",
    label: "Register claim",
    description:
      "Record (or update, by id) one reproducible quantitative claim from the paper. Register every result you intend to reproduce — table rows, key figures, ablations.",
    parameters: ClaimParams,
    async execute(_id, params: Static<typeof ClaimParams>, _signal, _onUpdate, ctx): Promise<AgentToolResult<{ total: number }>> {
      const root = resolveRoot(ctx);
      const p = reproPaths(root);
      requireSession(root);

      const existing = readClaims(p.claims);
      const prev = existing.find((c) => c.id === params.id);
      const claim: Claim = {
        ...params,
        status: prev?.status ?? "pending",
        reproduced_value: prev?.reproduced_value,
      };
      const updated = upsertClaim(existing, claim);
      writeClaims(p.claims, updated);

      refreshWidget(ctx, root);
      return textResult(
        `${prev ? "Updated" : "Registered"} claim "${params.id}".\n${claimsTable(updated)}`,
        { total: updated.length },
      );
    },
  });

  // ── run_reproduction ───────────────────────────────────────────────────────
  const RunParams = Type.Object({
    command: Type.String({ description: "Shell command to run (executed via `bash -lc`). Should print the metric so you can read it from the output." }),
    claim_id: Type.Optional(Type.String({ description: "Claim this run is gathering evidence for, if any. Used for logging." })),
    timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds. Omit for no timeout." })),
    cwd: Type.Optional(Type.String({ description: "Working directory for the command. Defaults to the session working directory." })),
  });

  pi.registerTool({
    name: "run_reproduction",
    label: "Run reproduction",
    description:
      "Execute a reproduction command and capture its output. Does not judge the result — read the metric from stdout, then record it with log_result.",
    parameters: RunParams,
    async execute(_id, params: Static<typeof RunParams>, signal, _onUpdate, ctx): Promise<AgentToolResult<{ code: number; killed: boolean }>> {
      const root = resolveRoot(ctx);
      const p = reproPaths(root);
      requireSession(root);
      const config = readConfig(p.config);
      const cwd = params.cwd ?? config?.workingDir ?? root;

      const started = Date.now();
      const result = await pi.exec("bash", ["-lc", params.command], {
        cwd,
        timeout: params.timeout,
        signal: signal ?? undefined,
      });
      const durationMs = Date.now() - started;

      appendLog(p.log, {
        event: "run",
        claim_id: params.claim_id,
        command: params.command,
        cwd,
        code: result.code,
        killed: result.killed,
        durationMs,
      });

      const body = [
        `$ ${params.command}`,
        `(cwd: ${cwd} · exit ${result.code}${result.killed ? " · killed/timeout" : ""} · ${durationMs}ms)`,
        "",
        "── stdout ──",
        truncate(result.stdout || "(empty)"),
        "── stderr ──",
        truncate(result.stderr || "(empty)"),
      ].join("\n");

      return {
        content: [{ type: "text", text: body }],
        details: { code: result.code, killed: result.killed },
      };
    },
  });

  // ── log_result ─────────────────────────────────────────────────────────────
  const StatusLiterals = CLAIM_STATUSES.map((s) => Type.Literal(s));
  const LogParams = Type.Object({
    claim_id: Type.String({ description: "Id of the claim being recorded." }),
    reproduced_value: Type.Optional(Type.Number({ description: "The value you obtained. Omit only when status is 'blocked'." })),
    status: Type.Optional(Type.Union(StatusLiterals, { description: "Override the status. If omitted and a reproduced_value is given, it is derived by comparing to the reported value within tolerance." })),
    notes: Type.Optional(Type.String({ description: "Record any deviation from the paper's method, blockers, or caveats. Required reading for the final report." })),
  });

  pi.registerTool({
    name: "log_result",
    label: "Log result",
    description:
      "Record the reproduced value for a claim and classify it (reproduced / partial / mismatch / blocked). If status is omitted it is derived from the reported value and tolerance. Report honestly — never tune to match by deviating from the paper.",
    parameters: LogParams,
    async execute(_id, params: Static<typeof LogParams>, _signal, _onUpdate, ctx): Promise<AgentToolResult<{ status: ClaimStatus }>> {
      const root = resolveRoot(ctx);
      const p = reproPaths(root);
      requireSession(root);
      const config = readConfig(p.config);

      const claims = readClaims(p.claims);
      const claim = claims.find((c) => c.id === params.claim_id);
      if (!claim) {
        return errorResult(`No claim with id "${params.claim_id}". Register it first with register_claim.`);
      }

      let status: ClaimStatus;
      let detail = "";
      if (params.status) {
        status = params.status;
      } else if (params.reproduced_value !== undefined) {
        const tol = claim.tolerance ?? config?.defaultTolerance;
        const outcome = compare(claim.reported_value, params.reproduced_value, tol, claim.direction);
        status = outcome.status;
        detail = ` (relative error ${(outcome.relativeError * 100).toFixed(2)}%, tolerance ${((tol ?? 0) * 100).toFixed(2)}%)`;
      } else {
        status = "blocked";
      }

      claim.status = status;
      if (params.reproduced_value !== undefined) claim.reproduced_value = params.reproduced_value;
      if (params.notes !== undefined) claim.notes = params.notes;
      writeClaims(p.claims, claims);

      appendLog(p.log, {
        event: "result",
        claim_id: params.claim_id,
        reproduced_value: params.reproduced_value,
        reported_value: claim.reported_value,
        status,
        notes: params.notes,
      });

      refreshWidget(ctx, root);
      return textResult(
        `${STATUS_GLYPH[status]} ${params.claim_id}: ${status}${detail}.\n${claimsTable(claims)}`,
        { status },
      );
    },
  });

  // ── reproduction_status ──────────────────────────────────────────────────────
  pi.registerTool({
    name: "reproduction_status",
    label: "Reproduction status",
    description: "Show the current reproduction status: every claim, reported vs reproduced, and totals.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx): Promise<AgentToolResult<{ ok: boolean }>> {
      const root = resolveRoot(ctx);
      requireSession(root);
      refreshWidget(ctx, root);
      return textResult(buildFullscreenLines(root).join("\n"), { ok: true });
    },
  });

  // ── shortcut: fullscreen dashboard ───────────────────────────────────────────
  const shortcuts = loadShortcuts();
  if (shortcuts.fullscreenDashboard) {
    pi.registerShortcut(shortcuts.fullscreenDashboard, {
      description: "Fullscreen pi-repro dashboard",
      handler: async (ctx) => {
        if (!ctx.hasUI) return;
        const root = resolveRoot(ctx);
        await ctx.ui.custom<void>((_tui, _theme, _kb, done) => {
          let lines = buildFullscreenLines(root);
          return {
            render: () => lines,
            invalidate: () => {
              lines = buildFullscreenLines(root);
            },
            handleInput: () => done(),
          };
        });
      },
    });
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    refreshWidget(ctx, resolveRoot(ctx));
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
    runtimeStore.drop(sessionKey(ctx));
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function requireSession(root: string): void {
  if (!hasReproSession(root)) {
    throw new Error(
      "No .repro/ session in this directory. Call init_reproduction first.",
    );
  }
}

function errorResult(message: string): AgentToolResult<{ status: ClaimStatus }> {
  return { content: [{ type: "text", text: message }], details: { status: "blocked" } };
}

function writeFileIfAbsent(path: string, contents: string): void {
  if (!existsSync(path)) writeFileSync(path, contents, "utf8");
}

function paperStub(name: string, source: string, repoUrl?: string): string {
  return `# ${name}

**Paper source:** ${source}
${repoUrl ? `**Reference repo:** ${repoUrl}\n` : ""}
> Fill this in while ingesting the paper. A fresh agent with no context should be
> able to read this file and understand what to reproduce.

## Summary

## Method

## Datasets

## Hyperparameters & training setup

## Compute requirements

## Reported results (turn each into a registered claim)

| id | metric | reported | source (table/figure) | notes |
|----|--------|----------|------------------------|-------|
`;
}

function envSetupStub(): string {
  return `#!/usr/bin/env bash
# Reproducible environment setup for this paper.
# Fill in dependency installation, data download, and any build steps so the
# environment can be recreated from scratch.
set -euo pipefail

echo "TODO: set up the reproduction environment"
`;
}
