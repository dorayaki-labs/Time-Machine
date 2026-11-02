# Contributing to Time Machine

## For everyone: contribute through the website

The **only** intended contribution path for archive content is the website
itself:

1. Sign in with Discord (one click, top-right).
2. Open **Contribute** and pick the matching form — missing episode, metadata
   correction, character or gadget info, images, viewing source, broken
   source report, or a reference.
3. Fill it in. The form validates as you go; the server validates again and
   applies rate limits (a short cooldown between submissions, a cap on
   pending submissions per account).
4. Submit. You get a contribution number immediately. Follow its status in
   **My contributions** — pending, accepted (with the archive commit), or
   declined (with the reviewer's reason).

Every submission is reviewed by a human checker before anything is published.
Declined submissions stay visible to you with the reason; nothing is silently
discarded.

You do **not** need a GitHub account, and you never edit JSON to contribute.

## For developers: source contributions

Code improvements happen through this repository:

1. Fork and branch.
2. `npm install && npm run validate` must pass before you commit.
3. `npm run build` must succeed; keep the bundle small (the app is
   intentionally single-chunk).
4. Open a pull request describing what changed and why.

Do not commit secrets, `.env` files, or archive data containing copyrighted
media — links to hosted sources are fine; embeds are the exception already
handled by the viewing-source schema.

## Roles

- **Guest** — browse, search, read statistics and the contribution log.
- **Member** — everything above, plus submitting contributions and seeing
  their own private history.
- **Checker** — reviews, accepts, declines or deletes submissions; edits the
  archive directly (always audited).
- **Admin** — everything a checker can do, plus managing checkers and
  recovering failed archive updates.
- **Owner** — the project lead; also appoints and revokes admins.

Role management is documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md),
Tutorial G.
