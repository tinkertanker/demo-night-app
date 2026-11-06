-- Store every email in lowercase so emails match case-insensitively.
--
-- Stop before changing anything if lowercasing would give two rows the same
-- unique email. Those rows need a person to decide which one to keep, so the
-- migration lists their ids instead of merging or deleting them.
DO $$
DECLARE
  collisions text;
BEGIN
  SELECT string_agg(format('%s: %s', scope, ids), E'\n') INTO collisions
  FROM (
    SELECT 'Admin' AS scope, string_agg(id, ', ' ORDER BY id) AS ids
    FROM "Admin"
    GROUP BY lower(email)
    HAVING count(*) > 1
    UNION ALL
    SELECT 'User', string_agg(id, ', ' ORDER BY id)
    FROM "User"
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING count(*) > 1
    UNION ALL
    SELECT 'Submission in event ' || "eventId", string_agg(id, ', ' ORDER BY id)
    FROM "Submission"
    GROUP BY "eventId", lower(email)
    HAVING count(*) > 1
  ) duplicates;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION E'Lowercasing emails would merge these rows. Resolve them, then rerun the migration:\n%', collisions;
  END IF;
END $$;

UPDATE "Admin" SET email = lower(email) WHERE email <> lower(email);
UPDATE "User" SET email = lower(email) WHERE email <> lower(email);
UPDATE "Submission" SET email = lower(email) WHERE email <> lower(email);
UPDATE "Demo" SET email = lower(email) WHERE email <> lower(email);
UPDATE "Attendee" SET email = lower(email) WHERE email <> lower(email);

-- With every stored email lowercase, the existing unique indexes on these
-- columns also reject emails that differ only in case.
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_email_lowercase" CHECK (email = lower(email));
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK (email = lower(email));
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_email_lowercase" CHECK (email = lower(email));
