/**
 * Filesystem layout for a pi-repro session.
 *
 * All reproduction state lives under a single `.repro/` folder at the root of
 * the project being worked in. Keeping the layout in one place means the tools,
 * the dashboard, and the skills all agree on where things live.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Name of the session-state directory created in the consumer's project. */
export const REPRO_DIR = ".repro";

/** Resolve the absolute path to the `.repro/` directory for a given project root. */
export function reproDir(root: string): string {
  return join(root, REPRO_DIR);
}

/** Absolute paths of every file/dir in the `.repro/` contract, relative to a project root. */
export function reproPaths(root: string) {
  const dir = reproDir(root);
  return {
    dir,
    config: join(dir, "config.json"),
    paper: join(dir, "paper.md"),
    claims: join(dir, "claims.json"),
    gap: join(dir, "gap.md"),
    plan: join(dir, "plan.md"),
    log: join(dir, "log.jsonl"),
    report: join(dir, "report.md"),
    envDir: join(dir, "env"),
    envSetup: join(dir, "env", "setup.sh"),
    sourcesDir: join(dir, "sources"),
  } as const;
}

/** True when a `.repro/` session already exists at the given root. */
export function hasReproSession(root: string): boolean {
  return existsSync(reproDir(root));
}

/** Create the `.repro/` directory tree if it does not already exist. Idempotent. */
export function ensureReproDirs(root: string): ReturnType<typeof reproPaths> {
  const p = reproPaths(root);
  for (const dir of [p.dir, p.envDir, p.sourcesDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  return p;
}
