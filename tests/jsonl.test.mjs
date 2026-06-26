import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { appendLog, readLog } from "../extensions/pi-repro/jsonl.ts";

test("append then read preserves order and stamps ts", () => {
  const dir = mkdtempSync(join(tmpdir(), "repro-log-"));
  try {
    const p = join(dir, "log.jsonl");
    assert.deepEqual(readLog(p), []);
    appendLog(p, { event: "init", name: "first" });
    appendLog(p, { event: "run", claim_id: "a", command: "echo hi" });
    const entries = readLog(p);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].event, "init");
    assert.equal(entries[1].claim_id, "a");
    assert.ok(typeof entries[0].ts === "string" && entries[0].ts.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readLog skips blank and corrupt lines", () => {
  const dir = mkdtempSync(join(tmpdir(), "repro-log-"));
  try {
    const p = join(dir, "log.jsonl");
    writeFileSync(
      p,
      ['{"ts":"t","event":"note","msg":"ok"}', "", "not json", '{"ts":"t2","event":"run"}', ""].join("\n"),
      "utf8",
    );
    const entries = readLog(p);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].event, "note");
    assert.equal(entries[1].event, "run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("caller-provided ts is preserved", () => {
  const dir = mkdtempSync(join(tmpdir(), "repro-log-"));
  try {
    const p = join(dir, "log.jsonl");
    appendLog(p, { ts: "2020-01-01T00:00:00.000Z", event: "note" });
    assert.equal(readLog(p)[0].ts, "2020-01-01T00:00:00.000Z");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
