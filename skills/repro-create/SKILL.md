---
name: repro-create
description: Reproduce the quantitative results of an academic paper. Use when asked to reproduce, replicate, or verify the results/numbers/tables/figures of a paper, given a link, PDF, arXiv id, or DOI (optionally with a reference GitHub repo). Orchestrates ingest → gap-analysis → plan → per-claim reproduction → report.
---

# Reproduce a paper

Your single goal: reproduce the paper's reported quantitative results as faithfully
as possible, and report honestly what does and does not replicate. You are
verifying, not optimizing — never tune a result to match the paper by deviating from its stated method. If you deviate, record the deviation.

## Tools (provided by the pi-repro extension)

- `init_reproduction` — scaffold the `.repro/` session (once, at the start).
- `register_claim` — record one reproducible quantitative claim from the paper.
- `run_reproduction` — execute a command and capture its output.
- `log_result` — record a reproduced value and classify it vs the reported value.
- `reproduction_status` — show all claims, reported vs reproduced, and totals.

## Session files (`.repro/`)

| File | Purpose |
|------|---------|
| `.repro/config.json` | session config (name, paper, repo, tolerance) |
| `.repro/paper.md` | extracted summary, method, datasets, hyperparams, compute |
| `.repro/claims.json` | structured claims — the source of truth for status |
| `.repro/gap.md` | implemented vs missing/partial analysis of the reference repo |
| `.repro/plan.md` | reproduction plan: env, data, per-claim approach, ordering |
| `.repro/log.jsonl` | append-only run/result log |
| `.repro/report.md` | the final reproduction report |
| `.repro/env/setup.sh` | reproducible environment setup |
| `.repro/sources/` | downloaded paper artifacts / cloned repo notes |

Write these so a fresh agent with no context could read them and continue.

## Workflow

1. **Confirm inputs.** You need the paper (link / PDF / arXiv id / DOI). Ask the
   user for it if missing. Ask whether there is a reference GitHub repo. Confirm
   compute constraints (GPU? time/cost budget? datasets already available?) before
   committing to anything expensive.

2. **Init.** Call `init_reproduction` with the paper source, optional repo URL,
   and a default tolerance (5% is reasonable unless the user says otherwise).

3. **Ingest the paper** → use the **repro-ingest** skill. Fill `.repro/paper.md`
   and `register_claim` for every quantitative result you intend to reproduce.

4. **Gap-analyze the repo** (if one was provided) → use the **repro-gap-analysis**
   skill. Produce `.repro/gap.md`. Assume the code is *incomplete*: determine what
   is implemented, partial, stubbed, or missing, and whether reported numbers come
   from pretrained weights vs training from scratch.

5. **Plan.** Write `.repro/plan.md`: environment setup, data acquisition, the
   order to attempt claims (cheapest / most-likely-to-succeed first), and the
   concrete command for each claim. Capture environment setup in
   `.repro/env/setup.sh`. Confirm the plan with the user before any heavy compute
   or large downloads.

6. **Reproduce each claim.** For each claim:
   - `run_reproduction` with the command; read the metric from stdout.
   - `log_result` with the reproduced value. Let the tool classify it, or set the
     status explicitly when you must (e.g. `blocked`).
   - Record any deviation from the paper in the `notes`.

7. **Optional per-claim debug loop.** When a claim is `mismatch` or `blocked` and
   worth converging, iterate — but **only adjust things the paper specifies**
   (hyperparameters it states, seeds, data splits it defines). Cap at
   `maxClaimLoopIters` (default 8) from `config.json`. Stop and mark the claim
   `partial`/`mismatch`/`blocked` with notes when the budget is exhausted. Do
   **not** invent undocumented tricks just to hit the number.

8. **Report** → use the **repro-report** skill to generate `.repro/report.md`.

## Loop rules (read every iteration)

- **Faithful, not optimal.** Reproduce the method as described. Report whatever
  you get, even a mismatch. A documented mismatch is a successful reproduction
  attempt; a number fudged to match is a failed one.
- **Record every deviation.** Any difference from the paper (different data, fewer
  epochs, smaller model, missing component) goes in the claim `notes`.
- **Cheapest first.** Attempt quick, high-confidence claims before expensive ones.
- **Budget awareness.** Confirm before long training runs, large downloads, or
  anything that costs money or many GPU-hours.
- **Persist state to disk.** `.repro/` is the source of truth; if context is
  compacted, re-read `paper.md`, `claims.json`, `gap.md`, and `plan.md`.

## When you are done

Summarize for the user: how many claims reproduced / partial / mismatch /
blocked, the main deviations, and what would be needed to close the gaps. Point
them at `.repro/report.md`.
