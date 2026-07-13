# Proposal: Honest claims (tier 2)

## Why

The first honesty tier fixed controls that did nothing. This one fixes screens that say things the code cannot back, and one deeper problem: **Keystrok currently behaves like two different products depending on which pixel you look at.**

Found by the baseline capability sweep (2026-07-13). Again: no new features, only promises we already made.

## Decision (made, veto by editing this file)

**Keystrok is a shared workspace. The per-user filters are bugs.**

Evidence: Teams shipped (invites, roles, admin-gated destructive actions), the Noxus pilot has multiple devs in one instance, keys/findings/workflows/platforms/activity are all instance-wide, and `lib/recent-activity.ts` says "shared workspace: no userId filter" in its own comment. Two surfaces disagree with all of that, and they are the odd ones out:

- **Posture / hygiene** (`lib/posture-data.ts`) filters to the signed-in user. So Home's operational band ("Needs action", "Tracked") counts everyone's keys while the hygiene band right below it (SLA compliance, MTTR, exposure days) counts only yours. Two numbers, side by side, different denominators, no disclosure.
- **The assistant** (`lib/assistant.ts`) reasons over only the current user's keys. In a team, it silently omits teammates' keys and gives confidently incomplete advice.

The per-user *assistant provider config* (each member brings their own LLM key) stays per-user; that is correct. It is the *context* that must be shared.

## What (in scope)

**A. One workspace**
1. Posture/hygiene metrics computed instance-wide, matching every other surface.
2. Assistant context built from all workspace keys, findings, and workflows.

**B. Screens that overclaim**
3. **"Rotation complete" card** asserts unconditionally that "the old key verified idle, then revoked. The exposure is closed" — including for rotations that failed verification, which the outcome ledger contradicts two clicks away. It must state the verdict it actually earned.
4. **Runbook claims Keystrok "watches traffic" and pre-fills checks.** It does neither: no step is automated, nothing is verified, a completed step is trusted. There is even a dead "Keystrok runs this check" branch for automated steps that never exist. Copy must match behavior, dead branch deleted.
5. **Platforms empty state** promises liveness for Grafana, Stripe, and GitHub (which can never deliver it) and omits AWS (which can). The key drawer already tells this truth; the platforms page contradicts it.
6. **Radius cell double-counts.** "3 sites · 1 pipe" reads as four locations when pipelines are a subset of sites. The drawer discloses the relationship; the table does not.
7. **"Observed" tag overstates.** The platform-usage row in Consumed by is tagged `observed`, but it is an aggregate last-used timestamp, not an observed consumer identity. In a panel built entirely on the distinction between observed and asserted, this one word undoes the point.

**C. One anchoring bug**
8. `expiration-alerts` anchors to discovery (`foundAt`) instead of the risk start, so it ignores attested and git-derived exposure dates that every other surface honors.

## Non-goals

- No new metrics, no new panels, no visual redesign.
- Dead code removal (`lib/local-scanner.ts`, the orphaned scanner-dashboard tree, the unused rotate route, the unreachable workflow actions API) ships separately as invisible work.
- The rotated-status vs rotatedAt divergence is a data-integrity question, not a claim: parked unless it bites.

## Kill criterion

If a fix requires inventing a capability rather than telling the truth about an existing one, it leaves this change and becomes its own proposal.

## Success

Every number on Home counts the same population. The assistant sees what the operator sees. No screen claims a verification, a capability, or a count that the code cannot produce.
