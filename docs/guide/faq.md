# FAQ

Honest answers to the questions that actually come up.

## Invites and sign-in links never arrive

The bundled mail catcher (Mailpit) traps all outgoing email locally; that is the default so solo setup needs zero email config. Open `http://localhost:8025` and your mail is there. For real delivery, set `EMAIL_SERVER_*` or `RESEND_API_KEY` and restart. The Team page shows where mail is currently being delivered.

## The scan failed with "Target path does not exist"

You are on an older image where the server-path scan defaulted to a folder that does not exist inside a container. Update to the current image (the default is gone; a pathless scan now tells you what to do instead of failing). Either way, the answer is the same: if your code is in a Git repo, scan it from the Sources panel. The server-path input is only for code that lives on the same machine as Keystrok itself.

## Which platforms can actually verify a leaked key is live?

**Datadog and AWS**, today. Verification needs a platform API that lists keys with a fingerprint Keystrok can match against a masked preview. Other platforms validate that your own connection works, but cannot confirm a specific leaked key's status, so their keys honestly stay "unverified" instead of getting a fake verdict. The UI says this per platform when you connect one.

## What does the AI assistant see?

Metadata only: key names, platforms, severities, deadlines, liveness verdicts, findings, rotation states. It never sees, requests, or emits a secret value, and it cannot rotate or revoke anything; it points you at the guided runbook instead. The assistant is bring-your-own-model (Anthropic, any OpenAI-compatible endpoint, or local via Ollama), your API key for it is encrypted at rest, and if you point it at a local model, nothing leaves your machine at all.

## What does Keystrok store about my secrets?

A masked preview (first and last few characters) and a hash for deduplication. Never the full value; there is no "reveal" because there is nothing to reveal. Platform credentials you connect (for liveness checks) are stored encrypted with AES-256-GCM using your `ENCRYPTION_KEY`.

## If I register a key by paste, can I register it twice?

Not the same key twice by paste: registration checks your paste against the hashes of other manually registered keys and refuses a twin. But here is the honest limit: a key that entered the ledger through Discovery **cannot** be duplicate-checked, because Keystrok never kept its raw value (there is nothing to compare a paste against). Pasting a key that Discovery already tracks creates a second, unlinked ledger entry. If you spot a twin, delete one. The reverse direction does work: a scan that finds a manually registered key in your code links to the tracked key and records it as an exposure, instead of opening a new finding.

## Does Keystrok ever write to my repos?

No. Repo scans are shallow clones into a temp directory, read, then deleted. The GitHub App asks for read-only contents access, so GitHub enforces this independently of our word.

## How do I get rid of a connected GitHub source and start over?

Discovery → Sources → **Disconnect** on the account (admin-only). Repos leave the list and stop re-scanning; your findings history stays. Keystrok cannot uninstall its GitHub App for you: to revoke the access itself, remove the app under GitHub → Settings → Installed GitHub Apps. Then connect again fresh.

## Can I open my instance to anyone?

`AUTH_OPEN_REGISTRATION=true`. Know what it means: one instance is one shared workspace, so every sign-up sees the same keys and findings as you. It exists for teams who gate access at the network layer instead, not for public instances.

## Something is wrong and it is not in this list

Open an issue: [github.com/Rootzreggae/keystrok/issues](https://github.com/Rootzreggae/keystrok/issues). Real bug reports are a gift; you will not be told to check the docs you just read.
