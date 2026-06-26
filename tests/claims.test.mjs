import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  compare,
  DEFAULT_TOLERANCE,
  readClaims,
  summarize,
  upsertClaim,
  writeClaims,
} from "../extensions/pi-repro/claims.ts";

test("compare: within tolerance is reproduced", () => {
  const out = compare(90, 89, { tolerance: 0.05 });
  assert.equal(out.status, "reproduced");
  assert.equal(out.basis, "relative");
  assert.equal(out.withinTolerance, true);
});

test("compare: just outside tolerance but close is partial", () => {
  // 10% off with a 5% tolerance → within 3x → partial
  const out = compare(100, 110, { tolerance: 0.05 });
  assert.equal(out.status, "partial");
  assert.equal(out.withinTolerance, false);
});

test("compare: far off is mismatch", () => {
  const out = compare(100, 50, { tolerance: 0.05 });
  assert.equal(out.status, "mismatch");
});

test("compare: beating the paper counts as reproduced (direction higher)", () => {
  const out = compare(90, 95, { tolerance: 0.01, direction: "higher" });
  assert.equal(out.status, "reproduced");
  assert.equal(out.withinTolerance, false);
});

test("compare: beating the paper counts as reproduced (direction lower)", () => {
  const out = compare(100, 80, { tolerance: 0.01, direction: "lower" });
  assert.equal(out.status, "reproduced");
});

test("compare: default tolerance applies", () => {
  const out = compare(100, 100 * (1 + DEFAULT_TOLERANCE), {});
  assert.equal(out.status, "reproduced");
});

test("compare: handles reported value of zero without NaN", () => {
  const out = compare(0, 0.001, {});
  assert.ok(Number.isFinite(out.relativeError));
});

test("compare (sigma): within ~2σ is reproduced even past relative tolerance", () => {
  // 0.85 vs 0.90: 5.9% rel error (would be partial/mismatch) but only 1σ off
  const out = compare(0.9, 0.85, { tolerance: 0.02, reportedStd: 0.05 });
  assert.equal(out.basis, "sigma");
  assert.equal(out.status, "reproduced");
  assert.ok(Math.abs(out.z - 1) < 1e-9);
});

test("compare (sigma): ~3σ is partial", () => {
  const out = compare(0.9, 0.75, { reportedStd: 0.05 });
  assert.equal(out.basis, "sigma");
  assert.equal(out.status, "partial");
});

test("compare (sigma): large favorable deviation is a mismatch, not a free pass", () => {
  // 10σ better in the 'higher' direction must NOT be waved through
  const out = compare(0.9, 1.4, { direction: "higher", reportedStd: 0.05 });
  assert.equal(out.basis, "sigma");
  assert.equal(out.status, "mismatch");
});

test("compare (sigma): std of 0 falls back to relative basis", () => {
  const out = compare(100, 101, { tolerance: 0.05, reportedStd: 0 });
  assert.equal(out.basis, "relative");
  assert.equal(out.status, "reproduced");
});

test("upsert inserts then updates by id", () => {
  let claims = [];
  claims = upsertClaim(claims, {
    id: "a",
    description: "d",
    metric_name: "m",
    reported_value: 1,
    status: "pending",
  });
  assert.equal(claims.length, 1);
  claims = upsertClaim(claims, {
    id: "a",
    description: "d2",
    metric_name: "m",
    reported_value: 1,
    status: "reproduced",
  });
  assert.equal(claims.length, 1);
  assert.equal(claims[0].status, "reproduced");
  assert.equal(claims[0].description, "d2");
});

test("summarize counts by status", () => {
  const s = summarize([
    { id: "a", description: "", metric_name: "", reported_value: 0, status: "reproduced" },
    { id: "b", description: "", metric_name: "", reported_value: 0, status: "blocked" },
    { id: "c", description: "", metric_name: "", reported_value: 0, status: "reproduced" },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.reproduced, 2);
  assert.equal(s.blocked, 1);
  assert.equal(s.pending, 0);
});

test("read/write round-trip", () => {
  const dir = mkdtempSync(join(tmpdir(), "repro-claims-"));
  try {
    const p = join(dir, "claims.json");
    assert.deepEqual(readClaims(p), []);
    const claims = [
      { id: "x", description: "d", metric_name: "acc", reported_value: 90, unit: "%", status: "pending" },
    ];
    writeClaims(p, claims);
    assert.deepEqual(readClaims(p), claims);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
