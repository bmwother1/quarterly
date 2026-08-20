'use client';

import { useState } from 'react';
import type { FixedEvent, WorkKind } from '@/lib/types';
import { fmtDay, fmtTime, DEFAULT_TZ } from '@/lib/time';

const EVENT_COLORS = ['#0891b2', '#e11d48', '#8b5cf6', '#f59e0b', '#10b981'];

const KINDS: WorkKind[] = ['problem set', 'writing', 'reading', 'project', 'exam', 'lab', 'other'];

/** YYYY-MM-DD and HH:MM in local time → an ISO instant. */
function toISO(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 9, mm ?? 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/**
 * Adding a single thing.
 *
 * Two modes, because the two are genuinely different and conflating them is
 * what makes most planners annoying. An appointment has a time already decided
 * and the scheduler's only job is to avoid it. A task has a deadline and no
 * time yet, and deciding when it happens is the entire product. Asking which
 * one you mean costs a single tap and removes all the ambiguity downstream.
 */
export function AddItem({
  events, onAddEvent, onRemoveEvent, onAddTask, tz = DEFAULT_TZ,
}: {
  events: FixedEvent[];
  onAddEvent: (e: Omit<FixedEvent, 'id'>) => void;
  onRemoveEvent: (id: string) => void;
  onAddTask: (t: { title: string; course: string; kind: WorkKind; due: string; estimatedMinutes: number }) => void;
  tz?: string;
}) {
  const [mode, setMode] = useState<'event' | 'task'>('event');
  // Fixed at mount. Reading the clock during render is impure and can differ
  // between the server and client passes.
  const [mountedAt] = useState(() => Date.now());
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => todayKey());
  const [time, setTime] = useState('09:00');
  const [durationMin, setDurationMin] = useState('60');
  const [course, setCourse] = useState('');
  const [kind, setKind] = useState<WorkKind>('problem set');

  const upcoming = events
    .filter((e) => new Date(e.end).getTime() >= mountedAt - 86_400_000)
    .slice(0, 6);

  function submit() {
    if (!title.trim()) return;
    const minutes = Math.max(15, Number(durationMin) || 60);

    if (mode === 'event') {
      const startISO = toISO(date, time);
      if (!startISO) return;
      onAddEvent({
        title: title.trim(),
        start: startISO,
        end: new Date(new Date(startISO).getTime() + minutes * 60_000).toISOString(),
        note: null,
        color: EVENT_COLORS[events.length % EVENT_COLORS.length],
      });
    } else {
      // A deadline with no time given means the end of that day, not midnight
      // starting it — the same rule Canvas all-day items get.
      const dueISO = toISO(date, time || '23:59');
      if (!dueISO) return;
      onAddTask({ title: title.trim(), course: course.trim(), kind, due: dueISO, estimatedMinutes: minutes });
    }

    setTitle('');
    setCourse('');
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-sm">
        {(['event', 'task'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              mode === m ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {m === 'event' ? 'At a set time' : 'Needs doing by'}
          </button>
        ))}
      </div>

      <p className="text-sm text-[var(--muted)]">
        {mode === 'event'
          ? 'An appointment, a shift, a gig. The time is already decided, so the scheduler just works around it.'
          : 'Something with a deadline but no time yet. The scheduler decides when it happens and splits it up.'}
      </p>

      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mode === 'event' ? 'Dentist' : 'FE exam registration'}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />

        {mode === 'task' && (
          <div className="flex flex-wrap gap-3">
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="Course or label (optional)"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as WorkKind)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2 text-sm"
            >
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-[var(--muted)]">
            <span className="mr-2">{mode === 'event' ? 'On' : 'Due'}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--ink)]"
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            <span className="mr-2">At</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--ink)]"
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            <span className="mr-2">{mode === 'event' ? 'For' : 'Takes about'}</span>
            <input
              type="number"
              min={15}
              max={600}
              step={15}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--ink)]"
            />
            <span className="ml-1 text-[var(--faint)]">min</span>
          </label>
        </div>

        <button
          onClick={submit}
          disabled={!title.trim()}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)] disabled:bg-transparent disabled:text-[var(--faint)] disabled:ring-1 disabled:ring-[var(--border)]"
        >
          Add {mode === 'event' ? 'event' : 'task'}
        </button>

        {mode === 'task' && (
          <p className="text-xs text-[var(--faint)]">
            Press Replan afterwards and it gets a slot.
          </p>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Coming up</h3>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className="shrink-0 text-[var(--muted)]">
                  {fmtDay(e.start, tz)} · {fmtTime(e.start, tz)}
                </span>
                <button
                  onClick={() => onRemoveEvent(e.id)}
                  className="shrink-0 text-[var(--faint)] underline underline-offset-4 hover:text-[var(--warn)]"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
