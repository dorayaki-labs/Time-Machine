# Time Machine

A free, community-driven archive documenting the Doraemon franchise: every
episode, movie, character, and gadget in one open catalogue — with viewing
sources, metadata, and full change tracking.

**By the community, for the community.** Anyone can browse; anyone with a
Discord account can contribute through the website's forms; trusted checkers
review every submission before it reaches the archive.

## What the project does

- **The archive** — episodes (1979, 2005 series and the historical 1973
  series), movies, characters and gadgets, each with titles (English and
  Japanese), release data, summaries, screenshots and viewing sources.
- **The contribution system** — account holders edit any entry directly
  ("Edit this entry" on its page, reviewed before it goes live) or submit
  corrections, missing entries, images and viewing sources through in-site
  forms. Submissions are rate-limited, validated server-side, reviewed by
  human checkers, and every accepted change is committed to the archive's
  JSON files on GitHub with a
  complete before/after change record.
- **The public record** — the Statistics page and the public Contribution log
  show real numbers and every accepted contribution. Nothing is hardcoded.

## Architecture

| Piece | Technology | Cost |
| --- | --- | --- |
| Frontend | React + Vite static site, hosted on GitHub Pages and Surge | free |
| Archive data | JSON files in this GitHub repository (single source of truth) | free |
| Auth | Discord OAuth via Supabase Auth (free tier) | free |
| Database | Supabase Postgres — accounts, roles, contributions, audit log | free |
| Backend logic | Supabase Edge Functions (Deno) — validation, moderation, GitHub commits, Discord notifications | free |
| Notifications | Discord webhook via a server-side function only | free |

The site is fully static. The public archive keeps working even if the
backend is temporarily unavailable; account/contribution features degrade to
friendly notices instead of errors.

Key directories:

```
src/                 React frontend (pages, components, lib)
public/archive/      the archive: index.json rosters + one JSON per entry
public/data/         characters, gadgets, languages, categories
supabase/
  migrations/        complete SQL schema + RLS policies (run in SQL Editor)
  functions/         Edge Functions (contribute, review, direct-edit, manage-role, reconcile-sync)
scripts/             catalog validator + build/deploy helpers
docs/                deployment, backup and security documentation
```

## Run the frontend locally

```bash
npm install
npm run dev        # http://localhost:5173 — the archive works with no backend
npm run validate   # checks every archive JSON file
npm run build      # production build into dist/
```

## Access

- Live site: GitHub Pages (this repository) and a Surge mirror.
- The archive JSON files are the data — `public/archive/` — readable by
  anyone, usable anywhere.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The primary way to contribute is the
website's forms — no GitHub account needed, just Discord.
