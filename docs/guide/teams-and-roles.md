# Teams and roles

One Keystrok instance is one shared workspace. Keys, findings, rotations, platforms, and the activity feed are visible to every member; the point of a security tool for a team is that everyone sees the same truth. Per-user state is deliberately tiny: your assistant provider config and your appearance preferences.

## Getting people in

Sign-in is passwordless magic-link, and the door is allowlisted. Someone can sign in if their email is:

- in `ALLOWED_EMAILS` or under `ALLOWED_EMAIL_DOMAINS`, or
- invited from the Team page (admin action), or
- anyone, if you set `AUTH_OPEN_REGISTRATION=true`. Remember that means anyone lands in the same shared workspace.

The first user on a fresh instance becomes the admin. Invited users arrive with the role on their invite.

**If invites are not arriving**, your instance is probably still delivering mail to the bundled local catcher. See [Self-hosting](./self-hosting.md); the Team page shows where mail currently goes.

## The two roles

**Member** covers the daily work: triaging findings, tracking keys, entering exposure dates, asserting consumers, running rotations up to the revoke step, using the assistant, reading everything. Entering evidence is triage, not destruction, so it is open to everyone.

**Admin** gates the actions that are irreversible or touch the instance itself:

- team management (invites, role changes, removing members)
- platform credentials (adding, changing, re-testing connections)
- alert and email delivery settings
- server-path scans and the manual liveness trigger
- disconnecting a GitHub source
- the revoke step in a rotation

## Safety properties

- **There is always an admin.** The last active admin cannot be demoted or removed; if the workspace somehow ends up adminless, the earliest active user is promoted automatically.
- **Removal is soft.** A removed member's keys, findings, and receipts stay, attributed to them; a security trail with holes in it is not a trail. Removal also revokes access even if their email is still on the allowlist.
- **Actions are attributed.** The activity feed records who did what, member and admin alike.
