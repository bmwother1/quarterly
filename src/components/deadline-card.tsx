'use client';

import type { StudyBlock } from '@/lib/types';
import type { Deadline } from '@/lib/schedule/deadlines';
import { statusLabel } from '@/lib/schedule/deadlines';
import { fmtDay, fmtTime } from '@/lib/time';

/**
 * A deadline, with the time set aside for it underneath.
 *
 * The question a student taps a deadline to answer is "am I on track for this",
 * and that is only answerable with the sessions in view: how many, when, and
 * whether the last one leaves any slack before it is due. So the card lists
 * them, and each one is tappable, the same way a block leads back here.
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

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colour }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--muted)]">
            Due {fmtDay(deadline.dueAt, tz)}
            {!deadline.allDay && ` · ${fmtTime(deadline.dueAt, tz)}`}
          </p>
          <p className="mt-0.5 font-medium">{deadline.course} · {deadline.title}</p>
          <p
            className={`mt-1 text-sm ${
              deadline.status === 'unplanned' || deadline.status === 'short' ? 'text-[var(--warn)]' : 'text-[var(--muted)]'
            }`}
          >
            {statusLabel(deadline)}
            {finished.length > 0 && deadline.status !== 'done' && `, ${finished.length} done`}
            {slackHours !== null && deadline.status === 'planned' && (
              slackHours < 12
                ? `. The last one ends ${slackHours <= 0 ? 'right at' : `${slackHours}h before`} the deadline.`
                : `. The last one ends ${Math.round(slackHours / 24) || 1} day${Math.round(slackHours / 24) > 1 ? 's' : ''} ahead.`
            )}
          </p>

          {upcoming.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => onSelectBlock(b.id)}
                    className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-[var(--raised)]"
                  >
                    <span className="w-24 shrink-0 tabular-nums text-[var(--muted)]">{fmtDay(b.start, tz)}</span>
                    <span className="tabular-nums">{fmtTime(b.start, tz)}–{fmtTime(b.end, tz)}</span>
                    <span className="ml-auto text-xs text-[var(--faint)]">{b.minutes} min</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(deadline.status === 'unplanned' || deadline.status === 'short') && (
            <div className="mt-2.5">
              <p className="text-sm text-[var(--muted)]">
                {deadline.status === 'unplanned'
                  ? 'Nothing is planned for this yet. Replanning fits it in if there is room, and says so if there is not.'
                  : 'The week ran out of room for all of it. The shortfall is listed above the calendar.'}
              </p>
              <button
                onClick={onReplan}
                className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-ink)]"
              >
                Replan from now
              </button>
            </div>
          )}

          {deadline.url && (
            <a
              href={deadline.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-block text-sm text-[var(--accent)] underline underline-offset-4"
            >
              Open in Canvas
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
