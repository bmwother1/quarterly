import type { Deadline } from '@/lib/schedule/deadlines';
import { statusLabel } from '@/lib/schedule/deadlines';
import { fmtTime } from '@/lib/time';
import { keepCodes } from './course-name';

/**
 * A deadline in a timeline, on the same time column as the blocks around it.
 *
 * A deadline is a moment, not time spent, so it has no duration and gets the
 * dashed edge the calendar gives it. Its status is the useful part: a
 * deadline with no time planned for it is the one line on the day that needs
 * doing something about, so that status is in the warn colour.
 */
export function DeadlineRow({ deadline: d, colour, tz }: { deadline: Deadline; colour: string; tz: string }) {
  const alarm = d.status === 'unplanned' || d.status === 'short';
  const done = d.status === 'done';

  return (
    <li className="grid grid-cols-[4rem_1fr] gap-x-3 py-3">
      <div className="text-sm font-medium leading-6">{d.allDay ? 'End of day' : fmtTime(d.dueAt, tz)}</div>
      <div
        className="min-w-0 border-l-3 border-dashed pl-3"
        style={{ borderColor: done ? `color-mix(in oklab, ${colour} 40%, transparent)` : colour }}
      >
        <p className={`text-base font-medium ${done ? 'text-[var(--muted)] line-through decoration-[var(--border-strong)]' : ''}`}>
          {keepCodes(d.course)} · {d.title}
        </p>
        <p className="text-sm text-[var(--muted)]">
          Due · <span className={alarm ? 'text-[var(--warn)]' : ''}>{statusLabel(d)}</span>
        </p>
      </div>
    </li>
  );
}
