import Link from 'next/link';

export const metadata = {
  title: 'Privacy · Quarterly',
  description: 'What Quarterly stores, what it does not, and where your data lives.',
};

/**
 * The privacy page.
 *
 * Every claim here is checked against the code, not aspirational. If any of it
 * stops being true, this page changes in the same commit — a privacy page that
 * drifts from the implementation is worse than none, because people rely on it.
 *
 * Current basis:
 *   - no database, no accounts, no analytics, no third-party scripts
 *   - state lives in localStorage (src/lib/store.ts), never leaves the device
 *   - the Canvas feed URL is deliberately excluded from stored state
 *   - /api/feed fetches server-side, never logs or persists the URL
 */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-[var(--faint)]">Last updated 18 August 2026</p>

      <p className="mt-6 text-[var(--muted)]">
        Short version: there are no accounts, no database and no analytics. Your schedule lives
        in your own browser. We can&rsquo;t see it.
      </p>

      <Section title="What stays on your device">
        <p>
          Your courses, assignments, availability, weekly commitments and planned blocks are
          stored in this browser&rsquo;s local storage. They are never sent anywhere. There is no
          server-side copy, which also means:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Your laptop and your phone hold separate, unsynced copies.</li>
          <li>Clearing site data for this site deletes everything, permanently.</li>
          <li>Nobody, including us, can recover it for you.</li>
        </ul>
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
          <li>It is <strong className="text-[var(--ink)]">not stored</strong>, in the browser or on the server.</li>
          <li>It is not written to any log.</li>
          <li>
            The server only accepts links on Canvas hosts, and refuses private and internal
            network addresses.
          </li>
        </ul>
        <p className="mt-2">
          Because it isn&rsquo;t stored, refreshing your Canvas data means pasting it again. That
          is a deliberate trade: a paste costs you seconds, and a leaked feed URL costs your
          privacy permanently.
        </p>
      </Section>

      <Section title="What we don't collect">
        <p>
          No accounts, no email address, no password. No analytics, no tracking pixels, no
          advertising, no third-party scripts of any kind. No cookies are set by this app.
        </p>
        <p className="mt-2">
          Our host, Vercel, keeps standard server request logs, which include IP addresses, as
          essentially every website does. We don&rsquo;t use them for anything.
        </p>
      </Section>

      <Section title="Who we share with">
        <p>Nobody. There is nothing to share and no arrangement to share it under.</p>
      </Section>

      <Section title="If this changes">
        <p>
          Adding accounts and sync would mean storing your schedule on a server, and that is a
          real change to everything above. If it happens, this page changes with it, before the
          feature ships, and existing users will be told plainly rather than opted in quietly.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>
          Clear this site&rsquo;s data in your browser settings, or use the reset control in{' '}
          <Link href="/setup" className="underline underline-offset-4">Set up</Link>. Both remove
          everything immediately. There is no copy elsewhere to request the deletion of.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Quarterly is built by a student at the University of Washington. Questions or concerns:{' '}
          <a href="mailto:bmwother1@gmail.com" className="underline underline-offset-4">
            bmwother1@gmail.com
          </a>
          . Ask and you&rsquo;ll get a straight answer about anything on this page.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-2 space-y-2 text-[var(--muted)]">{children}</div>
    </section>
  );
}
