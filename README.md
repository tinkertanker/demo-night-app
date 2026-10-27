# Demo Night App

Tinkercademy's app for demo and pitch events: project submissions, live
presentations, attendee feedback, and award voting.

Originally based on [The AI Collective's Demo Night App](https://github.com/the-ai-collective/demo-night-app),
with thanks to its creators and contributors. This project is now independently
maintained and is no longer in the original repository's GitHub fork network.

Configured deployment: [demo-night.tk.sg](https://demo-night.tk.sg).

## Features

- Manage events, submissions, projects, awards, and voter moderation.
- Run multiple live events, each with a four-character join code and presenter
  view. Attendees join on `/` or at `/<CODE>`.
- Choose **Pitching** (allocations, the default), **Categories** (one choice per
  award), or **No Leaderboard** (favourite stickers without public totals or
  winners). Templates and voting settings are editable until votes exist.
- Collect feedback postcards with prompts, comments, and appreciation badges,
  plus optional personal feedback goals. Badges never consume votes.
- Reveal winners and show recaps and Hall-of-Fame results where settings allow.

Admins use `/admin`, with per-event presentations at `/admin/[eventId]/present`.
Submission forms are at `/[eventId]/submit`, past winners at `/hall-of-fame`, and
API documentation at `/api`.

## Local development

Requires Node.js 22, Yarn Classic 1.22.21, Docker with Compose, and Google OAuth
credentials for admin sign-in. `dotenv-cli` is included; no global install needed.

```bash
git clone https://github.com/tinkertanker/demo-night-app.git
cd demo-night-app
yarn install --frozen-lockfile
cp .env.example .env.development.local
```

Edit `.env.development.local`:

- Keep both database URLs pointed at local PostgreSQL.
- Set `NEXTAUTH_URL`, `NEXT_PUBLIC_URL`, and `NEXT_PUBLIC_BASE_URL` to
  `http://localhost:3000` (replace the example's upstream base URL).
- Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, with OAuth redirect URI
  `http://localhost:3000/api/auth/callback/google`.

Copy the configured file for Prisma, then start the services and app:

```bash
cp .env.development.local .env
./start-database.sh
yarn db:push
yarn db:seed
yarn dev
```

Keep both environment files in sync; they are gitignored. Never commit secrets.
Compose starts PostgreSQL 16, Redis, and a Redis HTTP bridge. Live event state
now uses PostgreSQL; Redis and the example's `KV_*` settings are legacy.

On your local machine, open `http://localhost:3000` or
`http://localhost:3000/admin`. To sign in, use `yarn db:studio` to add your Google
account's lowercase email to the `Admin` table. Seeding adds `test@example.com`
and sample event `DEMO`, but provides **no login bypass**. Make the event live in
the dashboard before joining by code.

For Amp orbs, `.agents/setup` prepares dependencies and sample data;
`amp orb services ensure` starts supervised services and returns a portal URL.
The setup's placeholder Google credentials do not enable real sign-in.

## Checks

```bash
yarn lint
yarn test
yarn build
```

With the local server and database running, `yarn test:voters` checks voting,
moderation, and postcard APIs. `yarn test:postcard-drafts` also needs
`agent-browser` and checks draft recovery across delayed saves, phase changes,
and reloads. Both create and clean up fixtures and refuse remote targets.
Set `TEST_BASE_URL` for a local server port other than 3000.

## Voting and feedback

Allocations give each attendee 100,000 units per votable award, in steps of 1,000.
Changing display units does not rescale votes. Favourite stickers default to five
per attendee (configurable 1–10), shared across projects with at most one per
project; stickers can be taken back. Categories have independent winners.

Once votes exist, templates, mechanics, and allowances are locked; display units
and feedback goals remain editable. No Leaderboard hides public totals and winners,
including recaps and Hall of Fame, but keeps private organiser totals.
Voter exclusion retains allocations while removing them from totals and automatic
winners; restoration includes them again. This is name-based moderation, not
identity verification—a new browser can join as a new attendee.

Postcards work during presentations and voting, even after vote allowances run
out. Personal progress counts distinct projects with text or badges, not empty
drafts or reactions alone.

## Development and deployment

Built with Next.js 14, React, TypeScript, tRPC, Prisma/PostgreSQL, NextAuth (Google),
and Tailwind/shadcn/ui. See [AGENTS.md](./AGENTS.md) for the code layout and guidance.

Use `yarn db:studio` to edit local data and `yarn db:migrate` for schema migrations
(`yarn db:migrate:create` creates without applying). `db:push` is for local setup;
existing deployments need all committed migrations via `yarn db:migrate:deploy`.
Do not apply migrations to shared databases without deployment approval.

Cloudflare Workers/OpenNext and Neon are configured in `wrangler.jsonc` and
`open-next.config.ts`; Worker secrets are listed in `wrangler.jsonc`.
`yarn cf:build` builds and `yarn cf:preview` previews. **`yarn cf:deploy` applies
database migrations, adds admin allowlist entries, and deploys**, requiring
database and Cloudflare credentials. Docker deployment files are also included.

Report bugs and propose changes in [Issues](https://github.com/tinkertanker/demo-night-app/issues).
Robot mascot assets are from [tkrobot-stickers](https://github.com/tinkertanker/tkrobot-stickers),
copied into `public/images/stickers`.
