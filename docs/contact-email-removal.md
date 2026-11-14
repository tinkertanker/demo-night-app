# Stop collecting event-contact emails

This supersedes the 30-day event-contact retention policy. Keep organiser
`Admin.email`, Google OAuth `User.email`, accounts and sessions unchanged.

## Local implementation

- Presenter submission/editing and organiser editing/import/export have no contact
  email field. Unknown legacy `email` input is stripped by Zod before persistence.
- `Submission`, `Demo` and `Attendee` legacy columns are `@ignore`: Prisma neither
  reads nor writes them, even before deletion. Legacy partner email fields are
  removed from the event config contract and event read results.
- Each submission draft gets a random UUID used as the submission primary key.
  Resending that draft cannot insert twice (including concurrent requests). It
  does not identify a person: separate drafts/devices may submit the same project.
  We deliberately do not deduplicate by names or website, or require an account.
  A duplicate returns a receipt-only conflict, never an existing proposal.
- On any page load, known legacy draft/attendee localStorage keys across **all**
  events have only their email property removed. Submission restoration uses a
  field allowlist. Names, project text and attendee IDs survive.
- No schedules change. The deployed daily scrub retains its old cutoff and
  performs only its existing deletion, now through SQL for ignored columns. After
  the post-deploy deletion it has nothing to clear. Do not manually invoke it.

## Authorisation and deployment order

Yingjie approved implementation, contact deletion, commit/push, reviewed merge and
deployment in the contact-removal thread. Delivery remains subject to the review
and compatibility gates below. No production deletion has been performed by
preparing these files. The separately owned organiser-page crash fix is not part
of this rollout approval.

1. Verify the exact candidate revision locally and through the applicable review
   gate. Confirm approval covers the specific push/merge/deploy actions. Recheck latest
   main and migration/deployment scripts before delivery.
2. Deploy the compatible code **first**, using the normal release procedure after
   approval. No new automatic Prisma migration is included: `cf:deploy` runs
   migrations before code deployment, which would be unsafe for this deletion.
   Retain the nullable physical columns and existing indexes during rollout.
3. Verify that the new Worker serves 100% of traffic, that old server requests
   have drained, and that no old deployment remains a write target. Check the
   public form, private editor, organiser imports, sign-in and responses. A stale
   public form without a request UUID must fail validation, not fall back to
   email-based intake; stale edit/import email keys must be ignored.
4. With read-only SQL, record **counts only** of non-null emails in Submission,
   Demo and Attendee, and partner email properties in Event.config. Also record
   row counts for Event, Demo, Submission, Attendee, Vote, Feedback, EventFeedback,
   Award, Admin, User, Account and Session. Never export the addresses as evidence.
5. Only after these compatibility checks, run the reviewed
   `prisma/post-deploy/remove-contact-emails.sql` against the verified production
   database via the direct Neon connection. It is one transaction, nulls only the
   three contact columns, removes only partner `email` properties and adds
   constraints preventing recollection. A lock/statement timeout rolls back; do
   not remove the limits to force it through during an event.
6. Verify zero non-null contact values and partner email properties; verify all
   four constraints are validated and all row counts are unchanged. Confirm
   organiser sign-in/session access still works. Repeating the SQL is safe.

## Boundaries and rollback

No names, demos, submissions, events, votes, feedback, awards, attendee metadata or
organiser identity addresses are deleted. Free-text fields and links are not
regex-rewritten: someone can still voluntarily type an address there, and deleting
those strings could destroy requested project/feedback data. The notice asks
people not to include contact addresses. The static privacy contact address stays.

Offline browsers and old tabs cannot be remotely erased. Cleanup runs when updated
code loads; an old tab can still hold its previous draft until reloaded or site
data is cleared. Previously downloaded CSVs and Neon recovery copies are outside
this live-data deletion. Do not claim they have been erased; organiser-owned
exports require separate handling and Neon recovery retention must be confirmed
by the owner. Do not silently restore old contacts from a backup. The R2 bucket
`demo-night-backups` still holds pre-removal dumps under `2026-10-12/` (no
lifecycle expiry) that contain contact addresses; the nightly backup refuses to
dump until the four guards are validated.

Roll back only to code that also omits contact fields. The database guards
intentionally reject legacy email writes. Do not drop guards or roll back to an
email-collecting revision. The deletion is irreversible in the live database;
recovery is not an approved way to restore contact collection. The old daily
scrub remains scheduled and is not a substitute for the all-age deletion.
