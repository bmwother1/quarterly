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

/** Monday to Sunday of the week `now` is in, as date keys. */
function weekBounds(now: Date, tz: string): { monday: string; nextMonday: string } {
  const p = localParts(now, tz);
  const monday = addDays(p.dateKey, -p.weekday);
  return { monday, nextMonday: addDays(monday, 7) };
}

function Bar({ label, value, of, colour, delay = 0 }: { label: string; value: number; of: number; colour: string; delay?: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, of)) * 100));
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-[var(--muted)]">{value} / {of}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="today-fill h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: colour, animationDelay: `${delay}ms`, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </div>
    </div>
  );
}

/**
 * This week at a glance: assignments due Monday to Sunday, done of total,
 * then each course, then the weekly goals. Brydon asked for assignments here
 * beside the goals, so the week reads as one scoreboard.
 */
export function WeekProgress({
  assignments, commitments, blocks, tz, now, colourFor,
}: {
  assignments: Assignment[];
  commitments: Commitment[];
  blocks: StudyBlock[];
  tz: string;
  now: Date;
  colourFor: (group: string) => string;
}) {
  const { monday, nextMonday } = weekBounds(now, tz);
  const due = assignments.filter((a) => {
    if (a.status === 'dropped' || a.estimatedMinutes <= 0) return false;
    const key = localParts(dueInstant(a, tz), tz).dateKey;
    return key >= monday && key < nextMonday;
  });
  const courses = [...new Set(due.map((a) => a.course))].sort();
  const goals = commitments.filter((c) => c.active);
  if (due.length === 0 && goals.length === 0) return null;

  return (
    <section aria-label="This week" className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">This week</h2>
      {due.length > 0 && (
        <>
          <Bar label="Assignments due" value={due.filter((a) => a.status === 'done').length} of={due.length} colour="var(--accent)" />
          <div className="mb-4 pl-3">
            {courses.map((c, i) => {
              const mine = due.filter((a) => a.course === c);
              return <Bar key={c} label={keepCodes(c)} value={mine.filter((a) => a.status === 'done').length} of={mine.length} colour={colourFor(c)} delay={80 * (i + 1)} />;
            })}
          </div>
        </>
      )}
      {goals.map((c, i) => {
        const done = blocks.filter((b) => b.commitmentId === c.id && (b.status === 'done' || b.status === 'partial')
          && localParts(new Date(b.start), tz).dateKey >= monday).length;
        return (
          <Bar
            key={c.id}
            label={c.title}
            value={done}
            of={c.sessionsPerWeek}
            colour={colorVar(categoryForCommitment(c.category), c.shade)}
            delay={80 * (courses.length + i + 1)}
          />
        );
      })}
    </section>
  );
}

/** Courses with what is still due this week, Notion-sidebar style. */
export function CourseList({
  assignments, tz, now, colourFor,
}: {
  assignments: Assignment[];
  tz: string;
  now: Date;
  colourFor: (group: string) => string;
}) {
  const { monday, nextMonday } = weekBounds(now, tz);
  const courses = [...new Set(assignments.map((a) => a.course))].sort();
  if (courses.length === 0) return null;
  return (
    <section aria-label="Courses">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Courses</h2>
      <ul>
        {courses.map((c) => {
          const left = assignments.filter((a) => a.course === c && a.status === 'todo' && a.estimatedMinutes > 0 && (() => {
            const key = localParts(dueInstant(a, tz), tz).dateKey;
            return key >= monday && key < nextMonday;
          })()).length;
          return (
            <li key={c} className="flex items-center gap-2.5 py-1.5 text-sm">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colourFor(c) }} />
              {keepCodes(c)}
              <span className="ml-auto text-xs text-[var(--muted)]">{left ? `${left} due` : ''}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** When Canvas was last read, and a way to read it now. */
export function CanvasStatus({
  syncedAt, now, busy, onCheck,
}: {
  syncedAt: string | null;
  now: Date;
  busy: boolean;
  onCheck: (() => void) | null;
}) {
  if (!syncedAt) return null;
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(syncedAt)) / 60_000));
  const ago = mins < 2 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)} days ago`;
  return (
    <div className="mt-6 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm">
      <p>Canvas checked {ago}.</p>
      {onCheck && (
        <button onClick={onCheck} disabled={busy} className="mt-1 text-[var(--accent)] underline underline-offset-4 disabled:opacity-60">
          {busy ? 'Checking…' : 'Check now'}
        </button>
      )}
    </div>
  );
}
