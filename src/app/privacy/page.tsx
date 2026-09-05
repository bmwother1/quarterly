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
 *   - the Canvas feed URL is still deliberately never stored
 *   - imported .ics files are parsed in the browser and never uploaded
 */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-[var(--faint)]">Last updated 24 August 2026</p>

      <p className="mt-6 text-[var(--muted)]">
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

      <Section title="Your Canvas feed URL">
        <p>
          That link is a credential. Anyone holding it can read your whole schedule, indefinitely,
          without logging in. So it gets handled carefully:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            It is sent to our server once, only when you press the button, so that we can fetch
            the calendar. Browsers cannot fetch it directly.
          </li>
          <li>
            It is <strong className="text-[var(--ink)]">not stored</strong>, in the browser or on
            the server, signed in or not.
          </li>
          <li>It is not written to any log.</li>
          <li>
            The server only accepts links on known calendar hosts, and refuses private and
            internal network addresses.
          </li>
        </ul>
        <p className="mt-2">
          Because it isn&rsquo;t stored, refreshing your Canvas data means pasting it again. That
          is a deliberate trade: a paste costs you seconds, and a leaked feed URL costs your
          privacy permanently.
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
          <Link href="/settings" className="underline underline-offset-4">Settings</Link> removes
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
          Email <a href="mailto:bmwother1@gmail.com" className="underline underline-offset-4">
          bmwother1@gmail.com</a>. The code is{' '}
          <a
            href="https://github.com/bmwother1/heron"
            className="underline underline-offset-4"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-2 space-y-1 text-sm leading-relaxed text-[var(--muted)]">{children}</div>
    </section>
  );
}
