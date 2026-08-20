'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { BlockCard } from '@/components/block-card';
import { WeekGrid } from '@/components/week-grid';
import { DEFAULT_TZ, addDays, fmtDay, localParts } from '@/lib/time';
import { missedBlocks } from '@/lib/schedule/complete';
import type { StudyBlock } from '@/lib/types';

const TZ = DEFAULT_TZ;

export default function WeekPage() {
  const { state, hydrated, replan, complete, drop, moveBlock } = useQuarterly(TZ);
  // Fixed at mount so every render agrees on "now" — reading the clock during
  // render is impure and drifts between the server and client passes.
  const [now] = useState(() => new Date());
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const colourFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of state.courses) map.set(c.code, c.color);
    for (const c of state.commitments) map.set(c.title, c.color);
    return (group: string) => map.get(group) ?? 'var(--accent)';
  }, [state.courses, state.commitments]);

  // Fourteen days, matching the planner's horizon. Showing seven while planning
  // fourteen is what made next week look empty.
  const days = useMemo(() => {
    const start = localParts(now, TZ).dateKey;
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, [now]);

  const byDay = useMemo(() => {
    const map = new Map<string, StudyBlock[]>();
    for (const b of state.blocks) {
      const key = localParts(new Date(b.start), TZ).dateKey;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [state.blocks]);

  const missed = useMemo(() => missedBlocks(state.blocks, now), [state.blocks, now]);
  const selected = useMemo(
    () => state.blocks.find((b) => b.id === selectedId) ?? null,
    [state.blocks, selectedId],
  );

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p className="text-[var(--muted)]">Loading your week…</p>
      </main>
    );
  }

  const hasInputs = state.assignments.length > 0 || state.commitments.length > 0;
  const planned = state.blocks.filter((b) => b.status === 'planned');

  return (
    <main
      className="mx-auto w-full px-5 py-10 sm:py-14"
      // Set directly rather than through a utility class: the calendar needs
      // roughly twice the width of the prose views, and a conditional class name
      // here was not surviving the CSS build.
      style={{ maxWidth: view === 'grid' ? 1080 : 672 }}
    >
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">This week</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {planned.length} blocks · {(planned.reduce((s, b) => s + b.minutes, 0) / 60).toFixed(1)}h planned
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/setup" className="text-[var(--muted)] underline underline-offset-4">Set up</Link>
          <Link href="/" className="text-[var(--muted)] underline underline-offset-4">Canvas</Link>
        </nav>
      </header>

      {!hasInputs && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">Nothing to plan yet</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Connect Canvas for coursework, or add what you do every week — runs, project time, a
            course you&rsquo;re working through. Either is enough to get a week.
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/setup" className="rounded bg-[var(--accent)] px-3 py-1.5 font-medium text-white">
              Set up my week
            </Link>
            <Link href="/" className="rounded border border-[var(--border)] px-3 py-1.5">
              Connect Canvas
            </Link>
          </div>
        </div>
      )}

      {hasInputs && (
        <>
          {missed.length > 0 && (
            <div className="mb-6 rounded-lg border border-[var(--warn)]/40 bg-[var(--accent-soft)] p-4">
              <h2 className="font-medium text-[var(--warn)]">
                {missed.length} block{missed.length === 1 ? '' : 's'} passed without an answer
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Mark them below, then rebuild the rest of the week around what&rsquo;s actually left.
                Nothing moves until you say so.
              </p>
            </div>
          )}

          <div className="mb-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => replan(new Date())}
              className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-ink)] shadow-[var(--shadow-sm)] transition-transform active:scale-[0.98]"
            >
              {state.lastPlannedAt ? 'Replan from now' : 'Plan my week'}
            </button>
            {state.lastPlannedAt && (
              <span className="text-xs text-[var(--faint)]">
                last planned {fmtDay(state.lastPlannedAt, TZ)}
              </span>
            )}
          </div>

          {state.unscheduled.length > 0 && (
            <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-medium">Didn&rsquo;t fit</h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Your week is smaller than your list. Better to know now than on Thursday.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {state.unscheduled.map((u) => (
                  <li key={u.assignmentId ?? u.commitmentId ?? u.title} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{u.course}</span>
                    {u.title !== u.course && <span className="text-[var(--muted)]">{u.title}</span>}
                    <span className="text-[var(--faint)]">
                      {u.sessionsShort
                        ? `${u.sessionsShort} session${u.sessionsShort === 1 ? '' : 's'} short`
                        : `${u.minutes} min`}
                      {' · '}{u.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-6 flex gap-1 text-sm">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  view === v
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {v === 'grid' ? 'Calendar' : 'List'}
              </button>
            ))}
          </div>

          {view === 'grid' && (
            <div className="mb-8 space-y-4">
              <WeekGrid
                days={days}
                blocks={state.blocks}
                availability={state.availability}
                tz={TZ}
                colourFor={colourFor}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
                onMove={moveBlock}
                todayKey={localParts(now, TZ).dateKey}
              />

              {selected ? (
                <BlockCard
                  block={selected}
                  tz={TZ}
                  colour={colourFor(selected.course)}
                  isPast={new Date(selected.end) < now}
                  onComplete={(outcome, minutes) => complete(selected.id, outcome, minutes)}
                  onDrop={() => { drop(selected.id); setSelectedId(null); }}
                />
              ) : (
                <p className="text-sm text-[var(--faint)]">
                  Tap a block to see why it&rsquo;s there and mark it off. Shaded bands are the
                  hours you already gave away.
                </p>
              )}
            </div>
          )}

          {view === 'list' && (
          <div className="space-y-8">
            {days.slice(0, 7).map((dateKey) => {
              const blocks = byDay.get(dateKey) ?? [];
              const total = blocks.filter((b) => b.status === 'planned').reduce((s, b) => s + b.minutes, 0);
              const isToday = dateKey === localParts(now, TZ).dateKey;

              return (
                <section key={dateKey}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="font-medium">
                      {fmtDay(new Date(dateKey + 'T12:00:00Z'), 'UTC')}
                      {isToday && <span className="ml-2 text-xs font-normal text-[var(--accent)]">today</span>}
                    </h2>
                    {total > 0 && (
                      <span className="text-xs tabular-nums text-[var(--faint)]">
                        {(total / 60).toFixed(1)}h
                      </span>
                    )}
                  </div>

                  {blocks.length === 0 ? (
                    <p className="text-sm text-[var(--faint)]">Nothing scheduled.</p>
                  ) : (
                    <div className="space-y-2">
                      {blocks.map((b) => (
                        <BlockCard
                          key={b.id}
                          block={b}
                          tz={TZ}
                          colour={colourFor(b.course)}
                          isPast={new Date(b.end) < now}
                          onComplete={(outcome, minutes) => complete(b.id, outcome, minutes)}
                          onDrop={() => drop(b.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          )}
        </>
      )}
    </main>
  );
}
