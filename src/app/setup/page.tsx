'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuarterly } from '@/hooks/use-quarterly';
import { DEFAULT_TZ } from '@/lib/time';
import type { BusyBlock, Commitment, CommitmentCategory, EnergyPattern } from '@/lib/types';
import { CATEGORY_DEMAND } from '@/lib/schedule/score';
import { UndoBar } from '@/components/undo-bar';
import Link from 'next/link';

const TZ = DEFAULT_TZ;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const COMMITMENT_COLORS = ['#10b981', '#8b5cf6', '#e11d48', '#0ea5e9', '#f59e0b', '#ec4899'];

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export default function SetupPage() {
  const {
    state, hydrated, updateAvailability, updateCommitments, replan,
    removeCommitment, undo, undoLabel, dismissUndo,
  } = useQuarterly(TZ);
  const router = useRouter();
  const [saved, setSaved] = useState<string | null>(null);
  const av = state.availability;

  /** Brief confirmation. A silent save is indistinguishable from a broken one. */
  function flash(what: string) {
    setSaved(what);
    setTimeout(() => setSaved((cur) => (cur === what ? null : cur)), 2200);
  }

  if (!hydrated) {
    return <main className="mx-auto max-w-2xl px-5 py-12"><p className="text-[var(--muted)]">Loading…</p></main>;
  }

  const sleepStart = av.busy.find((b) => b.kind === 'sleep')?.endMin ?? 7 * 60;
  const bedMin = av.busy.find((b) => b.kind === 'sleep')?.startMin ?? 0;
  const commitBlock = av.busy.find((b) => b.kind === 'work' || b.kind === 'class');

  // Every one of these reads `prev`, never the render-time `av`.
  function setSleep(wakeMin: number, bedMin: number) {
    updateAvailability((prev) => {
      const busy = prev.busy.filter((b) => b.kind !== 'sleep');
      for (let day = 0; day < 7; day++) {
        busy.push({ id: `sleep-${day}`, day, startMin: bedMin, endMin: wakeMin, label: 'Sleep', kind: 'sleep' });
      }
      return {
        ...prev,
        busy,
        dayStartMin: wakeMin,
        dayEndMin: bedMin > wakeMin ? bedMin : 24 * 60 - 15,
      };
    });
  }

  function setWorkShift(days: number[], startMin: number, endMin: number, label: string) {
    updateAvailability((prev) => {
      const busy = prev.busy.filter((b) => b.kind !== 'work');
      for (const day of days) {
        busy.push({ id: `work-${day}`, day, startMin, endMin, label, kind: 'work' });
      }
      return { ...prev, busy };
    });
    flash(`${label || 'Work'} saved`);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your week</h1>

      </header>

      <p className="mb-8 text-sm text-[var(--muted)]">
        Set once. None of it needs Canvas.
      </p>

      <Section
        title="Your other calendars"
        hint="Canvas, Google, Apple or Outlook. Import once and the scheduler plans around it."
      >
        {state.courses.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{state.courses.length} courses</span>{' '}
              <span className="text-[var(--muted)]">
                · {state.assignments.filter((a) => a.status === 'todo').length} assignments still ahead
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {state.courses.map((c) => (
                <span
                  key={c.code}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm"
                >
                  {c.code}
                </span>
              ))}
            </div>
            <Link
              href="/import"
              className="inline-block rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-sm"
            >
              Import another calendar
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted)]">
              Not connected. Between quarters your feed is usually empty, so this is worth doing
              once your courses go live.
            </p>
            <Link
              href="/import"
              className="inline-block rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)]"
            >
              Import a calendar
            </Link>
          </div>
        )}
      </Section>

      <Section title="Sleep" hint="">
        <div className="flex flex-wrap gap-4">
          <Field label="Wake">
            <input
              type="time"
              value={toHHMM(sleepStart)}
              onChange={(e) => setSleep(toMin(e.target.value), bedMin)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Sleep">
            <input
              type="time"
              value={toHHMM(bedMin)}
              onChange={(e) => setSleep(sleepStart, toMin(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
          </Field>
        </div>
      </Section>

      <WorkSection
        current={commitBlock}
        days={av.busy.filter((b) => b.kind === 'work').map((b) => b.day)}
        onSave={setWorkShift}
      />

      <Section title="When you focus best" hint="">
        <div className="flex flex-wrap gap-2">
          {(['morning', 'evening', 'steady', 'bimodal'] as EnergyPattern[]).map((p) => (
            <button
              key={p}
              onClick={() => updateAvailability((prev) => ({ ...prev, energy: p }))}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                av.energy === p
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)]'
              }`}
            >
              {p === 'bimodal' ? 'early and late' : p}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="How much you'll actually do"
        hint="Hours per day. Be realistic — five after a full shift is a plan you abandon."
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DAYS.map((label, day) => {
            const value = av.maxDailyMinutesByDay?.[day] ?? av.maxDailyMinutes;
            return (
              <label key={label} className="text-center text-xs text-[var(--muted)]">
                {label}
                <input
                  type="number"
                  min={0}
                  max={16}
                  step={0.5}
                  value={value / 60}
                  onChange={(e) => {
                    const hours = Number(e.target.value);
                    updateAvailability((prev) => {
                      const next = [...(prev.maxDailyMinutesByDay ?? Array(7).fill(null))];
                      next[day] = Number.isFinite(hours) ? Math.round(hours * 60) : null;
                      return { ...prev, maxDailyMinutesByDay: next };
                    });
                  }}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-1.5 text-center text-sm text-[var(--ink)]"
                />
              </label>
            );
          })}
        </div>
      </Section>

      <CommitmentsSection
        commitments={state.commitments}
        onChange={updateCommitments}
        onRemove={removeCommitment}
      />

      <UndoBar label={undoLabel} onUndo={undo} onDismiss={dismissUndo} />

      

      

      

      {saved && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-10 mx-auto w-fit rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)] shadow-lg"
        >
          {saved}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
        <button
          onClick={() => { replan(new Date()); router.push('/week'); }}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Plan my week
        </button>
        <span className="text-sm text-[var(--muted)]">takes you to the result</span>
      </div>

   </main>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-sm text-[var(--muted)]">{hint}</p>}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm text-[var(--muted)]">
      <span className="mr-2">{label}</span>
      {children}
    </label>
  );
}

function WorkSection({
  current, days, onSave,
}: {
  current?: BusyBlock;
  days: number[];
  onSave: (days: number[], startMin: number, endMin: number, label: string) => void;
}) {
  const [label, setLabel] = useState(current?.label ?? '');
  const [start, setStart] = useState(toHHMM(current?.startMin ?? 9 * 60));
  const [end, setEnd] = useState(toHHMM(current?.endMin ?? 17 * 60));
  const [selected, setSelected] = useState<number[]>(days.length ? days : [0, 1, 2, 3, 4]);

  return (
    <Section title="Work, class or anything fixed" hint="Include your commute.">
      {current && days.length > 0 && (
        <p className="mb-3 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
          <span className="font-medium">{current.label}</span>
          <span className="text-[var(--muted)]">
            {' · '}{toHHMM(current.startMin)}–{toHHMM(current.endMin)}
            {' · '}{[...new Set(days)].sort().map((d) => DAYS[d]).join(' ')}
          </span>
        </p>
      )}
      <div className="space-y-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="What this commitment is called"
          placeholder="Masons Supply Co"
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-4">
          <Field label="From">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
          </Field>
          <Field label="To">
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
              className={`rounded px-2.5 py-1 text-sm ${
                selected.includes(i)
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSave(selected, toMin(start), toMin(end), label || 'Work')}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          Save these hours
        </button>
      </div>
    </Section>
  );
}

function CommitmentsSection({
  commitments, onChange, onRemove,
}: {
  commitments: Commitment[];
  onChange: (fn: (prev: Commitment[]) => Commitment[]) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommitmentCategory>('fitness');
  const [perWeek, setPerWeek] = useState('3');
  const [minutes, setMinutes] = useState('45');

  function add() {
    if (!title.trim()) return;
    const sessions = Math.max(1, Number(perWeek) || 1);
    const each = Math.max(15, Number(minutes) || 45);

    onChange((prev) => [...prev, {
      id: `c-${Date.now()}`,
      title: title.trim(),
      category,
      sessionsPerWeek: sessions,
      minutesPerSession: each,
      importance: 0.6,
      demand: CATEGORY_DEMAND[category],
      lastDoneAt: null,
      doneThisWeek: 0,
      maxPerDay: 1,
      // Fitness carries a shower afterwards and shouldn't run up against bedtime.
      minSessionMinutes: category === 'project' ? 60 : Math.min(30, each),
      bufferAfterMinutes: category === 'fitness' ? 10 : 0,
      windowStartMin: category === 'fitness' ? 6 * 60 : null,
      windowEndMin: category === 'fitness' ? 21 * 60 : null,
      active: true,
      color: COMMITMENT_COLORS[prev.length % COMMITMENT_COLORS.length],
    }]);

    setTitle('');
  }

  return (
    <Section
      title="Things you do every week"
      hint="Runs, project hours, a course. A weekly target, no deadline."
    >
      {commitments.length > 0 && (
        <ul className="mb-4 space-y-2">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="shrink-0 text-[var(--muted)]">
                {c.sessionsPerWeek}× {c.minutesPerSession}m
              </span>
              <button
                onClick={() => onRemove(c.id)}
                className="shrink-0 text-[var(--faint)] underline underline-offset-4"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="What you do every week"
          placeholder="Run 3 miles"
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm"
        />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="times a week">
            <input type="number" min={1} max={14} value={perWeek} onChange={(e) => setPerWeek(e.target.value)}
              className="w-16 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
          </Field>
          <Field label="minutes each">
            <input type="number" min={15} max={240} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)}
              className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['fitness', 'project', 'learning', 'personal'] as CommitmentCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-sm ${
                category === c
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={add} disabled={!title.trim()}
          className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Add
        </button>
      </div>
    </Section>
  );
}
