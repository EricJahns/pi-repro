<p align="center">
  <img src="assets/logo.svg" alt="pi-repro logo" width="650">
</p>

> **Trust, but verify — one claim at a time.**

A [pi](https://pi.dev) extension with one job: **reproduce the quantitative
results of an academic paper**, and tell you honestly which ones survive contact
with reality.

<div align="center">

**[Install](#install) · [Usage](#usage) · [How it works](#how-it-works)**

</div>

A paper lands on your desk claiming 94.2% accuracy. There's no code — or there's
a repo that's missing the training script, hardcodes a path to someone's laptop,
and references a config file that isn't in the commit. You need to know: does the
number hold? Today that means days of archaeology — guessing at hyperparameters,
reconstructing the data pipeline from a figure caption, and slowly losing track
of which of the paper's ten claims you've actually checked.

pi-repro does that archaeology for you. It treats the paper as the source of
truth and the code as a lead to follow, not a thing to trust. It reconstructs
what's missing, runs what it can, and refuses to fudge the difference between
what the paper said and what your machine did.

You hand it a paper (link, PDF, arXiv id, or DOI) and — optionally — a reference
GitHub repo. It reads the paper, pulls out every number you care about as a
tracked *claim*, audits the shipped code for the gaps it always has, plans the
reproduction, runs each experiment, and files a report on what replicated, what
didn't, and what flat-out refused to run.

It follows the paper's method and reports whatever falls out, even when that's an
inconvenient truth. It will never nudge a result toward the published value by
quietly leaving the method behind — because the gap between "the paper says
94.2%" and "I got 94.2% on my machine" is where science actually happens.

## Why you'd want this

- **Peer reviewers & area chairs** — turn "the authors claim X" into "I ran it
  and got X (or didn't)" before you sign off, with a paper trail you can attach.
- **PhD students & researchers** — before you build on someone's result, confirm
  the foundation holds. Reproduce the baseline you're about to beat so your
  delta is real and not a difference in setup.
- **ML engineers** — vet a flashy SOTA claim against your own hardware and data
  pipeline before you bet a sprint on integrating it.
- **Reproducibility & ML-reproducibility-challenge teams** — run a fleet of
  papers through one consistent, auditable pipeline instead of a pile of
  bespoke shell scripts.
- **Educators** — hand students a paper and a reproduction report side by side,
  and teach them where published numbers come from (and where they leak).
- **Your future self** — six months from now, when a reviewer asks "did this
  actually work?", the `.repro/` folder already has the receipts.

## Install

```sh
pi install npm:pi-repro
# or, from a local checkout:
pi install file:/path/to/pi-repro
```

## Usage

In a project where you want to do the work:

```
reproduce https://arxiv.org/abs/XXXX.XXXXX  (optionally: repo https://github.com/...)
```

The `repro-create` skill drives everything from there: ingest, gap analysis,
plan, run, report. All state lands in a single `.repro/` folder at the project
root, so the work **survives restarts and context resets** — pick up exactly
where you left off, and hand the folder to anyone who wants to check your work.

## How it works

```
ingest paper ─► extract claims (claims.json) ─► gap-analyze repo (gap.md) ─► plan (plan.md)
      │
      ▼
 for each claim:  run_reproduction ─► compare reproduced vs reported ─► log_result (status)
      │            └─ optional bounded per-claim debug loop if blocked/mismatch
      ▼
 report.md   (per claim: ✓ reproduced / ~ partial / ✗ mismatch / ⛔ blocked / · pending)
```

The whole thing is verification, not optimization. When a claim doesn't
reproduce, that's a finding — not a bug to paper over.

### Tools

| Tool | What it does |
|------|--------------|
| `init_reproduction` | Scaffold the `.repro/` session (once). Idempotent. |
| `register_claim` | Record/update one reproducible quantitative claim from the paper. |
| `run_reproduction` | Run a command (`bash -lc`) and capture output. Doesn't judge. |
| `log_result` | Record a reproduced value and classify it vs the reported value. |
| `reproduction_status` | Show all claims, reported vs reproduced, and totals. |

### Skills

| Skill | Role |
|-------|------|
| `repro-create` | Orchestrator / spine — the entry point. |
| `repro-ingest` | Paper → `paper.md` + registered claims. |
| `repro-gap-analysis` | Reference repo → `gap.md` (implemented vs missing). |
| `repro-report` | Claims + logs → `report.md`. |

### The `.repro/` session

All state lives in one folder at the root of the project being reproduced — human
readable, version-controllable, and the single source of truth:

| File | Purpose |
|------|---------|
| `config.json` | name, paper source, repo, tolerance, loop budget |
| `paper.md` | extracted summary, method, datasets, hyperparams, compute |
| `claims.json` | structured claims — the source of truth for status |
| `gap.md` | implemented vs missing/partial analysis of the reference repo |
| `plan.md` | environment, data acquisition, per-claim approach and ordering |
| `log.jsonl` | append-only run/result log |
| `report.md` | the final reproduction report |
| `env/setup.sh` | reproducible environment setup |
| `sources/` | downloaded paper artifacts / clone notes |

### How claims are judged

`log_result` compares the reproduced value to the reported value using a relative
tolerance (default 5%, configurable per-claim or per-session):

- within tolerance → **reproduced** (`✓`)
- beating the paper in the better `direction` → **reproduced** (`✓`)
- within 3× tolerance → **partial** (`~`)
- further off → **mismatch** (`✗`)
- couldn't run → **blocked** (`⛔`)

No grade inflation: a number only counts as reproduced when the method that
produced it is the paper's method.

## Configuration

- `PI_REPRO_SHORTCUT` — key for the fullscreen dashboard (default `ctrl+r`; set to
  `none` to disable).

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit
npm test            # node --experimental-strip-types --test tests/*.test.mjs
```

`npm test` requires a Node 22+ build with TypeScript stripping support (the same
requirement pi has for loading `.ts` extensions). On a Node built without it the
tests can be run by transpiling the modules first.

## License

MIT
