# Design: Scanner honesty

## Constraints carried from the codebase

- `SecurityScanner.scanContent` filters patterns **only** by `confidenceThreshold` (the preset's). Honoring `keyTypes` would *reduce* recall, because `scan-runner` passes a narrow 11-type default list that predates the detection-benchmark work. This was flagged and deliberately parked once already; it must not be silently "fixed" into a regression.
- Detection quality is protected by `scripts/benchmark-scanner.ts` (91.7% recall, 0 FPs on the seeded corpus). Any change touching pattern selection or file discovery must re-run it and hold the line.
- The three scan sources have genuinely different capabilities (server path: presets + git provenance; browser folder: contents only, no git; GitHub: shallow clone). Options that only make sense for one source must not appear global.

## Decisions

### 1. Coverage toggles: make them real, at the file-discovery layer only

Wire `excludePaths` and the file-category toggles into `discoverFiles` (they are honest, cheap filters on *which files are read*). Do **not** wire `keyTypes` or `minConfidence` into `scanContent`: narrowing patterns lowers recall, and the presets already own confidence. Instead, delete `keyTypes`/`minConfidence` from the scan options surface entirely so no caller can believe in them.

Net: a toggle either filters files (real) or is gone (honest). The Settings UI keeps the file-category toggles; any key-type narrowing disappears from UI, request shape, and DB column.

### 2. Progress: fix the event name, not the architecture

The scanner already emits `progressUpdate` with the numbers the UI wants. Subscribe to the right event in both consumers (`scan-runner`, the background scan route) and let the existing 2.5s poll render it. No new plumbing; the estimate function starts working the moment the counters move.

### 3. Cancel: hold the scanner handle

Keep the running `SecurityScanner` instance in a module-level map keyed by session id; cancel looks it up and calls the existing `cancelScan()`, then lets the scan settle to `cancelled` instead of letting completion overwrite it. Single-process only, which matches the self-host deployment model; note the limitation in the spec rather than building a job queue.

### 4. Failure surfacing: one banner, the stored message

Discovery already stores `errorMessage` and already returns it from the status route. Render it: a failed scan gets a crit banner with the message and a retry, and never renders as an empty inbox. Same for a scan that completes with per-finding processing errors (currently swallowed): count them and say so.

### 5. Git history: remove the claim (pending Nilson's call)

Drop "Git history · committed secrets" from the coverage list and the options interface. If he picks (b), this task is replaced by a separate proposal, because history scanning changes the exposure model (a secret deleted from HEAD is still live) and needs its own design.

## Verification

- `node --import ./scripts/register-alias.mjs scripts/benchmark-scanner.ts` must still report 91.7% recall / 0 FPs after the discovery-layer filtering change.
- Drive the real app: run a scan with a category toggled off and confirm the excluded files are not read; cancel a scan mid-flight and confirm it stops and stays cancelled; force a failure and confirm the banner.
- Screenshots for the visible parts (progress moving, cancel, failure banner) per the PR convention.
