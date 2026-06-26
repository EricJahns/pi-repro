/**
 * Renders the reproduction status as plain text lines for the live widget
 * (above the editor) and the fullscreen overlay. Kept dependency-light: it
 * reads `.repro/` from disk and returns `string[]`, so it works regardless of
 * theme support.
 */
import {
  readClaims,
  STATUS_GLYPH,
  summarize,
  type Claim,
} from "./claims.ts";
import { readConfig } from "./config.ts";
import { reproPaths } from "./paths.ts";

const fmt = (v: number | undefined, unit?: string): string =>
  v === undefined ? "—" : `${trimNum(v)}${unit ?? ""}`;

const trimNum = (v: number): string =>
  Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));

function summaryLine(claims: Claim[]): string {
  const s = summarize(claims);
  return (
    `${STATUS_GLYPH.reproduced} ${s.reproduced}  ` +
    `${STATUS_GLYPH.partial} ${s.partial}  ` +
    `${STATUS_GLYPH.mismatch} ${s.mismatch}  ` +
    `${STATUS_GLYPH.blocked} ${s.blocked}  ` +
    `${STATUS_GLYPH.pending} ${s.pending}  ` +
    `(${s.reproduced}/${s.total} reproduced)`
  );
}

/** Compact widget shown above the editor. Returns `[]` when there is no session. */
export function buildWidgetLines(root: string): string[] {
  const p = reproPaths(root);
  const config = readConfig(p.config);
  if (!config) return [];
  const claims = readClaims(p.claims);
  const header = `pi-repro · ${config.name}`;
  if (claims.length === 0) {
    return [header, "no claims registered yet"];
  }
  return [header, summaryLine(claims)];
}

/** Full reproduction table for the fullscreen overlay. */
export function buildFullscreenLines(root: string): string[] {
  const p = reproPaths(root);
  const config = readConfig(p.config);
  if (!config) return ["No pi-repro session in this directory.", "", "Press any key to close."];

  const claims = readClaims(p.claims);
  const lines: string[] = [];
  lines.push(`pi-repro — ${config.name}`);
  lines.push(`paper:  ${config.paperSource}`);
  if (config.repoUrl) lines.push(`repo:   ${config.repoUrl}`);
  lines.push("");
  lines.push(summaryLine(claims));
  lines.push("");

  if (claims.length === 0) {
    lines.push("No claims registered yet.");
  } else {
    for (const c of claims) {
      const glyph = STATUS_GLYPH[c.status];
      const reported =
        c.reported_std !== undefined
          ? `${fmt(c.reported_value, c.unit)} ± ${trimNum(c.reported_std)}`
          : fmt(c.reported_value, c.unit);
      lines.push(`${glyph} ${c.id}  [${c.status}]`);
      lines.push(
        `    ${c.metric_name}: reported ${reported} · ` +
          `reproduced ${fmt(c.reproduced_value, c.unit)}` +
          (c.source_ref ? `  (${c.source_ref})` : ""),
      );
      if (c.notes) lines.push(`    note: ${c.notes}`);
    }
  }
  lines.push("");
  lines.push("Press any key to close.");
  return lines;
}
