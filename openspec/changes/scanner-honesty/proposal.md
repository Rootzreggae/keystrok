# Proposal: Scanner honesty

## Why

Keystrok's whole differentiator is that it never claims more than it can prove. The key drawer, the blast radius, and the rotation ledger all hold that line. Discovery does not: it ships controls that do nothing, a progress bar that never moves, a cancel button that does not cancel, failures that look like success, and a coverage source we never built.

A baseline spec sweep (2026-07-13) found these with file-level evidence. None of them are new features; every one is a promise the UI already makes that the backend does not keep.

## What (in scope)

1. **Coverage toggles are inert.** `SecurityScanner` ignores `fileExtensions`, `excludePaths`, `keyTypes`, and `minConfidence`; it filters by hardcoded lists plus the preset confidence threshold. The Settings toggles (source / env / config / docker / git) and any key-type narrowing change nothing. Make them real or delete them.
2. **The progress bar is wired to a dead event.** The scanner emits `progressUpdate`; both consumers subscribe to `progress`. Session counters stay at zero until completion, so the polled progress UI and completion estimate are always empty.
3. **Cancel does not cancel.** The cancel endpoint flips a DB status but holds no handle on the running scanner, which keeps scanning and overwrites the status when it finishes.
4. **Failed scans look like a clean inbox.** `errorMessage` is stored and never surfaced; the page only flips out of "scanning".
5. **"Git history · committed secrets" is advertised and does not exist.** There is no git-history scan path, and GitHub clones are `--depth 1`, so a secret committed and later deleted is never found. This is the failure mode users fear most, so the claim is the most expensive one to leave standing.

## Non-goals

- No new detection patterns, no new providers, no new scan sources beyond deciding item 5.
- No redesign of the Discovery screen; this is honesty plumbing, not a visual pass.
- The scanner's other known asymmetries (browser-folder scans yield weaker provenance; only GitHub sources re-scan unattended) are documented in the baseline spec and stay as-is unless they turn out to be cheap to disclose in copy.

## Decision needed (blocks tasks)

**Item 5 has two honest endings and Nilson picks:**
- **(a) Remove the claim.** Drop "git history" from the coverage list; keep scanning working trees only. Cheap, immediately honest, but leaves the deleted-secret blind spot.
- **(b) Build it.** Scan git history for secrets (full clone or `--filter=blob:none` plus `git log -p`/`rev-list` walk), which finds committed-then-deleted secrets. Real work, real value, and it changes what "exposure" means for the ledger (a secret deleted from HEAD is still live on the platform, which is exactly the case Keystrok exists for).

Recommendation: **(a) now, (b) as its own proposal** if the Noxus pilot or Nilson's own use asks for it. Shipping honesty should not be blocked on building a scanner lane.

## Kill criterion

If fixing an item costs more than deleting the promise it makes, delete the promise. Any item that turns out to need a new subsystem (item 5b) leaves this change and becomes its own proposal.

## Success

Every control and status in Discovery is either real or removed. No screen in Keystrok claims a capability the code does not have.
