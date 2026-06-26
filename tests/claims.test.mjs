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
  const out = compare(90, 89, 0.05);
  assert.equal(out.status, "reproduced");
  assert.equal(out.withinTolerance, true);
});

test("compare: just outside tolerance but close is partial", () => {
  // 10% off with a 5% tolerance → within 3x → partial
  const out = compare(100, 110, 0.05);
  assert.equal(out.status, "partial");
  assert.equal(out.withinTolerance, false);
});

test("compare: far off is mismatch", () => {
  const out = compare(100, 50, 0.05);
  assert.equal(out.status, "mismatch");
});

test("compare: beating the paper counts as reproduced (direction higher)", () => {
  const out = compare(90, 95, 0.01, "higher");
  assert.equal(out.status, "reproduced");
  assert.equal(out.withinTolerance, false);
});

test("compare: beating the paper counts as reproduced (direction lower)", () => {
  const out = compare(100, 80, 0.01, "lower");
  assert.equal(out.status, "reproduced");
});

test("compare: default tolerance applies", () => {
  const out = compare(100, 100 * (1 + DEFAULT_TOLERANCE));
  assert.equal(out.status, "reproduced");
});

test("compare: handles reported value of zero without NaN", () => {
  const out = compare(0, 0.001);
  assert.ok(Number.isFinite(out.relativeError));
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
