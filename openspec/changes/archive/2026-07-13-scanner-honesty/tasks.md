# Tasks: Scanner honesty

Branch: `exp/scanner-honesty`. Ship as one or two PRs with screenshots; the benchmark gates every code change that touches file discovery.

## 0. Decision (blocks 5)
- [x] Nilson picked **(a) remove the git-history claim** (2026-07-13). History scanning is not scoped; if a real signal asks for it, it becomes its own proposal.

## 1. Coverage toggles: real or gone
- [x] Wire `excludePaths` + file-category options into `discoverFiles` so they actually filter which files are read.
- [x] Delete `keyTypes` and `minConfidence` from the scan options surface (UI, request body, `ScanSession` columns, `scan-runner` defaults). Presets own confidence; narrowing patterns costs recall.
- [x] Re-run `scripts/benchmark-scanner.ts`: recall must hold at 91.7% with 0 FPs.

## 2. Progress
- [x] Subscribe to `progressUpdate` (not `progress`) in `scan-runner` and the background scan route.
- [x] Confirm the polled status route now returns moving counters and a working completion estimate.

## 3. Cancel
- [x] Keep running `SecurityScanner` instances in a module map keyed by session id; cancel calls `cancelScan()` and settles the session to `cancelled`.
- [x] Ensure the completing scan cannot overwrite a cancelled status.

## 4. Failure surfacing
- [x] Render a crit banner with the stored `errorMessage` for failed sessions, with a retry.
- [x] Count and disclose per-finding processing errors instead of silently undercounting.

## 5. Git history claim (per decision 0)
- [x] (a) Remove "Git history · committed secrets" from the coverage list and options interface; the baseline spec already records the limitation.
- [~] (b) Not chosen; if a real signal asks for history scanning it becomes its own proposal.

## 6. Verify
- [x] Drive the real app: toggle a category off and confirm excluded files are unread; cancel mid-scan; force a failure and see the banner; watch progress move.
- [x] Screenshots for the visible states; shipped as PR #8, squash-merged 2026-07-13 (246cd32).

## Deferred (tracked, not in this change)
- Dead code removal (`lib/local-scanner.ts`, the orphaned scanner-dashboard components, `POST /api/keys/[id]/rotate`, the unreachable workflow actions API) goes straight to main as invisible work.
- Discovery's other disclosed asymmetries (browser-folder provenance, GitHub-only scheduled re-scan) stay documented in the baseline spec.


## Notes from implementation (2026-07-13)

- The status route only ever returned pending/running sessions, so a failed scan was **invisible to the UI by construction**. Root cause of item 4; the route now also returns the last finished scan whatever its ending.
- The four `scanForXKeys` targeted helpers in `lib/scanner/index.ts` passed the dead `keyTypes` option and had zero importers; deleted with it.
- Cancel is single-process by design (module-level registry). A multi-node deploy would need the cancel flag in the DB and a poll inside the scan loop; noted in `lib/scan-registry.ts`.
