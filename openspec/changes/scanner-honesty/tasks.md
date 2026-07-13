# Tasks: Scanner honesty

Branch: `exp/scanner-honesty`. Ship as one or two PRs with screenshots; the benchmark gates every code change that touches file discovery.

## 0. Decision (blocks 5)
- [ ] Nilson picks item 5: **(a)** remove the git-history claim, or **(b)** split history scanning into its own proposal.

## 1. Coverage toggles: real or gone
- [ ] Wire `excludePaths` + file-category options into `discoverFiles` so they actually filter which files are read.
- [ ] Delete `keyTypes` and `minConfidence` from the scan options surface (UI, request body, `ScanSession` columns, `scan-runner` defaults). Presets own confidence; narrowing patterns costs recall.
- [ ] Re-run `scripts/benchmark-scanner.ts`: recall must hold at 91.7% with 0 FPs.

## 2. Progress
- [ ] Subscribe to `progressUpdate` (not `progress`) in `scan-runner` and the background scan route.
- [ ] Confirm the polled status route now returns moving counters and a working completion estimate.

## 3. Cancel
- [ ] Keep running `SecurityScanner` instances in a module map keyed by session id; cancel calls `cancelScan()` and settles the session to `cancelled`.
- [ ] Ensure the completing scan cannot overwrite a cancelled status.

## 4. Failure surfacing
- [ ] Render a crit banner with the stored `errorMessage` for failed sessions, with a retry.
- [ ] Count and disclose per-finding processing errors instead of silently undercounting.

## 5. Git history claim (per decision 0)
- [ ] (a) Remove "Git history · committed secrets" from the coverage list and options interface; the baseline spec already records the limitation.
- [ ] (b) If chosen instead: close this task and open a `git-history-scanning` proposal (it changes the exposure model and needs its own design).

## 6. Verify
- [ ] Drive the real app: toggle a category off and confirm excluded files are unread; cancel mid-scan; force a failure and see the banner; watch progress move.
- [ ] Screenshots for the visible states; PR per the standing convention; merge is Nilson's call.

## Deferred (tracked, not in this change)
- Dead code removal (`lib/local-scanner.ts`, the orphaned scanner-dashboard components, `POST /api/keys/[id]/rotate`, the unreachable workflow actions API) goes straight to main as invisible work.
- Discovery's other disclosed asymmetries (browser-folder provenance, GitHub-only scheduled re-scan) stay documented in the baseline spec.
