import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { it } from "node:test";
import { Client } from "pg";

// Run the actual migration history and deletion SQL in an isolated local schema.
// No production connection or pre-existing table can be touched.
assert.ok(
  ["localhost", "127.0.0.1", "::1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
);

it("deletes all-age event contacts only, preserves other data and prevents recollection", async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const schema = `contact_test_${crypto.randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const name of (await readdir("prisma/migrations")).sort()) {
      if (name === "migration_lock.toml") continue;
      await client.query(
        await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
    }
    await client.query(`
      INSERT INTO "Event" (id, name, date, url, secret, config) VALUES
        ('past', 'Past event', '2001-01-01', '', 'secret-past', '{}'),
        ('future', 'Future event', '2099-01-01', '', 'secret-future',
         '{"custom":"preserved","partners":[{"name":"One","url":"https://one.example","description":"First","email":"one@example.com","custom":7},{"name":"Two","email":"two@example.com"}]}');
      INSERT INTO "Attendee" (id, name, email, linkedin, type) VALUES
        ('shared', 'Shared attendee', 'organiser@example.com', 'https://example.com/profile', 'Founder'),
        ('orphan', 'No event', 'orphan@example.com', NULL, NULL);
      INSERT INTO "_AttendeeToEvent" ("A", "B") VALUES ('shared', 'past'), ('shared', 'future');
      INSERT INTO "Demo" (id, "eventId", index, name, secret, email, description) VALUES
        ('demo-past', 'past', 0, 'Past demo', 'demo-secret-past', 'past@example.com', 'Preserved description'),
        ('demo-future', 'future', 0, 'Future demo', 'demo-secret-future', 'future@example.com', 'Preserved too');
      INSERT INTO "Submission" (id, "eventId", name, tagline, description, email, url, "pocName", "updatedAt") VALUES
        ('proposal-past', 'past', 'Old project', 'Tagline', 'Text', 'old@example.com', 'https://example.com', 'Ada', now()),
        ('proposal-future', 'future', 'New project', 'Tagline', 'Text', 'new@example.com', 'https://example.com', 'Grace', now());
      INSERT INTO "Award" (id, "eventId", index, name, description) VALUES ('award', 'future', 0, 'Award', 'Kept');
      INSERT INTO "Vote" (id, "eventId", "attendeeId", "awardId", "demoId", amount, "updatedAt") VALUES
        ('vote', 'future', 'shared', 'award', 'demo-future', 14000, now());
      INSERT INTO "Feedback" (id, "eventId", "attendeeId", "demoId", comment, "updatedAt") VALUES
        ('feedback', 'future', 'shared', 'demo-future', 'Keep my feedback', now());
      INSERT INTO "EventFeedback" (id, "eventId", "attendeeId", comment, "updatedAt") VALUES
        ('event-feedback', 'future', 'shared', 'Keep event feedback', now());
      INSERT INTO "User" (id, email, name) VALUES ('organiser', 'organiser@example.com', 'Organiser');
      INSERT INTO "Admin" (id, email) VALUES ('admin', 'organiser@example.com');
      INSERT INTO "Session" (id, "sessionToken", "userId", expires) VALUES ('session', 'session-token', 'organiser', '2099-01-01');
      INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId") VALUES ('account', 'organiser', 'oauth', 'google', 'google-id');
    `);
    const tables = (
      await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
        [schema],
      )
    ).rows.map((row) => row.tablename);
    const snapshot = async () => {
      const result: Record<string, Record<string, unknown>[]> = {};
      for (const table of tables) {
        result[table] = (
          await client.query<{ row: Record<string, unknown> }>(
            `SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`,
          )
        ).rows.map((entry) => entry.row);
      }
      return result;
    };
    const expected = await snapshot();
    for (const table of ["Submission", "Demo", "Attendee"]) {
      for (const row of expected[table]!) row.email = null;
    }
    for (const row of expected.Event!) {
      const config = row.config as { partners?: Record<string, unknown>[] };
      for (const partner of config.partners ?? []) delete partner.email;
    }
    const sql = await readFile(
      "prisma/post-deploy/remove-contact-emails.sql",
      "utf8",
    );
    await client.query(sql);
    assert.deepEqual(await snapshot(), expected);
    await client.query(sql);
    assert.deepEqual(await snapshot(), expected, "Deletion is idempotent");
    for (const table of ["Submission", "Demo", "Attendee"]) {
      await assert.rejects(
        client.query(`UPDATE "${table}" SET email = 'recollected@example.com'`),
        { code: "23514" },
      );
    }
    await assert.rejects(
      client.query(
        `UPDATE "Event" SET config = '{"partners":[{"email":"recollected@example.com"}]}'`,
      ),
      { code: "23514" },
    );
    const constraints = await client.query<{ convalidated: boolean }>(
      "SELECT convalidated FROM pg_constraint WHERE connamespace = $1::regnamespace AND conname IN ('Submission_no_contact_email', 'Demo_no_contact_email', 'Attendee_no_contact_email', 'Event_no_partner_email')",
      [schema],
    );
    assert.equal(constraints.rowCount, 4);
    assert.ok(constraints.rows.every((constraint) => constraint.convalidated));
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
