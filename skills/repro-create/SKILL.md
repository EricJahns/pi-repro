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

1. **Confirm inputs.** Ask the user for, and confirm:
   - the **paper** (link / PDF / arXiv id / DOI) — required;
   - whether there is a **reference GitHub repo**;
   - the **language** to reproduce the work in (e.g. Python, R, Julia). If a
     reference repo exists, propose its language as the default;
   - whether to use a **virtual environment** for that language (e.g.
     venv/conda for Python, renv for R) to isolate dependencies — recommend yes;
   - **compute constraints** (GPU? time/cost budget? datasets already available?)
     before committing to anything expensive.

2. **Init.** Call `init_reproduction` with the paper source, optional repo URL,
   the chosen `language` and `use_virtual_env`, and a default tolerance (5% is
   reasonable unless the user says otherwise).

3. **Ingest the paper** → use the **repro-ingest** skill. Fill `.repro/paper.md`
   and `register_claim` for every quantitative result you intend to reproduce.

4. **Gap-analyze the repo** (if one was provided) → use the **repro-gap-analysis**
   skill. Produce `.repro/gap.md`. Assume the code is *incomplete*: determine what
   is implemented, partial, stubbed, or missing, and whether reported numbers come
   from pretrained weights vs training from scratch. Also determine whether a
   **complete, installable implementation already exists** (a published package on
   pip/conda/CRAN/etc., or a repo that runs end-to-end) that could produce the
   claims directly.

5. **Choose implementation strategy — ask the user.** This is a required
   checkpoint. If step 4 found that a standard/published package (or an otherwise
   complete implementation) already contains the code needed to reproduce the
   results, **stop and ask the user which path they want**, before writing the
   plan:
   - **Use the existing package** — faster and validates the *result*; relies on
     someone else's code, so it tests "does the published artifact reproduce the
     number" rather than "is the paper reproducible from its description."
   - **Reimplement from scratch** — slower; reproduces the *method from the paper*
     and is a stronger reproducibility claim, catching gaps/ambiguities a package
     would paper over.

   Do not assume. Present the tradeoff plainly and let the user decide. Record the
   choice (and why) in `.repro/plan.md`, and set `implementationMode` to
   `"package"` or `"from_scratch"` in `.repro/config.json`. If no complete
   implementation exists, the path is from-scratch by necessity — note that and
   continue.

6. **Plan & environment.** Write `.repro/plan.md`: environment setup, data
   acquisition, the order to attempt claims (cheapest / most-likely-to-succeed
   first), and the concrete command for each claim. Capture environment setup in
   `.repro/env/setup.sh`. **Treat the environment as a first-class obstacle** —
   build/toolchain failures are one of the most common reproduction blockers:
   - When a build fails, capture the exact error and try standard fixes before
     giving up: a pinned/older compiler or language runtime, build flags (e.g.
     `CFLAGS=-Wno-error=...` for C/C++ that predates a stricter compiler), a
     matching Python/CUDA version, or system libraries.
   - Record every such workaround in `.repro/env/setup.sh` and as a deviation —
     "didn't build out of the box on the current toolchain" is itself a finding.
   - Confirm the plan with the user before any heavy compute or large downloads.

7. **Reproduce each claim.** For each claim:
   - `run_reproduction` with the command. Make the script **print one clean,
     parseable final line** for the metric (e.g. `METRIC=0.8575`) so the value is
     unambiguous even when training logs / progress bars flood stdout.
   - `log_result` with the reproduced value. Let the tool classify it, or set the
     status explicitly when you must (e.g. `blocked`).
   - Record any deviation from the paper in the `notes`.

8. **Optional per-claim debug loop.** When a claim is `mismatch` or `blocked` and
   worth converging, iterate — but **only adjust things the paper specifies**
   (hyperparameters it states, seeds, data splits it defines). Cap at
   `maxClaimLoopIters` (default 8) from `config.json`. Stop and mark the claim
   `partial`/`mismatch`/`blocked` with notes when the budget is exhausted. Do
   **not** invent undocumented tricks just to hit the number.

9. **Report** → use the **repro-report** skill to generate `.repro/report.md`.

## Loop rules (read every iteration)

- **Faithful, not optimal.** Reproduce the method as described. Report whatever
  you get, even a mismatch. A documented mismatch is a successful reproduction
  attempt; a number fudged to match is a failed one.
- **Record every deviation.** Any difference from the paper (different data, fewer
  epochs, smaller model, missing component) goes in the claim `notes`.
- **Cheapest first.** Attempt quick, high-confidence claims before expensive ones.
- **The environment is half the battle.** Most stalls are build/dependency/data
  issues, not the science. Debug them methodically and record the workarounds.
- **Emit clean metrics.** Reproduction scripts should print one parseable final
  line per metric; don't rely on reading a number out of noisy logs.
- **Budget awareness.** Confirm before long training runs, large downloads, or
  anything that costs money or many GPU-hours.
- **Persist state to disk.** `.repro/` is the source of truth; if context is
  compacted, re-read `paper.md`, `claims.json`, `gap.md`, and `plan.md`.

## When you are done

Summarize for the user: how many claims reproduced / partial / mismatch /
blocked, the main deviations, and what would be needed to close the gaps. Point
them at `.repro/report.md`.
