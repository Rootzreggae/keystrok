# Connecting GitHub

Keystrok scans repos through a GitHub App that **you** create and own. Your instance talks to GitHub as your own app, with credentials that live in your database. There is no shared Keystrok app in the middle, and no third party in the path.

## First connection

Open **Discovery → Connect a source → GitHub**. The first time through, Keystrok walks you through creating the App using GitHub's manifest flow:

1. Keystrok pre-fills the App configuration and sends you to GitHub to approve it. One click creates the App under your account.
2. GitHub hands the new App's credentials back to your instance, which stores them encrypted.
3. You then install the App and pick which repositories it can see: a hand-picked list or all repos on the account.

The App asks for read-only contents access. That is the whole footprint.

## What a repo scan does

When you scan a connected repo (or the scheduled scan does it for you):

1. Your instance shallow-clones the repo to a temporary directory.
2. The scanner reads the files and records findings as masked previews and hashes. Full secret values are never stored.
3. The clone is deleted. Nothing is ever pushed, committed, or written back.

## What re-scans automatically

Only connected GitHub sources. If you point a scheduler at `/api/cron/scan` (see [Self-hosting](./self-hosting.md)), every active source is re-scanned on that cadence and new findings land in Discovery on their own. Local folder scans are always manual; the browser mediates them, so nothing unattended is possible there.

## Choosing repos, and the too-many-repos problem

Repo selection lives on GitHub, in the App's installation settings. If you installed on all repositories, the Sources panel will list all of them; the filter box above the list (it appears past 8 repos) keeps that navigable. If you would rather see fewer, change the installation to selected repositories on GitHub.

## Disconnecting and starting over

Each connected account in the Sources panel has a **Disconnect** action (admin-only). Disconnecting:

- removes the account and its repos from the Sources panel,
- stops scheduled re-scans for it,
- keeps your findings and scan history, because they are records of what happened, not configuration.

Honest limit: Keystrok cannot uninstall its GitHub App for you. Disconnecting stops Keystrok from using the access; to revoke the access itself, uninstall the app under **GitHub → Settings → Applications → Installed GitHub Apps**. To start over, disconnect here, then connect again.
