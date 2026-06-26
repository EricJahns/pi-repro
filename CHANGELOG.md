# Changelog

## Unreleased

- Claim grading is now **uncertainty-relative**: when a claim carries a
  `reported_std` (paper reports mean ± σ), agreement is judged in units of σ
  (within ~2σ ≈ consistent) instead of by relative tolerance, and degrades
  gracefully to the tolerance check when no σ is given. `register_claim` gains a
  `reported_std` parameter; the dashboard shows `± σ`. Adapted from
  significance-aware reproduction grading in the literature — see
  `docs/related-work.md`.

## 0.2.0 — 2026-06-26

- Setup now records the reproduction `language` and whether to use a virtual
  environment (`init_reproduction` params; `config.json`).
- New required checkpoint: when a complete/installable implementation of the
  method already exists, `repro-create` asks the user whether to use that package
  or reimplement from scratch, recorded as `implementationMode` in `config.json`.
- Skills emphasize environment/build debugging (a top reproduction blocker) and
  emitting one clean parseable metric line per result.

## 0.1.0

Initial release.

- Extension with five tools: `init_reproduction`, `register_claim`,
  `run_reproduction`, `log_result`, `reproduction_status`.
- `.repro/` session contract (config, paper, claims, gap, plan, log, report, env).
- Live status widget and a fullscreen dashboard shortcut (default `ctrl+r`,
  overridable via `PI_REPRO_SHORTCUT`).
- Skills: `repro-create` (orchestrator), `repro-ingest`, `repro-gap-analysis`,
  `repro-report`.
- Claim comparison with relative tolerance and direction-aware judgement.
