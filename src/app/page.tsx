import Link from 'next/link';

export const metadata = {
  title: 'Quarterly',
  description: 'Your week, planned around the life you actually have. Free for students.',
};

/**
 * The landing page.
 *
 * It leads with building a week by hand rather than with Canvas, and that order
 * is deliberate. Canvas feeds carry 30 days back and a year forward, so between
 * quarters they are genuinely empty — and instructors publish assignments when
 * they publish the course, often in the final week before term. Opening with
 * "paste your Canvas feed" in August asks the one question the product cannot
 * answer yet, and a first impression of "this is broken" is not recoverable.
 */
export default function Landing() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
      <h1 className="rise text-[2rem] font-semibold leading-[1.1] sm:text-[2.75rem]">
        A plan that survives you{' '}
        <span className="text-[var(--accent)]">falling behind</span>.
      </h1>
      <p className="rise mt-5 text-lg leading-relaxed text-[var(--muted)]">
        Every planner works until the week goes wrong. Quarterly is built for the Wednesday when
        it does: mark what you actually did, and it rebuilds the rest around what&rsquo;s left.
        Free for students.
      </p>

      <div className="rise mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/start"
          className="rounded-xl bg-[var(--accent)] px-5 py-3.5 text-center font-medium text-[var(--accent-ink)] shadow-[var(--shadow-md)] transition-transform active:scale-[0.98]"
        >
          Plan my week
        </Link>
        <Link
          href="/canvas"
          className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-3.5 text-center font-medium transition-colors hover:bg-[var(--raised)] active:scale-[0.98]"
        >
          Connect Canvas
        </Link>
      </div>

      <p className="rise mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
          No account needed
        </span>
        <span className="text-[var(--faint)]">
          Nothing to install. Takes about 30 seconds.
        </span>
      </p>

      <section className="mt-16 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        <Item title="Fall behind and it rebuilds around you">
          Mark what you did, skipped or half-did, then replan from right now. Most planners make
          you redo the whole week by hand, which is the moment people quietly stop using them.
        </Item>

        <Item title="It plans the hours, not just the list">
          A to-do list tells you what&rsquo;s due. Quarterly works out when each piece actually
          happens, in sessions long enough to be worth sitting down for, around the time you
          already gave to class, work and sleep.
        </Item>

        <Item title="Every block says why it&rsquo;s there">
          &ldquo;Session 2 of 4, due Thursday.&rdquo; &ldquo;You haven&rsquo;t touched CHEM in six
          days.&rdquo; If you can&rsquo;t see the reason for a block, you won&rsquo;t do it, so
          the reason is always on the block.
        </Item>

        <Item title="It tells you when the week doesn&rsquo;t fit">
          Most planners quietly overbook you and let Thursday find out. Quarterly shows you what
          it couldn&rsquo;t fit and why, while you can still do something about it.
        </Item>
      </section>

      <section className="mt-14 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-5">
        <h2 className="font-medium">If it&rsquo;s summer, start with your week</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Canvas feeds only carry 30 days back and a year forward, and instructors publish
          assignments when they publish the course — often in the last week before term. So
          between quarters your feed is genuinely empty, and that&rsquo;s expected rather than
          broken.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your shifts, your sleep, your training and whatever you&rsquo;re building don&rsquo;t
          wait for a quarter to start. Set those up now and your coursework drops into a week
          that&rsquo;s already shaped around you.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-medium">What it won&rsquo;t claim</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          It won&rsquo;t promise better grades. The evidence for study techniques like spaced
          retrieval is strong in a lab and modest in a real classroom, so treating them as
          sensible defaults is honest and promising results is not. And it won&rsquo;t pretend
          you have more hours than you do.
        </p>
      </section>

      <p className="mt-10 text-sm text-[var(--faint)]">
        Read the <Link href="/privacy" className="underline underline-offset-4">privacy page</Link>{' '}
        to see exactly what is and isn&rsquo;t stored.
      </p>
    </main>
  );
}

/** A card in the feature grid. The 1px gaps come from the parent's background
 *  showing through, which gives clean hairlines without border-collapse games. */
function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--raised)]">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{children}</p>
    </div>
  );
}
