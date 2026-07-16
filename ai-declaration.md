# AI Use Declaration

Keystrok is built by one person, a product designer, with AI as the engineering
partner. This file states plainly where AI was used and how much, using the
levels from the c/selfhosted posting rules (Hint, Assisted, Pair, Generated).

The short version: the product is mine. What it does, what it deliberately
*won't* do (it never rotates or revokes a key on its own), how it should feel,
and the rule that it only ever claims what the code can actually prove, those
are human calls. The code that implements them is a collaboration, written and
reviewed with AI in the loop. I mention it plainly, not defensively.

## Where AI was used

- **Design (architecture, system design): Pair.** I set the product direction,
  the scope, and the honesty constraints; AI proposes data models and structure
  and I direct, reject, and decide. Example: "a rotation deadline is anchored to
  when a key was *discovered*, never a guessed creation date" is a human product
  call the architecture was shaped to enforce.

- **Implementation (production code): Generated.** AI writes the bulk of the
  production code from my direction. I review it, and I reject the parts that
  overclaim. A recurring job is catching code that *says* something the backend
  cannot actually do, and cutting it.

- **Testing (tests, QA): Generated.** AI writes the tests and the secret
  detection benchmark; I set the bar for what "working" means and what a passing
  gate has to hold (for detection: recall and zero false positives).

- **Documentation (README, docs, changelogs): Pair.** AI drafts; the voice and,
  more importantly, the *claims* are mine. The README's honesty positioning is a
  product decision, not generated copy.

- **Review (code review, PR feedback): Pair.** AI reviews the code for
  correctness; I do the design and product review, and I am the one who catches
  a screen promising something it can't deliver.

- **Deployment (CI/CD, Docker): Generated.** AI wrote the Docker and CI setup. I
  operate the self-hosted instance and decide what ships.

## What this means for trust

Judge the work, not the method. The self-host path is verified end to end,
secrets are encrypted at rest (AES-256-GCM), rotation is advisory and
operator-gated, and the optional AI assistant only ever sees key *metadata*,
never the secret values. Find a bug or a bad call? Open an issue. I would rather
fix it than defend it.
