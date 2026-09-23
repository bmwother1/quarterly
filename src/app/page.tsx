import Link from 'next/link';
import { EntryRouter } from '@/components/entry-router';

export const metadata = {
  title: 'Heron',
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
    <EntryRouter>
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-12 sm:pt-20">
      <h1 className="enter text-display font-semibold">
        A plan that survives you{' '}
        <span className="text-[var(--accent)]">falling behind</span>.
      </h1>
      <p className="enter mt-4 text-title font-normal text-[var(--muted)]" style={{ '--i': 1 } as React.CSSProperties}>
        Every planner works until the week goes wrong. Heron is built for the Wednesday when
        it does: mark what you actually did, and it rebuilds the rest around what&rsquo;s left.
        Free for students.
      </p>

      <div className="enter mt-8 flex flex-col gap-3 sm:flex-row" style={{ '--i': 2 } as React.CSSProperties}>
        <Link href="/start" className="btn-primary btn-lg">
          Plan my week
        </Link>
        <Link href="/import" className="btn-secondary btn-lg">
          Import my calendar
        </Link>
      </div>

      <p className="enter mt-4 text-sm text-[var(--muted)]" style={{ '--i': 3 } as React.CSSProperties}>
        No account needed. Nothing to install. Takes about 30 seconds.{' '}
        <Link href="/welcome" className="whitespace-nowrap text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]">
          See how it works first
        </Link>
      </p>

      <section className="mt-16 grid gap-x-10 gap-y-8 border-t border-[var(--border)] pt-8 sm:grid-cols-2">
        <Item title="Fall behind and it rebuilds around you">
          Mark what you did, skipped or half-did, then replan from right now. Most planners make
          you redo the whole week by hand, which is the moment people quietly stop using them.
        </Item>

        <Item title="It plans the hours, not just the list">
          A to-do list tells you what&rsquo;s due. Heron works out when each piece actually
          happens, in sessions long enough to be worth sitting down for, around the time you
          already gave to class, work and sleep.
        </Item>

        <Item title="Every block says why it&rsquo;s there">
          &ldquo;Session 2 of 4, due Thursday.&rdquo; &ldquo;You haven&rsquo;t touched CHEM in six
          days.&rdquo; If you can&rsquo;t see the reason for a block, you won&rsquo;t do it, so
          the reason is always on the block.
        </Item>

        <Item title="It tells you when the week doesn&rsquo;t fit">
          Most planners quietly overbook you and let Thursday find out. Heron shows you what
          it couldn&rsquo;t fit and why, while you can still do something about it.
        </Item>
      </section>

      <section className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 className="text-base font-semibold">If it&rsquo;s summer, start with your week</h2>
        <p className="mt-2 text-base text-[var(--muted)]">
          Canvas feeds only carry 30 days back and a year forward, and instructors publish
          assignments when they publish the course, often in the last week before term. So
          between quarters your feed is genuinely empty, and that&rsquo;s expected rather than
          broken.
        </p>
        <p className="mt-2 text-base text-[var(--muted)]">
          Your shifts, your sleep, your training and whatever you&rsquo;re building don&rsquo;t
          wait for a quarter to start. Set those up now and your coursework drops into a week
          that&rsquo;s already shaped around you.
        </p>
      </section>

      <section className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 className="text-base font-semibold">What it won&rsquo;t claim</h2>
        <p className="mt-2 text-base text-[var(--muted)]">
          It won&rsquo;t promise better grades. The evidence for study techniques like spaced
          retrieval is strong in a lab and modest in a real classroom, so treating them as
          sensible defaults is honest and promising results is not. And it won&rsquo;t pretend
          you have more hours than you do.
        </p>
      </section>

      <p className="mt-12 text-sm text-[var(--muted)]">
        Read the{' '}
        <Link href="/privacy" className="text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]">
          privacy page
        </Link>{' '}
        to see exactly what is and isn&rsquo;t stored.
      </p>
    </main>
    </EntryRouter>
  );
}

/** One point in the feature list. No card: the rule above the section and the
 *  space between items do the separating. */
function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-base text-[var(--muted)]">{children}</p>
    </div>
  );
}
