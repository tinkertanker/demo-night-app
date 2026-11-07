import Link from "next/link";

import Sticker from "~/components/Sticker";

export const metadata = { title: "Privacy notice" };

const CONTACT_EMAIL = "hello@tk.sg";

// Keep this notice in step with what the code stores and shows: the Prisma
// schema, the public tRPC procedures and the attendee localStorage keys.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 text-black">
      <Link href="/" className="inline-block">
        <Sticker name="face" size={64} />
      </Link>
      <h1 className="pt-4 text-3xl font-bold tracking-tight">Privacy notice</h1>
      <p className="pt-1 text-sm text-gray-500">Last updated 7 November 2026</p>

      <div className="space-y-8 pt-6 leading-7 text-gray-800 [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-black [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        <p>
          The Demo Night App is run by Tinkertanker Pte Ltd (Tinkercademy) in
          Singapore. This page explains what the app stores when you join an
          event, give feedback, vote, submit a demo or sign in as an organiser,
          and who can see it.
        </p>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Attendees</strong> don&apos;t make an account. Your
              browser gets a random ID for each event, linked to the name you
              enter, your feedback (ratings, claps, cheers, confetti, postcards,
              badges and comments), your votes or investments, any comment about
              the event and whether you opened the event survey. We don&apos;t
              ask attendees for an email.
            </li>
            <li>
              <strong>Presenters</strong> who submit a demo give their name,
              email, project name, website, tagline, description and an optional
              demo link. Organisers add a review status, rating and notes. We
              use your email only for event logistics, never for marketing.
            </li>
            <li>
              <strong>Organisers</strong> sign in with Google. We store the
              name, email and profile picture Google shares, plus the sign-in
              tokens it issues. Only emails on the admin list can sign in.
            </li>
            <li>
              <strong>Everyone:</strong> our host, Cloudflare, receives your IP
              address and browser details to serve pages, and keeps request logs
              for 7 days so we can fix problems.
            </li>
          </ul>
        </section>

        <section>
          <h2>Who can see it</h2>
          <ul>
            <li>
              <strong>Anyone</strong> can see event details and each demo&apos;s
              name, tagline and website, including in recaps and the Hall of
              Fame. Award winners and vote totals are shown only if the event
              has a leaderboard. Individual votes, names and emails are never
              shown publicly.
            </li>
            <li>
              <strong>Presenters</strong> get a private link to their demo that
              shows every piece of feedback on it with the name you entered, and
              lets them download it. On the event screen, feedback is shown
              without your name.
            </li>
            <li>
              <strong>Organisers</strong> can see everything above, including
              who voted for what, so they can check for duplicate or unfair
              votes. Submissions, including presenter emails, are seen only by
              organisers and the reviewers they share the submissions link with.
              If a submission becomes a demo, its email is also shown on that
              demo&apos;s private presenter link.
            </li>
          </ul>
        </section>

        <section>
          <h2>Stored in your browser</h2>
          <p>
            As an attendee, the app keeps your event ID and name, your last join
            code, and copies or drafts of your feedback and votes in your
            browser&apos;s local storage, so you can carry on if you reload. The
            demo submission form keeps a draft, including your email, until you
            submit it; if you leave without submitting, it stays until you clear
            your site data. Clearing your site data removes them from your
            browser but not from our database. Cookies are used only for
            organiser sign-in and an admin layout setting. There are no
            analytics or advertising trackers.
          </p>
        </section>

        <section>
          <h2>Where it&apos;s stored</h2>
          <p>
            The app runs on Cloudflare Workers, and data is stored in a Neon
            Postgres database hosted on AWS in Singapore, with the app set to
            run close to it. Organiser sign-in goes through Google. Links to
            presenter websites and event surveys take you to other sites with
            their own privacy policies.
          </p>
        </section>

        <section>
          <h2>Keeping and deleting your data</h2>
          <p>
            Emails given for an event, such as presenter emails, are deleted
            automatically 30 days after it. Everything else, including names,
            feedback and votes, stays until an organiser deletes it, and
            deleting an event does not delete its attendee entries, so names can
            remain. Organisers&apos; sign-in details are kept. There&apos;s no
            self-service delete: to see, correct or delete what we hold about
            you, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-blue-600 underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and an organiser will do it. To help us find your attendee entry,
            tell us the event and the name you used.
          </p>
        </section>
      </div>

      <p className="pt-10 text-sm font-semibold text-gray-600">
        <Link
          href="/"
          className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
        >
          Back to home
        </Link>
      </p>
    </main>
  );
}
