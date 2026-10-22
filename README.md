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

With `agent-browser` installed, `yarn test:postcard-drafts` uses the same local
server/database to exercise a delayed postcard save across a live phase change
and reload, then checks that the newer draft is restored and saved.

Voter exclusions require the `20260916093000_event_voter_exclusions` migration
before deploying the updated app. Exclusion keeps allocations but removes them
from totals and automatic winners for that event; Restore includes them again.
This is name-based moderation, not identity verification: a new browser can still
join as a new attendee.

### Voting units and postcards

New events default to the editable **Pitching** template with money allocation.
**Categories** starts with three editable named awards, one choice per category,
independent tallies and one winner/reveal per category (the same project can win
multiple categories). It can also use allocations per category. **No Leaderboard**
starts with favourite stickers and suppresses public rankings, winner reveals,
recap awards, Hall-of-Fame winners and public vote totals, even if older winner
records remain. Organiser moderation and private totals remain available.
Organisers can choose thumbs-ups, stars, points, or dollars for allocation.
Allocation mechanics stay at 100,000 per attendee per votable award,
with 1,000-unit precision and 5,000/25,000 buttons. Changing the displayed unit
does not rescale stored allocations. Configs without the new fields retain
legacy dollar allocations for Pitch Night and award choices for Demo Night.

School-friendly favourite stickers are a separate mode: five per attendee by
default (organiser-configurable 1–10), shared across the event, at most one per
project, on the first-place award (or first votable award if none is first-place).
Stickers can be taken back. The one-per-project
cap follows the app's existing distinct-favourite convention.
Templates, mechanics and allowance cannot change once votes exist; changing a
template never replaces existing awards, votes or postcards. Existing categories
can be edited in Awards & Voting. Displayed units and feedback goals
can still change.

Feedback postcards work during demo/pitch sessions and voting, with every
template and voting mode, including after allowances
run out. Any optional prompt, additional comment, or free appreciation badge is
enough. Badges never consume votes or enter winner totals. Personal passport
progress counts distinct projects with text or badges, including legacy comments;
empty drafts and reaction-only entries do not count. Goals are optional and there
is no leaderboard or required watch/comment/vote sequence.

Apply `20261015000000_feedback_postcards` before running the updated app. It adds
nullable prompt columns and an empty badge-array default, preserving comments,
ratings and reactions. Run `yarn test` and `yarn test:voters` for the unit and local
API contracts. No production migration or deployment is performed by these tests.

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
