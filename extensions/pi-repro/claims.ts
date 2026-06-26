/**
 * The claim model: the source of truth for what a paper asserts and how our
 * reproduction compares. `claims.json` is an array of {@link Claim} objects.
 *
 * This module is intentionally pure (only `node:fs` for persistence) so the
 * comparison logic can be unit-tested without the pi runtime.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Lifecycle of a single reproducible claim.
 * - `pending`    — registered from the paper, not yet attempted
 * - `reproduced` — reproduced within tolerance (or better, per `direction`)
 * - `partial`    — qualitatively reproduced but outside tolerance
 * - `mismatch`   — reproduced a value that significantly disagrees
 * - `blocked`    — could not run (missing data/compute/dependency)
 */
export type ClaimStatus = "pending" | "reproduced" | "partial" | "mismatch" | "blocked";

export const CLAIM_STATUSES: readonly ClaimStatus[] = [
  "pending",
  "reproduced",
  "partial",
  "mismatch",
  "blocked",
];

/** Which direction counts as "better" for a metric (used when judging partials). */
export type MetricDirection = "higher" | "lower";

export interface Claim {
  /** Stable id, e.g. "table2-cifar10-acc". */
  id: string;
  /** Human-readable description of the claim. */
  description: string;
  /** Display name of the metric, e.g. "top-1 accuracy". */
  metric_name: string;
  /** Value reported in the paper. */
  reported_value: number;
  /**
   * Reported uncertainty (standard deviation) when the paper gives mean ± σ over
   * seeds/folds/runs. When present, agreement is judged in units of σ (statistical
   * consistency) rather than by relative tolerance.
   */
  reported_std?: number;
  /** Value we obtained, once attempted. */
  reproduced_value?: number;
  /** Unit string for display, e.g. "%". */
  unit?: string;
  /** Which direction is better; informs partial-vs-mismatch judgement. */
  direction?: MetricDirection;
  /** Relative tolerance (fraction, e.g. 0.05 = 5%). Falls back to the session default. */
  tolerance?: number;
  /** Where in the paper this comes from, e.g. "Table 2, row CIFAR-10". */
  source_ref?: string;
  /** Dataset the claim pertains to. */
  dataset?: string;
  /** Current status. */
  status: ClaimStatus;
  /** Free-form notes: deviations from the paper, blockers, caveats. */
  notes?: string;
}

/** Default relative tolerance when neither the claim nor the config specifies one. */
export const DEFAULT_TOLERANCE = 0.05;

export interface CompareOptions {
  /** Relative tolerance (fraction). Used when no reported σ is available. */
  tolerance?: number;
  /** Which direction is better (for the relative, σ-free path). */
  direction?: MetricDirection;
  /** Reported σ. When > 0, agreement is judged in units of σ. */
  reportedStd?: number;
}

export interface CompareOutcome {
  status: Extract<ClaimStatus, "reproduced" | "partial" | "mismatch">;
  /** Which yardstick was used. */
  basis: "sigma" | "relative";
  /** Relative error |reproduced - reported| / max(|reported|, eps). */
  relativeError: number;
  /** Distance in σ, when `basis === "sigma"`. */
  z?: number;
  /** True when within relative tolerance (relative basis only). */
  withinTolerance: boolean;
}

const SIGMA_REPRODUCED = 2; // ≈ 95% consistency
const SIGMA_PARTIAL = 4;

/**
 * Classify a reproduced value against the reported one.
 *
 * Uncertainty-relative when the paper reports a σ (mean ± std): the reproduced
 * value is judged by how many σ it sits from the reported mean — within ~2σ is
 * statistically consistent (`reproduced`), ~2–4σ is `partial`, beyond is
 * `mismatch`. This is symmetric: an implausibly large *favorable* deviation is a
 * red flag (possible leakage/bug), not a free pass.
 *
 * When no σ is available, falls back to a relative-tolerance check: within
 * `tolerance` → `reproduced`; beating the paper in the better `direction` also
 * counts; within 3× tolerance → `partial`; beyond → `mismatch`.
 *
 * The σ-based scheme is adapted from significance-aware reproduction grading in
 * the agentic-reproduction literature (see docs/related-work.md); the σ-optional
 * fallback and stochastic framing are specific to this tool.
 */
export function compare(
  reported: number,
  reproduced: number,
  options: CompareOptions = {},
): CompareOutcome {
  const { tolerance = DEFAULT_TOLERANCE, direction, reportedStd } = options;
  const denom = Math.max(Math.abs(reported), 1e-9);
  const relativeError = Math.abs(reproduced - reported) / denom;

  if (reportedStd !== undefined && reportedStd > 0) {
    const z = Math.abs(reproduced - reported) / reportedStd;
    const status =
      z <= SIGMA_REPRODUCED ? "reproduced" : z <= SIGMA_PARTIAL ? "partial" : "mismatch";
    return { status, basis: "sigma", relativeError, z, withinTolerance: false };
  }

  const withinTolerance = relativeError <= tolerance;
  if (withinTolerance) {
    return { status: "reproduced", basis: "relative", relativeError, withinTolerance: true };
  }

  // Beating the paper's number (in the better direction) counts as reproduced.
  if (
    (direction === "higher" && reproduced > reported) ||
    (direction === "lower" && reproduced < reported)
  ) {
    return { status: "reproduced", basis: "relative", relativeError, withinTolerance: false };
  }

  if (relativeError <= tolerance * 3) {
    return { status: "partial", basis: "relative", relativeError, withinTolerance: false };
  }
  return { status: "mismatch", basis: "relative", relativeError, withinTolerance: false };
}

/** Read `claims.json`; returns `[]` when the file does not exist. */
export function readClaims(claimsPath: string): Claim[] {
  if (!existsSync(claimsPath)) return [];
  const raw = readFileSync(claimsPath, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${claimsPath} is not a JSON array of claims`);
  }
  return parsed as Claim[];
}

/** Write `claims.json` pretty-printed (so diffs stay reviewable). */
export function writeClaims(claimsPath: string, claims: Claim[]): void {
  writeFileSync(claimsPath, JSON.stringify(claims, null, 2) + "\n", "utf8");
}

/**
 * Insert or update a claim by `id`, preserving fields not provided in the patch.
 * Returns the full updated array.
 */
export function upsertClaim(claims: Claim[], patch: Claim): Claim[] {
  const idx = claims.findIndex((c) => c.id === patch.id);
  if (idx === -1) return [...claims, patch];
  const next = [...claims];
  next[idx] = { ...claims[idx], ...patch };
  return next;
}

export type ClaimSummary = Record<ClaimStatus, number> & { total: number };

/** Count claims by status. */
export function summarize(claims: Claim[]): ClaimSummary {
  const summary = {
    total: claims.length,
    pending: 0,
    reproduced: 0,
    partial: 0,
    mismatch: 0,
    blocked: 0,
  } satisfies ClaimSummary;
  for (const c of claims) summary[c.status] += 1;
  return summary;
}

/** Single-character glyph used in the dashboard and reports for each status. */
export const STATUS_GLYPH: Record<ClaimStatus, string> = {
  reproduced: "✓",
  partial: "~",
  mismatch: "✗",
  blocked: "⛔",
  pending: "·",
};
