# pi-repro

A [pi](https://pi.dev) extension with one goal: **reproduce the quantitative
results of an academic paper.**

You give it a paper (link, PDF, arXiv id, or DOI) and — optionally — a reference
GitHub repo. It ingests the paper, extracts every result you want to reproduce as
a tracked *claim*, gap-analyzes the provided code (because shipped code is almost
never complete enough to reproduce the whole paper), plans the reproduction, runs
each experiment, and reports honestly what does and doesn't replicate.

It is built on the same idea as
[`pi-autoresearch`](https://github.com/davebcn87/pi-autoresearch): the
**extension** is domain-agnostic machinery; the **skills** encode the domain
knowledge. The difference is the goal — reproduction is *verification*, not
optimization, so pi-repro never tunes a number to match the paper by deviating
from its method. It reports whatever it gets.

## Install

```sh
pi install npm:pi-repro
# or, from a local checkout:
pi install file:/path/to/pi-repro
```

Then, in a project where you want to do the work:

```
reproduce https://arxiv.org/abs/XXXX.XXXXX  (optionally: repo https://github.com/...)
```

The `repro-create` skill drives the rest.

## Workflow

```
ingest paper ─► extract claims (claims.json) ─► gap-analyze repo (gap.md) ─► plan (plan.md)
      │
      ▼
 for each claim:  run_reproduction ─► compare reproduced vs reported ─► log_result (status)
      │            └─ optional bounded per-claim debug loop if blocked/mismatch
      ▼
 report.md   (per claim: ✓ reproduced / ~ partial / ✗ mismatch / ⛔ blocked / · pending)
```

## Tools

| Tool | What it does |
|------|--------------|
| `init_reproduction` | Scaffold the `.repro/` session (once). Idempotent. |
| `register_claim` | Record/update one reproducible quantitative claim from the paper. |
| `run_reproduction` | Run a command (`bash -lc`) and capture output. Doesn't judge. |
| `log_result` | Record a reproduced value and classify it vs the reported value. |
| `reproduction_status` | Show all claims, reported vs reproduced, and totals. |

## Skills

| Skill | Role |
|-------|------|
| `repro-create` | Orchestrator / spine — the entry point. |
| `repro-ingest` | Paper → `paper.md` + registered claims. |
| `repro-gap-analysis` | Reference repo → `gap.md` (implemented vs missing). |
| `repro-report` | Claims + logs → `report.md`. |

## The `.repro/` session

All state lives in one folder at the root of the project being reproduced:

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

## How claims are judged

`log_result` compares the reproduced value to the reported value using a relative
tolerance (default 5%, configurable per-claim or per-session):

- within tolerance → **reproduced** (`✓`)
- beating the paper in the better `direction` → **reproduced** (`✓`)
- within 3× tolerance → **partial** (`~`)
- further off → **mismatch** (`✗`)
- couldn't run → **blocked** (`⛔`)

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
