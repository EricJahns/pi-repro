---
name: repro-ingest
description: Read an academic paper and extract its method, datasets, hyperparameters, compute needs, and every reproducible quantitative result into structured claims. Use as the first step of reproducing a paper, after init_reproduction.
---

# Ingest a paper into claims

Goal: turn the paper into (a) a self-contained `.repro/paper.md` and (b) a
registered claim for every quantitative result you intend to reproduce.

## Get the text

- **arXiv id or arXiv URL** → prefer the HTML version (`https://arxiv.org/abs/<id>`
  and the `ar5iv`/HTML full text) over the PDF; it is far easier to parse tables.
  Fall back to the PDF if HTML is unavailable.
- **DOI / publisher URL** → fetch the landing page; find an open-access PDF/HTML.
- **Local PDF** → read it directly.
- Save anything you download under `.repro/sources/`.

## Fill in `.repro/paper.md`

Capture, concisely but completely:

- **Summary** — what the paper does and its main claims.
- **Method** — the algorithm/model/architecture, enough to implement it.
- **Datasets** — names, sizes, splits, preprocessing, and where to obtain them.
- **Hyperparameters & training setup** — optimizer, lr schedule, batch size,
  epochs/steps, seeds, regularization, anything needed to reproduce.
- **Compute requirements** — hardware, wall-clock, and rough cost. Flag early if
  reproduction needs resources the user may not have.

## Identify claims

Go through the paper's **tables, key figures, and ablations**. For each
*quantitative* result you plan to reproduce, call `register_claim` with:

- a stable `id` (e.g. `table2-cifar10-acc`),
- `metric_name`, `reported_value`, `unit`,
- `direction` (`higher`/`lower` = better) so beating the paper still counts,
- `source_ref` (e.g. "Table 2, row CIFAR-10"), `dataset`, and any `notes`.

Guidance:

- **Prioritize headline results** — the main table and the central figure — over
  exhaustive ablation grids. Register the most load-bearing claims first; you can
  add more later.
- **Separate reproducible from qualitative.** Numbers in tables are claims.
  Qualitative statements ("our method is more robust") are not — note them in
  `paper.md` but don't register them.
- **One number per claim.** A table row with 4 columns is 4 claims if you intend
  to reproduce all 4.
- **Note the provenance** when a reported number depends on pretrained weights,
  external data, or a specific seed — it affects how you reproduce it.

When done, hand back to **repro-create** (next: gap-analysis if a repo exists,
otherwise planning).
