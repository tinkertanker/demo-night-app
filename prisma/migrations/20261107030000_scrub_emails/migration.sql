-- Submission emails are cleared 30 days after their event, so the column
-- becomes optional. NULLs don't collide in the (eventId, email) unique index,
-- and the lowercase CHECK constraint passes for NULL.
ALTER TABLE "Submission" ALTER COLUMN "email" DROP NOT NULL;

-- Attendees now give only a name. Clear the email, LinkedIn and attendee type
-- an earlier version of the form collected.
UPDATE "Attendee"
SET email = NULL, linkedin = NULL, type = NULL
WHERE email IS NOT NULL OR linkedin IS NOT NULL OR type IS NOT NULL;
