---
name: repro-report
description: Write the final reproduction report for a paper — a per-claim comparison of reported vs reproduced values, overall fidelity, deviations, blockers, and next steps. Use as the last step of reproducing a paper, after claims have been attempted.
---

# Write the reproduction report

Produce `.repro/report.md`: an honest, reviewable account of what reproduced and
what did not. Read `config.json`, `claims.json`, `gap.md`, and `log.jsonl` first;
call `reproduction_status` for the current table.

## Structure

```markdown
# Reproduction report: <session name>

- **Paper:** <source>
- **Reference repo:** <url or "none">
- **Date:** <date>
- **Environment:** <hardware, key dependency versions; point to .repro/env/setup.sh>

## Summary

<n> of <total> claims reproduced (within tolerance), <n> partial, <n> mismatch,
<n> blocked. One-paragraph verdict on overall reproducibility.

## Claim-by-claim

| status | claim | metric | reported | reproduced | rel. error | source | notes |
|--------|-------|--------|----------|------------|-----------|--------|-------|
| ✓/~/✗/⛔ | id | … | … | … | …% | Table/Fig | deviations |

## Deviations from the paper

Every difference between what you ran and what the paper describes (data, epochs,
model size, missing components, seeds, undocumented choices you had to make).

## Blockers

What prevented full reproduction (missing data, compute, broken/absent code) and
what each would require to resolve.

## Reproducibility assessment

Honest judgement: does the paper's central result hold up? How completely could it
be reproduced from the paper (+ repo)? Note where the repo was incomplete.

## Recommendations / next steps

Concrete actions to close remaining gaps.
```

## Rules

- **Be honest.** Report mismatches and blockers plainly. Do not present a tuned or
  cherry-picked number as a clean reproduction.
- **Status legend:** ✓ reproduced · ~ partial · ✗ mismatch · ⛔ blocked · · pending.
- **Cite provenance.** Distinguish numbers from released checkpoints vs trained
  from scratch.
- **Report consistency, not just error.** When the paper gives mean ± σ, state how
  many σ the reproduced value sits from the reported mean (within ~2σ is
  statistically consistent), rather than leaning only on percentage error.
- **Make it standalone.** A reader who hasn't seen the session should understand
  what was done and how much of the paper holds up.

Finish by summarizing the outcome to the user and pointing them at the report.
