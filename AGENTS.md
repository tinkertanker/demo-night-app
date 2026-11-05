# AGENTS.md

Demo Night App (DNA) is a Next.js 14 (App Router) app for running demo night events: demo submissions, attendee feedback, award voting and live event administration. Prisma on PostgreSQL, tRPC, NextAuth with Google OAuth, Tailwind and shadcn/ui.

## Local development

Follow the README's local setup, including the `.env.development.local` and `.env` copies before `yarn db:push`. `dotenv-cli` is a dev dependency; do not install it globally. `yarn db:seed` creates the `test@example.com` account used for local testing.

- Database changes require migrations via `yarn db:migrate` (`yarn db:migrate:create` to create without applying).
- Use absolute imports with the `~/` prefix.
- APIs are tRPC routers: `publicProcedure` for unauthenticated endpoints, `protectedProcedure` for endpoints that require login. Procedures need Zod input validation.

## Live events

Several events can be live at once. Each event has a 4-character `joinCode`; attendees join at `/<CODE>` (or type it on `/`), and each live event has its own presenter view at `/admin/[eventId]/present`. Live presentation state (phase, current demo/award) is stored per event in the `LiveEvent` table (a row exists only while the event is live), with the durable phase in `Event.livePhase`.

## Hosting

Production runs on Cloudflare Workers (OpenNext) at https://demo-night.tk.sg with Neon Postgres (project `demo-night`, AWS Singapore). Deploy with `DATABASE_URL_NON_POOLING=<direct Neon URL> yarn cf:deploy`, which applies migrations, ensures admins and deploys. The old Docker setup on dev.tk.sg (`deploy.sh`, `docker-compose.prod.yml`) is retired.

## Icons and mascot

Use assets from [tinkertanker/tkrobot-stickers](https://github.com/tinkertanker/tkrobot-stickers) (local copies in `public/images/stickers/`). Prefer `Sticker` / `MascotLogo` over the old Pitch Night / Demo Night logos. The default chrome icon is `face`; event lists use a seeded positive pose via `MascotLogo`.
