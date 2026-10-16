# Demo Night App 🧬

**The [Demo Night App (DNA)](https://demos.aicollective.com) is an open-source, community-led project we use to maximize value for all involved at our flagship demo night events!**

![App Screenshots](./assets/App.png)

<a href="https://www.loom.com/share/20bb08ab431040cf878a8a654860efab">
  <img src="https://cdn.loom.com/sessions/thumbnails/20bb08ab431040cf878a8a654860efab-29f338a04a89eb3c-full-play.gif">
</a>

## 🚀 What is Demo Night?

_An evening of live demos and collaboration with the innovators shaping tomorrow_. Here's an [example event](https://lu.ma/demo-night)!

## 🧑‍💻 Contributing

If you'd like to contribute to this community project, check out our [issues](https://github.com/the-ai-collective/demo-night-app/issues) to find tasks you can help with!

Feel free to reach out to us at [engineering@aicollective.com](mailto:engineering@aicollective.com)! 😄

## ⚙️ Getting Started

### 1. Install the packages

```bash
yarn install
yarn global add dotenv-cli
```

### 2. Set up environment variables

For `.env` key/value pairs, see `.env.example`.

### 3. Start the local DB Docker Compose service

```bash
./start-database.sh
```

### 4. Push the schema and seed the local DB with a "<test@example.com>" example account and test event

```bash
yarn db:push
yarn db:seed
```

### 5. Start the development server

```bash
yarn dev
```

- The local app should now be available at `localhost:3000` and `localhost:3000/admin`!
- You can log in with "<test@example.com>"

### Tests

Run `yarn test` for unit tests. With the development server and local database
running, run `yarn test:voters` for voting/moderation integration tests. Set
`TEST_BASE_URL` if the server uses a port other than 3000. These tests create and
clean up their own events and admin session, and refuse remote databases or URLs.

Voter exclusions require the `20260916093000_event_voter_exclusions` migration
before deploying the updated app. Exclusion keeps allocations but removes them
from totals and automatic winners for that event; Restore includes them again.
This is name-based moderation, not identity verification: a new browser can still
join as a new attendee.

## 📊 Data Ops

### Dev Data Studio

To manipulate the data and relations directly via Prisma during local development:

```bash
yarn db:studio
```

### Migration

To alter the data schema (adding/removing/editing columns, changing unique/compound/primary keys, etc.), make changes in `schema.prisma` file, save, and run:

```bash
yarn db:migrate
```

- Fixing failed migrations:
  <https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing>

### Production backups

Production Postgres runs on Neon (project `demo-night`, branch `production`).
Neon's own point-in-time restore only covers 6 hours on the Free plan, so the
[Nightly database backup](.github/workflows/nightly-db-backup.yml) workflow runs
at 03:00 Singapore time (and on demand via **Run workflow**). It takes a
`pg_dump -Fc` over the direct (non-pooled) connection as the read-only
`backup_reader` role and uploads it to the private R2 bucket `demo-night-backups`
as `nightly/YYYY-MM-DD/postgres.dump` (Singapore date). An R2 lifecycle rule
deletes objects under `nightly/` after 30 days.

Repository secrets: `NEON_BACKUP_DATABASE_URL`, `R2_BACKUP_ACCESS_KEY_ID`,
`R2_BACKUP_SECRET_ACCESS_KEY` (an R2 token scoped to that bucket only).

To restore, download a dump and load it into an empty database (for example a
new Neon branch), then point the app at it once checked:

```bash
aws s3 cp s3://demo-night-backups/nightly/2026-10-13/postgres.dump . \
  --endpoint-url https://b8b1032c61d9475cd00229c74db7ec72.r2.cloudflarestorage.com
pg_restore --list postgres.dump            # inspect
pg_restore --no-owner --no-privileges -d "$TARGET_DATABASE_URL" postgres.dump
```

`scripts/backup.sh` is the legacy backup for the self-hosted Docker Compose
deployment and does not back up Neon.
