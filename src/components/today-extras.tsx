'use client';

import type { Assignment, Commitment, StudyBlock } from '@/lib/types';
import { categoryForCommitment, colorVar } from '@/lib/categories';
import { dueInstant } from '@/lib/schedule/plan';
import { addDays, fmtDay, fmtTime, localParts } from '@/lib/time';
import { keepCodes } from './course-name';

/** The next three deadlines, each saying whether its time is booked. */
export function ComingUp({
  assignments, blocks, tz, now, colourFor,
}: {
  assignments: Assignment[];
  blocks: StudyBlock[];
  tz: string;
  now: Date;
  colourFor: (group: string) => string;
}) {
  const next = assignments
    .filter((a) => a.status === 'todo' && a.estimatedMinutes > 0 && dueInstant(a, tz).getTime() > now.getTime())
    .sort((a, b) => dueInstant(a, tz).getTime() - dueInstant(b, tz).getTime())
    .slice(0, 3);
  if (next.length === 0) return null;
  const today = localParts(now, tz).dateKey;
  const tomorrow = addDays(today, 1);

  return (
    <section aria-label="Coming up" className="grid gap-3 sm:grid-cols-3">
      {next.map((a, i) => {
        const due = dueInstant(a, tz);
        const key = localParts(due, tz).dateKey;
        const soon = key === today || key === tomorrow;
        const when = key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : fmtDay(due.toISOString(), tz).split(',')[0];
        const planned = blocks.find((b) => b.assignmentId === a.id && b.status === 'planned');
        return (
          <div
            key={a.id}
            className="today-rise flex flex-col gap-1.5 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
            style={{ animationDelay: `${120 + i * 70}ms` }}
          >
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="h-2 w-2 rounded-sm" style={{ background: colourFor(a.course) }} />
              {keepCodes(a.course)}
              <span className="ml-auto font-semibold" style={{ color: soon ? 'var(--accent)' : 'var(--muted)' }}>{when}</span>
            </div>
            <p className="text-[15px] font-semibold leading-snug">{keepCodes(a.title)}</p>
            <p className="text-xs text-[var(--muted)]">
              {planned ? `Planned ${fmtDay(planned.start, tz).split(',')[0]}, ${fmtTime(planned.start, tz)}` : 'Not planned yet'}
            </p>
          </div>
        );
      })}
    </section>
  );
}

/** Weekly goals as bars that fill, Monday to Sunday. */
export function WeeklyGoals({
  commitments, blocks, tz, now,
}: {
  commitments: Commitment[];
  blocks: StudyBlock[];
  tz: string;
  now: Date;
}) {
  const active = commitments.filter((c) => c.active);
  if (active.length === 0) return null;
  const p = localParts(now, tz);
  const monday = addDays(p.dateKey, -p.weekday);

  return (
    <section aria-label="This week" className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">This week</h2>
      {active.map((c) => {
        const done = blocks.filter((b) => b.commitmentId === c.id && (b.status === 'done' || b.status === 'partial')
          && localParts(new Date(b.start), tz).dateKey >= monday).length;
        const pct = Math.min(100, Math.round((done / Math.max(1, c.sessionsPerWeek)) * 100));
        const colour = colorVar(categoryForCommitment(c.category), c.shade);
        return (
          <div key={c.id} className="mb-3">
            <div className="mb-1.5 flex justify-between text-sm">
              <span>{c.title}</span>
              <span className="text-[var(--muted)]">{done} / {c.sessionsPerWeek}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div className="today-fill h-1.5 rounded-full" style={{ width: `${pct}%`, background: colour, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
