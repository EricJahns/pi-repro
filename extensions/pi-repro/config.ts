/**
 * Session configuration persisted to `.repro/config.json`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_TOLERANCE } from "./claims.ts";

export interface ReproConfig {
  /** Human-readable session name. */
  name: string;
  /** The paper: URL, arXiv id, DOI, or local path. */
  paperSource: string;
  /** Optional reference implementation to start from. */
  repoUrl?: string;
  /** Working directory for reproduction commands (defaults to the project root). */
  workingDir?: string;
  /** Default relative tolerance applied to claims that don't set their own. */
  defaultTolerance: number;
  /** Cap on iterations for the optional per-claim debug loop. */
  maxClaimLoopIters: number;
  /** ISO timestamp the session was created. */
  createdAt: string;
}

export const DEFAULT_MAX_CLAIM_LOOP_ITERS = 8;

export function readConfig(configPath: string): ReproConfig | undefined {
  if (!existsSync(configPath)) return undefined;
  const raw = readFileSync(configPath, "utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as ReproConfig;
}

export function writeConfig(configPath: string, config: ReproConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Build a config from init params, applying defaults. */
export function makeConfig(params: {
  name: string;
  paperSource: string;
  repoUrl?: string;
  workingDir?: string;
  defaultTolerance?: number;
  maxClaimLoopIters?: number;
}): ReproConfig {
  return {
    name: params.name,
    paperSource: params.paperSource,
    repoUrl: params.repoUrl,
    workingDir: params.workingDir,
    defaultTolerance: params.defaultTolerance ?? DEFAULT_TOLERANCE,
    maxClaimLoopIters: params.maxClaimLoopIters ?? DEFAULT_MAX_CLAIM_LOOP_ITERS,
    createdAt: new Date().toISOString(),
  };
}
