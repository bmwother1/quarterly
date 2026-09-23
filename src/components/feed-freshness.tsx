'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFeed, isNews, type RefreshResult } from '@/hooks/use-feed';
import { dueForRefresh, feedPrompt } from '@/lib/canvas/freshness';
import { fmtDay } from '@/lib/time';
import type { Assignment } from '@/lib/types';
import { keepCodes } from './course-name';

/**
 * Keeping remembered calendars current, and saying so when it matters.
 *
 * Checks every remembered link once a day when the week opens. Most days
 * nothing has changed and it says nothing, because a banner that appears every
 * morning to report no news trains people to ignore banners. When something did
 * change it names it: each new assignment with its due date and whether it got
 * time, each calendar that changed, and any study block a new shift now lands
 * on, since "3 new" with no names is a number the student then has to go and
 * investigate.
 *
 * It never rearranges what is already planned. New Canvas work goes into free
 * time or onto the "didn't fit" list; a clash with a new shift is reported with
 * a one-tap replan; the full rebuild stays behind the student's own button.
 *
 * Without a remembered Canvas link, or when the daily fetch keeps failing, it
 * falls back to asking. Those are the only banners here that ask for anything.
 *
 * It is a notice, so it is a well like the others on /week, and its buttons
 * are secondary: the next block's Done stays the one primary on the screen.
 */
export function FeedFreshness({ tz, onReplan }: { tz: string; onReplan: () => void }) {
  const { remembered, canvasRemembered, canvasSyncedAt, hasCourses, busy, refresh } = useFeed(tz);
  const [now] = useState(() => new Date());
  const [news, setNews] = useState<RefreshResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const due = dueForRefresh(remembered, now);

  useEffect(() => {
    if (!due) return;
    void refresh('daily').then((r) => {
      // Only news is worth a banner. A quiet day, or a failure the prompt below
      // will surface once it has lasted long enough to matter, says nothing.
      if (isNews(r)) setNews(r);
    });
  }, [due, refresh]);

  if (news) {
    const c = news.canvas;
    return (
      <div role="status" className="well enter">
        <h2 className="text-base font-semibold">{isNews(news) ? 'Your calendars changed' : 'Everything is up to date'}</h2>

        {c && c.summary !== 'Nothing new' && (
          <p className="mt-1 text-sm text-[var(--muted)]">Canvas: {c.summary}.</p>
        )}
        {c && c.placed.length > 0 && <WorkList label="Added to your week" items={c.placed} tz={tz} />}
        {c && c.short.length > 0 && (
          <WorkList label="Didn't fully fit, listed above the calendar" items={c.short} tz={tz} warn />
        )}

        {news.calendars.map((cal) => (
          <p key={cal.label} className="mt-1 text-sm text-[var(--muted)]">
            {cal.label}: {[
              cal.added > 0 && `${cal.added} new`,
              cal.removed > 0 && `${cal.removed} removed`,
            ].filter(Boolean).join(', ')}.
          </p>
        ))}

        {news.clashes > 0 ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--warn)]">
              {news.clashes} study block{news.clashes === 1 ? '' : 's'} now overlap{news.clashes === 1 ? 's' : ''} something
              new on your calendar. Nothing was moved without asking.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing already in your week was moved.</p>
        )}

        {news.failures.map((f) => (
          <p key={f.label} className="mt-2 text-sm text-[var(--warn)]">
            {f.label}: {f.error}
          </p>
        ))}

        <div className="mt-3 flex flex-wrap gap-2">
          {news.clashes > 0 && (
            <button onClick={() => { onReplan(); setNews(null); }} className="btn-secondary">
              Replan from now
            </button>
          )}
          <button onClick={() => setNews(null)} className="btn-quiet">
            Got it
          </button>
        </div>
      </div>
    );
  }

  const prompt = feedPrompt({ canvasSyncedAt, remembered: canvasRemembered, hasCourses, now });
  if (prompt.kind === 'none') return null;

  const age = `${prompt.days} days`;

  if (prompt.kind === 'repaste') {
    return (
      <div className="well enter">
        <h2 className="text-base font-semibold">Your Canvas deadlines are {age} old.</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Instructors often post work the same week it is due, so some of it may not be in
          this plan. Paste your Canvas link again, and let Heron remember it this time: it
          then checks Canvas every day by itself.
        </p>
        <Link href="/import" className="btn-secondary mt-3">
          Update from Canvas
        </Link>
      </div>
    );
  }

  return (
    <div className="well enter">
      <h2 className="text-base font-semibold">Couldn&rsquo;t check Canvas for {age}.</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Heron checks every day with your saved link, and it hasn&rsquo;t worked lately. Try
        again, and if it still fails, Canvas has probably reset your link.
      </p>
      {failed && (
        <p className="mt-2 text-sm text-[var(--warn)]">
          {failed}{' '}
          <Link href="/import" className="underline underline-offset-4">Go to import</Link>
        </p>
      )}
      <button
        disabled={busy}
        onClick={() => {
          setFailed(null);
          void refresh('tap').then((r) => {
            const canvasFail = r.failures.find((f) => f.label === 'Canvas');
            if (canvasFail) setFailed(canvasFail.hint ? `${canvasFail.error} ${canvasFail.hint}` : canvasFail.error);
            else setNews(r);
          });
        }}
        className="btn-secondary mt-3"
      >
        {busy ? 'Checking Canvas…' : 'Check Canvas now'}
      </button>
    </div>
  );
}

function WorkList({ label, items, tz, warn }: { label: string; items: Assignment[]; tz: string; warn?: boolean }) {
  return (
    <div className="mt-3">
      <p className={`text-sm font-medium ${warn ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}`}>{label}</p>
      <ul className="mt-1 space-y-1 text-sm">
        {items.slice(0, 5).map((a) => (
          <li key={a.id} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate">{a.title}</span>
            <span className="shrink-0 text-[var(--muted)]">{keepCodes(a.course)} · due {fmtDay(a.due, tz)}</span>
          </li>
        ))}
      </ul>
      {items.length > 5 && <p className="mt-1 text-sm text-[var(--muted)]">and {items.length - 5} more</p>}
    </div>
  );
}
