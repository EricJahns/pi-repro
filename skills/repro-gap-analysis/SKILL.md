---
name: repro-gap-analysis
description: Analyze a paper's reference code repository against the paper to determine what is actually implemented versus missing, partial, or stubbed. Use when a GitHub repo (or local code) was provided for reproducing a paper, before planning the reproduction.
---

# Gap analysis: code vs paper

A reference repo almost never reproduces the whole paper. Your job is to map what
the code actually does onto the paper's claims, and write `.repro/gap.md` so the
plan can target the gaps.

## Steps

1. **Get the code.** Clone the repo (or read the local path). Note the commit/tag.
   Save clone notes under `.repro/sources/`.

2. **Orient.** Read the README, entry points, configs, scripts, and any
   `requirements`/`environment` files. Identify how results are meant to be
   produced (training scripts, eval scripts, notebooks, released checkpoints).

3. **Map components → code.** For each component of the method described in
   `.repro/paper.md`, find where (if anywhere) it lives in the code.

4. **Map claims → reproducibility.** For each registered claim, determine whether
   the repo can produce it and how.

## Classify honestly

For every method component and every claim, assign one of:

- **implemented** — present and runnable as described.
- **partial** — present but incomplete, or differs from the paper.
- **stubbed** — referenced but not functional (placeholder, `NotImplemented`,
  hardcoded values, results checked in without the code that made them).
- **missing** — described in the paper, absent from the repo.

Also flag, per claim where relevant:

- **pretrained vs from-scratch** — does the number come from released checkpoints,
  or must it be trained? Training-from-scratch is where reproductions usually fail.
- **data availability** — is the dataset/split obtainable, or gated/private?
- **number provenance** — are the repo's reported numbers reproducible, or just
  copied from the paper into the README?
- **environment risk** — pinned vs unpinned deps, known-broken versions.

## Output `.repro/gap.md`

Write a table plus prose:

| claim id | repo coverage | how to produce | risk / blocker |
|----------|---------------|----------------|----------------|

Then summarize: what you can reproduce directly, what needs implementation work,
and what is likely blocked (and why). This summary feeds straight into the plan.

Hand back to **repro-create** for planning. Where the repo is missing/partial, the
plan must include implementing those pieces from the paper before reproducing the
affected claims.
