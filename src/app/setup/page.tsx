'use client';
import { categoryForCommitment, colorVar, nextShade, takenShades } from '@/lib/categories';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHeron } from '@/hooks/use-heron';
import { DEFAULT_TZ } from '@/lib/time';
import type { BusyBlock, Commitment, CommitmentCategory, EnergyPattern } from '@/lib/types';
import { CATEGORY_DEMAND } from '@/lib/schedule/score';
import { UndoBar } from '@/components/undo-bar';
import { Toast } from '@/components/toast';
import Link from 'next/link';

const TZ = DEFAULT_TZ;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export default function SetupPage() {
  const {
    state, hydrated, updateAvailability, updateCommitments, replan, setSleepHours,
    removeCommitment, undo, undoLabel, dismissUndo,
  } = useHeron(TZ);
  const router = useRouter();
  const [saved, setSaved] = useState<string | null>(null);
  const av = state.availability;

  /** Brief confirmation. A silent save is indistinguishable from a broken one. */
  function flash(what: string) {
    setSaved(what);
    setTimeout(() => setSaved((cur) => (cur === what ? null : cur)), 2200);
  }

  if (!hydrated) {
    return <main className="mx-auto min-h-[60vh] max-w-2xl px-5 pt-8 sm:pt-12" aria-busy="true" />;
  }

  const sleepStart = av.busy.find((b) => b.kind === 'sleep')?.endMin ?? 7 * 60;
  const bedMin = av.busy.find((b) => b.kind === 'sleep')?.startMin ?? 0;
  const commitBlock = av.busy.find((b) => b.kind === 'work' || b.kind === 'class');

  // Every one of these reads `prev`, never the render-time `av`.
  // Sleep goes through the hook so the hours and `sleepConfirmed` cannot come
  // apart: writing one without the other left the /week prompt asking forever.
  const setSleep = setSleepHours;

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
    <main className="rise mx-auto max-w-2xl px-5 pb-12 pt-8 sm:pt-12">
      <header>
        <h1 className="text-heading font-semibold">Your week</h1>
        <p className="mt-2 text-base text-[var(--muted)]">
          Set once. None of it needs Canvas.
        </p>
      </header>

      <Section
        title="Your other calendars"
        hint="Canvas, your work schedule, Google, Apple, Outlook or any calendar link. Import once and Heron keeps it current."
      >
        {state.courses.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{state.courses.length} courses</span>
              <span className="text-[var(--muted)]">
                {' · '}{state.assignments.filter((a) => a.status === 'todo').length} assignments still ahead
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {state.courses.map((c) => (
                <span
                  key={c.code}
                  className="whitespace-nowrap rounded-full border border-[var(--border)] px-3 py-1 text-sm"
                >
                  {c.code}
                </span>
              ))}
            </div>
            <Link href="/import" className="btn-secondary">
              Import another calendar
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Not connected. Between quarters your feed is usually empty, so this is worth doing
              once your courses go live.
            </p>
            {/* Secondary: this page's one primary is Plan my week, at the end. */}
            <Link href="/import" className="btn-secondary">
              Import a calendar
            </Link>
          </div>
        )}
      </Section>

      <Section title="Sleep">
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <Field label="Wake">
            <input
              type="time"
              value={toHHMM(sleepStart)}
              onChange={(e) => setSleep(toMin(e.target.value), bedMin)}
              className="field w-full"
            />
          </Field>
          <Field label="Sleep">
            <input
              type="time"
              value={toHHMM(bedMin)}
              onChange={(e) => setSleep(sleepStart, toMin(e.target.value))}
              className="field w-full"
            />
          </Field>
        </div>
      </Section>

      <WorkSection
        current={commitBlock}
        days={av.busy.filter((b) => b.kind === 'work').map((b) => b.day)}
        onSave={setWorkShift}
      />

      <Section title="When you focus best">
        <div className="flex flex-wrap gap-2">
          {(['morning', 'evening', 'steady', 'bimodal'] as EnergyPattern[]).map((p) => (
            <button
              key={p}
              // Picking one here is a considered answer, so it locks: from
              // now on, observation reports but does not overrule.
              onClick={() => updateAvailability((prev) => ({ ...prev, energy: p, energyLocked: true }))}
              aria-pressed={av.energy === p}
              className="chip"
            >
              {p === 'bimodal' ? 'Early and late' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="How much you'll actually do"
        hint="Hours per day. Be realistic: five after a full shift is a plan you abandon."
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DAYS.map((label, day) => {
            const value = av.maxDailyMinutesByDay?.[day] ?? av.maxDailyMinutes;
            return (
              <label key={label} className="flex flex-col gap-1 text-center text-sm text-[var(--muted)]">
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
                  className="field w-full px-1 text-center"
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
      <Toast message={saved} />

      <div className="mt-10 border-t border-[var(--border)] pt-6">
        <button
          onClick={() => { replan(new Date()); router.push('/week'); }}
          className="btn-primary btn-lg w-full sm:w-auto"
        >
          Plan my week
        </button>
      </div>
    </main>
  );
}

/** A setting, set apart from the one above it by a rule and space, not a box. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A label above its field, so the two stay together however the row wraps. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-[var(--muted)]">
      {label}
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
        <p className="mb-4 text-sm">
          <span className="font-medium">{current.label}</span>
          <span className="text-[var(--muted)]">
            {' · '}{toHHMM(current.startMin)} to {toHHMM(current.endMin)}
            {' · '}{[...new Set(days)].sort().map((d) => DAYS[d]).join(' ')}
          </span>
        </p>
      )}
      <div className="space-y-4">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="What this commitment is called"
          placeholder="Masons Supply Co"
          className="field w-full"
        />
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <Field label="From">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="field w-full" />
          </Field>
          <Field label="To">
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="field w-full" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
              aria-pressed={selected.includes(i)}
              className="chip"
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={() => onSave(selected, toMin(start), toMin(end), label || 'Work')}
          className="btn-secondary"
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
      shade: nextShade(
        categoryForCommitment(category),
        takenShades(
          prev.map((c) => ({ category: categoryForCommitment(c.category), shade: c.shade })),
          categoryForCommitment(category),
        ),
      ),
    }]);

    setTitle('');
  }

  return (
    <Section
      title="Things you do every week"
      hint="Runs, project hours, a course. A weekly target, no deadline."
    >
      {commitments.length > 0 && (
        <ul className="mb-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorVar(categoryForCommitment(c.category), c.shade) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base">{c.title}</span>
              <span className="shrink-0 text-[var(--muted)]">
                {c.sessionsPerWeek}× {c.minutesPerSession} min
              </span>
              <button onClick={() => onRemove(c.id)} className="btn-quiet shrink-0 px-2">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4 rounded-md border border-[var(--border)] p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="What you do every week"
          placeholder="Run 3 miles"
          className="field w-full"
        />
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <Field label="Times a week">
            <input type="number" min={1} max={14} value={perWeek} onChange={(e) => setPerWeek(e.target.value)}
              className="field w-full" />
          </Field>
          <Field label="Minutes each">
            <input type="number" min={15} max={240} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)}
              className="field w-full" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
          {(['fitness', 'project', 'learning', 'personal'] as CommitmentCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className="chip"
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={add} disabled={!title.trim()} className="btn-secondary">
          Add
        </button>
      </div>
    </Section>
  );
}
