# Scanning

Discovery finds exposed keys by reading your code. Scans are read-only, always: nothing is written, committed, or modified, and found secrets are stored as masked previews and hashes, never as full values.

## Three ways to scan

**A connected repo** is the main path. The server shallow-clones the repo, scans it, and deletes the clone. Works the same on your laptop or a headless box, and it is the only kind of scan that can re-run on a schedule. See [Connecting GitHub](./connecting-github.md).

**A local folder through the browser** (Discovery → Scan a local folder → Browse). Your browser reads the files and sends their contents to your instance for scanning. Nothing needs to exist on the server, so this works against any folder on the machine you are sitting at. One-off by nature.

**A server path** (the text input under Scan a local folder). This one reads the filesystem of the machine *running Keystrok*, not yours. It exists for the case where your code and your Keystrok instance are on the same machine. If you run Keystrok in a container, there is usually nothing useful to point it at; scan a connected source instead. Admin-only, and paths are restricted to the server user's home directory with system paths blocked.

## What the scanner looks for

Detection covers AWS, Stripe, GitHub, Slack, Grafana, Datadog, New Relic, Dynatrace, OpenAI, Google, Sentry, and generic high-entropy secrets in environment variables. Coverage spans source code, environment files, and config files, with Docker files off by default (they are mostly base-image noise); the Coverage line in the Sources panel shows what is on.

Every scanner change is gated by a benchmark before it ships: the current bar is 91.7% recall with zero false positives on the test corpus. When detection claims something is a secret, that claim has been paid for.

## Triage

Findings land in an inbox grouped by file, critical first. Each one gets a decision:

- **Track** promotes it to the Keys ledger and starts its rotation clock. Deliberate by design; bulk-track exists but confirms the count and severity mix first.
- **Dismiss** marks it as not-a-secret. Dismissals survive re-scans: the same finding will not reappear and nag you. Bulk dismiss has an undo window.

A re-scan refreshes known findings in place instead of duplicating them, so scanning often is free of noise.

## When a scan fails

A failed or cancelled scan says so, in a banner, with the actual reason. It never silently pretends the inbox is clean; the findings you see below a failure banner are from earlier scans, and the banner says that too. Scans can be cancelled mid-run, and a cancelled scan settles as cancelled, not completed.
