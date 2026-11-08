-- POST-DEPLOY ONLY. Not part of `prisma migrate deploy`: the deploy script runs
-- migrations BEFORE publishing compatible code. See docs/contact-email-removal.md.
-- No row deletions, no free-text rewriting, no Admin/User changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "Submission" SET email = NULL WHERE email IS NOT NULL;
UPDATE "Demo" SET email = NULL WHERE email IS NOT NULL;
UPDATE "Attendee" SET email = NULL WHERE email IS NOT NULL;

-- A legacy optional contact field also lived in Event.config.partners.
-- Preserve array order, all other config keys, and all other partner fields.
UPDATE "Event" e SET config = jsonb_set(config, '{partners}', (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN jsonb_typeof(partner) = 'object' THEN partner - 'email' ELSE partner END
    ORDER BY position
  ), '[]'::jsonb)
  FROM jsonb_array_elements(e.config->'partners') WITH ORDINALITY AS p(partner, position)
))
WHERE jsonb_typeof(config->'partners') = 'array'
  AND jsonb_path_exists(config, '$.partners[*].email');

-- Guard against stale clients, imports or an accidental old-code rollback.
-- Nullable legacy columns remain for compatibility with the unchanged cron.
ALTER TABLE "Submission" DROP CONSTRAINT IF EXISTS "Submission_no_contact_email";
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_no_contact_email" CHECK (email IS NULL);
ALTER TABLE "Demo" DROP CONSTRAINT IF EXISTS "Demo_no_contact_email";
ALTER TABLE "Demo" ADD CONSTRAINT "Demo_no_contact_email" CHECK (email IS NULL);
ALTER TABLE "Attendee" DROP CONSTRAINT IF EXISTS "Attendee_no_contact_email";
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_no_contact_email" CHECK (email IS NULL);
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_no_partner_email";
ALTER TABLE "Event" ADD CONSTRAINT "Event_no_partner_email"
  CHECK (NOT jsonb_path_exists(config, '$.partners[*].email'));
COMMIT;
