# Keys and rotation

The Keys ledger is every secret you decided to track, each with a severity, a liveness verdict, a blast radius, and a rotation deadline. The design rule underneath all of it: **Keystrok only claims what it can prove.**

## Deadlines are anchored to discovery

Keystrok does not know how old a key really is; nobody does from the outside. So every rotation deadline counts from the moment the key was *found*, never from a guessed creation date:

| Severity | Rotate within |
| --- | --- |
| Critical | 7 days of discovery |
| High | 30 days |
| Medium | 60 days |
| Low | 90 days |

If you know the key was exposed *before* Keystrok found it, you can set an exposure date on the key. It only works in one direction: an earlier exposure pulls the deadline in. A data-entry mistake can make a key more urgent, never safer.

## Liveness: which keys still work

Connect a platform (Settings → Platforms) and Keystrok checks whether a leaked key is still alive out there. A dead key is a chore; a live one is an incident. The ledger shows this per key: **LIVE**, **revoked**, or **unverified**.

Honest limit: verification requires a platform API that lists keys with a matchable fingerprint. Today that is **Datadog and AWS**. Other platforms (Stripe, GitHub, Grafana, and the rest) validate that your *own* credentials work, but cannot confirm whether a specific leaked key is still active, so their keys stay "unverified" rather than getting a made-up verdict.

## Blast radius: what breaks if you rotate

Each key shows where it is exposed (sites, and how many of those sit inside deploy pipelines) plus any consumers you assert yourself ("the billing service uses this"). If a key is still in use but nothing is mapped, the ledger holds a warning: rotating blind is how outages happen. You can either map the consumers or explicitly **accept the break**, which is you signing that the cost is understood.

## Guided rotation

Rotation is a step-by-step runbook: issue the new key, roll it out, revoke the old one, in that order. Two honest properties:

- **The steps are taken on trust.** Keystrok does not watch your infrastructure; a step you mark done is your word. The runbook says this in so many words.
- **Only evidence closes an exposure.** After the revoke step, a key on a verifiable platform (Datadog, AWS) gets a liveness re-check. "Old key verified dead" is the only verdict that closes the incident. On platforms that cannot verify, the outcome is "Receipted by you", which is exactly what it sounds like. And if a re-check finds the old key still alive after rotation, the key goes back to the top of the pile as a failed rotation; it does not stay quietly "done".

Keystrok never rotates or revokes anything on its own. The irreversible actions are yours, deliberately.
