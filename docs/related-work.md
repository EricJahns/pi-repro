# Related work and influences

pi-repro is a practical tool, not a research contribution. It sits downstream of a
growing line of work on **agentic reproduction of scientific papers**, and borrows
ideas from it.

## The landscape

Most prior work in this space builds **benchmarks** that measure how well LLM
agents reproduce published results on a fixed corpus, usually scored by an
LLM-as-judge and often with the original code made available to the agent.
Representative efforts include CORE-Bench, PaperBench, Paper2Code, AutoReproduce
and FIRE-Bench (machine-learning papers), and REPRO-Bench, PaperRepro,
ReplicatorBench and related work on the empirical social sciences.

Of particular relevance is Kohler et al., *Read the Paper, Write the Code: Agentic
Reproduction of Social-Science Results* (2026), which reproduces results from a
paper's **methods description and data alone** — withholding the original code —
and evaluates the output **deterministically** against the paper's reported
numbers, grading each value in a way that accounts for statistical significance
(sign agreement and the original confidence interval / standard error) rather than
raw percentage error.

## Where pi-repro differs

- **A tool, not a benchmark.** pi-repro helps a user reproduce *one* paper of their
  choosing, interactively; it does not measure agent capability over a corpus.
- **General and computational.** It targets ML / systems / computational papers
  (training runs, datasets, accuracy/AUC/R²), not social-science regression tables.
- **Code-aware by design.** When a paper ships code, pi-repro analyzes what is and
  isn't implemented and asks the user whether to use it or reimplement from
  scratch. The opposite of the deliberate code-isolation used to *measure* paper
  sufficiency.
- **A durable artifact.** The `.repro/` session (claims, gap analysis, plan,
  report) is a work-product the user owns and can hand off.

## Borrowed idea, adapted

pi-repro's claim grading is **uncertainty-relative**: when a paper reports a value
as mean ± σ, agreement is judged in units of σ (within ~2σ ≈ statistically
consistent), and it falls back to a relative-tolerance check when no σ is given.
The significance-aware spirit of this — judging reproduction against the result's
own reported uncertainty rather than a fixed percentage — is adapted from the
deterministic grading in Kohler et al. (2026). The σ-optional fallback and the
framing around *stochastic* reproduction (seeds, hardware nondeterminism) are
specific to this tool's setting.

See `extensions/pi-repro/claims.ts` (`compare`) for the implementation.
