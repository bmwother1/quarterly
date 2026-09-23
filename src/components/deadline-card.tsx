'use client';

import type { StudyBlock } from '@/lib/types';
import type { Deadline } from '@/lib/schedule/deadlines';
import { statusLabel } from '@/lib/schedule/deadlines';
import { fmtDay, fmtTime } from '@/lib/time';
import { keepCodes } from './course-name';

/**
 * A deadline, with the time set aside for it underneath.
 *
 * The question a student taps a deadline to answer is "am I on track for this",
 * and that is only answerable with the sessions in view: how many, when, and
 * whether the last one leaves any slack before it is due. So the card lists
 * them, and each one is tappable, the same way a block leads back here.
 *
 * Laid out like a block on its own, with the dashed edge the calendar gives a
 * deadline, because a deadline is a moment and not time spent.
 */
export function DeadlineCard({
  deadline, sessions, tz, colour, onSelectBlock, onReplan,
}: {
  deadline: Deadline;
  sessions: StudyBlock[];
  tz: string;
  colour: string;
  onSelectBlock: (id: string) => void;
  onReplan: () => void;
}) {
  const upcoming = sessions.filter((b) => b.status === 'planned');
  const finished = sessions.filter((b) => b.status === 'done' || b.status === 'partial');
  const slackHours = deadline.lastSessionEnd
    ? Math.round((Date.parse(deadline.dueAt) - Date.parse(deadline.lastSessionEnd)) / 3_600_000)
    : null;
  const alarm = deadline.status === 'unplanned' || deadline.status === 'short';

  return (
    <div className="border-l-3 border-dashed pl-4" style={{ borderColor: colour }}>
      <p className="text-sm text-[var(--muted)]">
        Due {fmtDay(deadline.dueAt, tz)}
        {!deadline.allDay && ` · ${fmtTime(deadline.dueAt, tz)}`}
      </p>
      <h2 className="mt-1 text-title font-semibold">{keepCodes(deadline.course)} · {deadline.title}</h2>
      <p className={`mt-1 text-sm ${alarm ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}`}>
        {statusLabel(deadline)}
        {finished.length > 0 && deadline.status !== 'done' && `, ${finished.length} done`}
        {slackHours !== null && deadline.status === 'planned' && (
          slackHours < 12
            ? `. The last one ends ${slackHours <= 0 ? 'right at' : `${slackHours}h before`} the deadline.`
            : `. The last one ends ${Math.round(slackHours / 24) || 1} day${Math.round(slackHours / 24) > 1 ? 's' : ''} ahead.`
        )}
      </p>

      {upcoming.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {upcoming.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => onSelectBlock(b.id)}
                className="flex min-h-10 w-full items-baseline gap-3 py-2 text-left text-sm hover:text-[var(--accent)] active:transform-none"
              >
                <span className="w-24 shrink-0 text-[var(--muted)]">{fmtDay(b.start, tz)}</span>
                <span>{fmtTime(b.start, tz)} to {fmtTime(b.end, tz)}</span>
                <span className="ml-auto text-[var(--muted)]">{b.minutes} min</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {alarm && (
        <div className="mt-3">
          <p className="text-sm text-[var(--muted)]">
            {deadline.status === 'unplanned'
              ? 'Nothing is planned for this yet. Replanning fits it in if there is room, and says so if there is not.'
              : 'The week ran out of room for all of it. The shortfall is listed above the calendar.'}
          </p>
          <button onClick={onReplan} className="btn-secondary mt-3">
            Replan from now
          </button>
        </div>
      )}

      {deadline.url && (
        <a
          href={deadline.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]"
        >
          Open in Canvas
        </a>
      )}
    </div>
  );
}
