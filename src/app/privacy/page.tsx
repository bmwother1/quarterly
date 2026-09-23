import Link from 'next/link';

export const metadata = {
  title: 'Privacy · Heron',
  description: 'What Heron stores, what it does not, and where your data lives.',
};

/**
 * The privacy page.
 *
 * Every claim here is checked against the code, not aspirational. If any of it
 * stops being true, this page changes in the same commit — a privacy page that
 * drifts from the implementation is worse than none, because people rely on it.
 *
 * **That rule was broken once and it is worth recording.** Accounts, sync and
 * telemetry landed across three commits on 23 August and this page was not
 * touched. For a day it told students there were no accounts, no database and no
 * analytics, and that their schedule never left the device, while their whole
 * week sat in `plan_state` as JSON. Rewritten 24 August against the code.
 *
 * Current basis, file by file:
 *   - localStorage is the primary store (src/lib/store.ts); the app works fully
 *     signed out and nothing leaves the device in that mode
 *   - accounts are optional, magic link only, no password (src/supabase/auth.ts)
 *   - signed in: plan_state holds the same object as localStorage;
 *     app_event holds kind + timestamp + small numeric detail
 *     (src/supabase/sync.ts, src/supabase/events.ts)
 *   - telemetry carries no titles or course names — see the Detail type
 *   - RLS on every table, owner-only (supabase/migrations/0001_init.sql)
 *   - delete_own_account() removes the auth row and everything cascades
 *     (supabase/migrations/0002_account_deletion.sql)
 *   - calendar links are never stored on the server and never logged
 *     (src/app/api/feed/route.ts), and never enter HeronState, so sync and
 *     backup cannot carry them (src/lib/store.ts)
 *   - any public host is fetched; private addresses are refused on the resolved
 *     address and every redirect (src/app/api/feed/fetch-feed.ts)
 *   - if the student opts in, links are kept in this browser under their own
 *     key (src/lib/feed-store.ts), checked daily on open (use-feed.ts), removed
 *     by Forget and by heronStore.clear()
 *   - imported events record host and calendar name only (FixedEvent.source)
 *   - imported .ics files are parsed in the browser and never uploaded
 */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-12 pt-8 sm:pt-12">
      <h1 className="text-heading font-semibold">Privacy</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Last updated 21 September 2026</p>

      <p className="mt-6 text-title font-normal text-[var(--ink)]">
        Short version: Heron works with no account at all, and in that mode your schedule
        never leaves your browser. If you make an account, your week and a small usage log are
        stored on our server so they survive a lost phone. You can delete all of it, permanently,
        from Settings.
      </p>

      <Section title="If you never sign in">
        <p>
          Your courses, assignments, availability, weekly commitments and planned blocks are
          stored in this browser&rsquo;s local storage and are never sent anywhere. There is no
          server-side copy, which also means:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Your laptop and your phone hold separate, unsynced copies.</li>
          <li>Clearing site data for this site deletes everything, permanently.</li>
          <li>Nobody, including us, can recover it for you.</li>
        </ul>
        <p className="mt-2">
          This is the default. Nothing asks you to sign in before you have a working week.
        </p>
      </Section>

      <Section title="If you do sign in">
        <p>Three things are then stored on our server, and nothing else:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong className="text-[var(--ink)]">Your email address.</strong> Used to send you a
            sign-in link and to know which week is yours. There is no password, anywhere, so
            there is none to leak.
          </li>
          <li>
            <strong className="text-[var(--ink)]">Your week.</strong> The same data described
            above, stored as one record so a new device can pick it up. It is your schedule, so
            it does contain your course names and what you called things.
          </li>
          <li>
            <strong className="text-[var(--ink)]">A usage log.</strong> One row when you open the
            app, plan a week, mark a block done or skipped, move a block, or import a calendar.
          </li>
        </ul>
      </Section>

      <Section title="What the usage log does and doesn't contain">
        <p>
          Each row is an event name, a timestamp, and sometimes a number: minutes, or a count of
          blocks. It never contains the title of an assignment, a course code, or anything you
          typed. We keep it because whether students still use this in week four is the one
          thing that tells us if it works, and that is answerable from timestamps alone.
        </p>
        <p className="mt-2">
          It is append-only by design. The app can add rows and read its own, and deliberately
          cannot edit or delete them, because a retention number you can quietly rewrite is not
          a measurement.
        </p>
      </Section>

      <Section title="Who can read your data">
        <p>
          Only you. Every table has row-level security tied to your account, enforced by the
          database rather than by the app, so a bug in the app cannot expose another
          student&rsquo;s week.
        </p>
        <p className="mt-2">
          The key the browser uses is public by design and is visible to anyone who looks. That
          is how this kind of database is meant to work: the key identifies the project, and
          row-level security is what actually protects the data.
        </p>
        <p className="mt-2">
          Brydon, who builds this, can technically read the database, in the same way any
          developer can read their own server. Nobody else has access, and it is not sold,
          shared, or used for advertising.
        </p>
      </Section>

      <Section title="Your calendar links">
        <p>
          A Canvas feed, a work schedule link, a Google or Outlook calendar address: each is a
          credential. Anyone holding one can read that calendar, indefinitely, without logging
          in. So they get handled carefully:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            A link is sent to our server only to fetch that calendar, because browsers cannot
            fetch calendars from other sites directly.
          </li>
          <li>
            It is <strong className="text-[var(--ink)]">never stored on our server</strong>,
            signed in or not, and it is never written to any log.
          </li>
          <li>
            The server will fetch a link from any public website, since work scheduling apps
            are too many to list, but never from a private or internal network address. That is
            checked on the actual address it connects to, and again on every redirect.
          </li>
        </ul>
        <p className="mt-2">
          You can ask Heron to <strong className="text-[var(--ink)]">remember a link on this
          device</strong>. That is a checkbox on the import page, shown after the calendar loads
          and next to what it found. It is ticked by default and untick&shy;ing it takes one tap.
          When it is on, the link is kept in this browser&rsquo;s local storage and nowhere else,
          and Heron uses it to check that calendar once a day when you open your week:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            It is not part of your account. Signing in syncs your week; it does not sync your
            links, so they never reach our server or your other devices.
          </li>
          <li>They are not included in the backup file you can download.</li>
          <li>
            Each link has its own <strong className="text-[var(--ink)]">Forget</strong> button,
            in Settings and on the import page, which removes it immediately. Delete my data
            removes them all, and so does clearing this site&rsquo;s data.
          </li>
          <li>
            The daily check adds new work into free time and says what it added. It never moves
            anything already in your week without you asking.
          </li>
        </ul>
        <p className="mt-2">
          Why offer it at all: instructors publish all quarter, often the same week something is
          due, and managers post new shifts every week. A plan built on week one&rsquo;s calendars
          is quietly wrong by week four. Without a saved link, fixing that means finding it again,
          which for Canvas realistically means a laptop. With it saved, it happens by itself. The
          trade is yours to make, in both directions, at any time.
        </p>
      </Section>

      <Section title="Calendar files">
        <p>
          A <code>.ics</code> file you import is read in your browser and never uploaded. It does
          not touch our server at all.
        </p>
      </Section>

      <Section title="Deleting everything">
        <p>
          <strong className="text-[var(--ink)]">Delete my data</strong> in{' '}
          <Link href="/settings" className={LINK}>Settings</Link> removes
          your account, your week and your entire usage log, then clears this browser. It is
          immediate and there is no recovery, for you or for us.
        </p>
        <p className="mt-2">
          If you only want to stop syncing, sign out instead. That leaves your week on this
          device and deletes nothing.
        </p>
      </Section>

      <Section title="What we don't do">
        <ul className="list-disc space-y-1 pl-5">
          <li>No advertising, and no advertising or tracking scripts.</li>
          <li>No selling or sharing of your data with anyone.</li>
          <li>No third-party analytics.</li>
          <li>No reading of your Canvas account. Only the calendar feed you paste.</li>
        </ul>
      </Section>

      <Section title="Questions">
        <p>
          Email <a href="mailto:bmwother1@gmail.com" className={LINK}>
          bmwother1@gmail.com</a>. The code is{' '}
          <a
            href="https://github.com/bmwother1/heron"
            className={LINK}
            rel="noreferrer"
          >
            public
          </a>
          , so every claim on this page can be checked rather than taken on trust.
        </p>
      </Section>
    </main>
  );
}

const LINK = 'text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]';

/**
 * One question the page answers. Body text is 16px: this is the page people
 * read closely when they are deciding whether to trust the app, and 14px grey
 * made it the hardest page in the product to read.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 max-w-prose space-y-2 text-base text-[var(--muted)]">{children}</div>
    </section>
  );
}
