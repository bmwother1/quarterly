'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { BlockCard } from '@/components/block-card';
import { WeekGrid } from '@/components/week-grid';
import { MonthGrid } from '@/components/month-grid';
import { Sheet, AddButton } from '@/components/sheet';
import { UndoBar } from '@/components/undo-bar';
import { AddItem } from '@/components/add-item';
import { SetupPrompt } from '@/components/setup-prompt';
import { RescueNotice } from '@/components/rescue-notice';
import { DEFAULT_TZ, addDays, fmtDay, fmtTime, localParts } from '@/lib/time';
import { missedBlocks } from '@/lib/schedule/complete';
import { absence } from '@/lib/schedule/absence';
import { nextNotice } from '@/lib/notify';
import type { StudyBlock } from '@/lib/types';
import { categoryForCommitment, colorVar, type Category } from '@/lib/categories';

const TZ = DEFAULT_TZ;

export default function WeekPage() {
  const {
    state, hydrated, replan, complete, drop, moveBlock,
    addEvent, updateEvent, removeEvent, addTask, undo, undoLabel, dismissUndo,
    skipStep, confirmSleep, markLiveIfReady, ackLive, startFresh,
  } = useQuarterly(TZ);
  // Fixed at mount so every render agrees on "now" — reading the clock during
  // render is impure and drifts between the server and client passes.
  const [now] = useState(() => new Date());
  const [view, setView] = useState<'grid' | 'list' | 'month'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [movedNotice, setMovedNotice] = useState<string | null>(null);

  /** Say what the app did on the student's behalf, then get out of the way. */
  function announce(moved?: string | null) {
    if (!moved) return;
    setMovedNotice(moved);
    setTimeout(() => setMovedNotice((cur) => (cur === moved ? null : cur)), 6000);
  }
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const colourFor = useMemo(() => {
    // Resolves to a CSS variable, not a hex, so the same block follows the
    // theme instead of carrying a colour chosen under whichever mode was
    // active when it was created.
    const map = new Map<string, string>();
    for (const c of state.courses) map.set(c.code, colorVar(c.category, c.shade));
    for (const c of state.commitments) {
      map.set(c.title, colorVar(categoryForCommitment(c.category), c.shade));
    }
    return (group: string) => map.get(group) ?? 'var(--accent)';
  }, [state.courses, state.commitments]);

  /**
   * The same lookup as `colourFor`, answering category instead of colour.
   *
   * A block only knows its course code or commitment title, so turning that
   * back into a category needs the same map. Anything unrecognised is
   * coursework, which is what an orphaned block almost always is.
   */
  const categoryFor = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of state.courses) map.set(c.code, c.category);
    for (const c of state.commitments) map.set(c.title, categoryForCommitment(c.category));
    return (group: string): Category => map.get(group) ?? 'deadline';
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
  const gap = useMemo(() => absence(state.blocks, now, TZ), [state.blocks, now]);

  // What the app would send right now, if delivery existed. Shown rather than
  // hidden because the tone is the risky part, and it's easier to judge a real
  // message against a real week than to argue about copy in the abstract.
  const notice = useMemo(
    () => nextNotice({
      blocks: state.blocks,
      assignments: state.assignments,
      commitments: state.commitments,
      now,
      tz: TZ,
      lastSentAt: null,
    }),
    [state.blocks, state.assignments, state.commitments, now],
  );
  const selected = useMemo(
    () => state.blocks.find((b) => b.id === selectedId) ?? null,
    [state.blocks, selectedId],
  );
  const selectedEvent = useMemo(
    () => state.events.find((e) => e.id === selectedEventId) ?? null,
    [state.events, selectedEventId],
  );
  const editingEvent = useMemo(
    () => state.events.find((e) => e.id === editingEventId) ?? null,
    [state.events, editingEventId],
  );

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p className="text-[var(--muted)]">Loading your week…</p>
      </main>
    );
  }

  const hasInputs = state.assignments.length > 0 || state.commitments.length > 0 || state.events.length > 0;

  const planned = state.blocks.filter((b) => b.status === 'planned');

  return (
    <main
      // The calendar needs roughly twice the width of the prose views. Both
      // widths are written out in full because Tailwind reads source text: a
      // class name stitched together at runtime is a string it never sees, so
      // the utility is never generated. That is what broke here before, not the
      // `max-w-*` utilities themselves, which work everywhere else in the app.
      className={`mx-auto w-full px-5 py-10 sm:py-14 ${
        view === 'grid' ? 'max-w-[1080px]' : 'max-w-2xl'
      }`}
    >
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">This week</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {planned.length} blocks · {(planned.reduce((s, b) => s + b.minutes, 0) / 60).toFixed(1)}h planned
          </p>
        </div>

      </header>

      {!hasInputs && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">This is your week. Nothing in it yet.</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Tell it about your classes, your job and your sleep, and they&rsquo;ll appear below as
            time already spoken for. Study blocks get fitted around them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href="/setup" className="rounded-lg bg-[var(--accent)] px-3.5 py-2 font-medium text-[var(--accent-ink)]">
              Set up my week
            </Link>
            <Link href="/import" className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2">
              Import a calendar
            </Link>
          </div>
        </div>
      )}

      <>
          {/*
            A skipped block and a week away are not the same event and must not
            get the same screen. Asking someone to adjudicate fifteen blocks
            from last Tuesday is a toll gate charged at the exact moment they
            are deciding whether to keep using this.
          */}
          <RescueNotice tz={TZ} />

          {gap.kind === 'away' && (
            <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
              <h2 className="font-medium">Welcome back.</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {gap.blocks.length} block{gap.blocks.length === 1 ? '' : 's'} went by over{' '}
                {gap.days} day{gap.days === 1 ? '' : 's'} while you were away. You don&rsquo;t have to
                account for them. They stay in your history as missed, so nothing here pretends
                the week happened.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => startFresh(new Date())}
                  className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)]"
                >
                  Plan from today
                </button>
                <span className="text-sm text-[var(--faint)]">
                  or mark them yourself below
                </span>
              </div>
            </div>
          )}

          {gap.kind === 'lapse' && (
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

          {hasInputs && (
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
          )}

          {hasInputs && (
            <SetupPrompt
              state={state}
              skipStep={skipStep}
              confirmSleep={confirmSleep}
              markLiveIfReady={markLiveIfReady}
              ackLive={ackLive}
            />
          )}

          {notice && (
            <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
              <p className="text-xs uppercase tracking-wide text-[var(--faint)]">
                Next notification · preview
              </p>
              <p className="mt-1.5 font-medium">{notice.title}</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{notice.body}</p>
              <p className="mt-2 text-xs text-[var(--faint)]">
                Delivery isn&rsquo;t wired up yet. This is what you&rsquo;d have received.
              </p>
            </div>
          )}

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
            {(['grid', 'list', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  view === v
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {v === 'grid' ? 'Calendar' : v === 'list' ? 'List' : 'Month'}
              </button>
            ))}
          </div>

          {view === 'grid' && (
            <div className="mb-8 space-y-4">
              <WeekGrid
                days={days}
                blocks={state.blocks}
                events={state.events}
                availability={state.availability}
                tz={TZ}
                colourFor={colourFor}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId((cur) => (cur === id ? null : id));
                  setSelectedEventId(null);
                }}
                // Says what it shifted. Silent reshuffling is how a plan becomes fiction.
                onMove={(id, startMs) => announce(moveBlock(id, startMs))}
                onSelectEvent={(id) => {
                  setSelectedEventId((cur) => (cur === id ? null : id));
                  setSelectedId(null);
                }}
                selectedEventId={selectedEventId}
                todayKey={localParts(now, TZ).dateKey}
              />

              {selectedEvent ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: colorVar(selectedEvent.category, selectedEvent.shade) }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--muted)]">
                        {fmtDay(selectedEvent.start, TZ)} · {fmtTime(selectedEvent.start, TZ)}–{fmtTime(selectedEvent.end, TZ)}
                      </p>
                      <p className="mt-0.5 font-medium">{selectedEvent.title}</p>
                      <p className="mt-1.5 text-sm text-[var(--muted)]">
                        Fixed, so nothing gets scheduled over it.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          onClick={() => setEditingEventId(selectedEvent.id)}
                          className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { removeEvent(selectedEvent.id); setSelectedEventId(null); }}
                          className="rounded-lg border border-[var(--warn)]/50 px-3 py-1.5 text-sm text-[var(--warn)]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selected ? (
                <BlockCard
                  block={selected}
                  tz={TZ}
                  colour={colourFor(selected.course)}
                  isPast={new Date(selected.end) < now}
                  onComplete={(outcome, minutes) => complete(selected.id, outcome, minutes)}
                  onDrop={() => { drop(selected.id); setSelectedId(null); }}
                />
              ) : hasInputs ? (
                <p className="text-sm text-[var(--faint)]">
                  Tap a block to see why it&rsquo;s there and mark it off. Shaded bands are the
                  hours you already gave away.
                </p>
              ) : (
                <p className="text-sm text-[var(--faint)]">
                  Your study blocks will appear here, fitted around the shaded hours.
                </p>
              )}
            </div>
          )}

          {view === 'month' && (
            <div className="mb-8">
              <MonthGrid
                blocks={state.blocks}
                events={state.events}
                availability={state.availability}
                tz={TZ}
                colorFor={colourFor}
                categoryFor={categoryFor}
              />
            </div>
          )}

          {view === 'list' && (
          <div className="space-y-8">
            {days.map((dateKey) => {
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

      {movedNotice && (
        <div
          role="status"
          className="rise fixed inset-x-0 z-40 mx-auto w-fit max-w-[92vw] rounded-full border border-[var(--border)] bg-[var(--ink)] px-4 py-2.5 text-center text-sm text-[var(--bg)] shadow-[var(--shadow-md)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--fab-lift) + 4rem)' }}
        >
          {movedNotice}
        </div>
      )}

      <UndoBar label={undoLabel} onUndo={undo} onDismiss={dismissUndo} />

      {/* Before anything is set up the page has one job — get you set up. A
          floating + there is a second, competing call to action. */}
      {hasInputs && <AddButton onClick={() => setAdding(true)} />}

      <Sheet open={adding} title="Add to your week" onClose={() => setAdding(false)}>
        <AddItem
          compact
          events={state.events}
          onAddEvent={addEvent}
          onRemoveEvent={removeEvent}
          onAddTask={addTask}
          tz={TZ}
          onDone={(moved) => { setAdding(false); announce(moved); }}
        />
      </Sheet>

      <Sheet
        open={editingEvent !== null}
        title="Edit event"
        onClose={() => setEditingEventId(null)}
      >
        {/* Keyed on the event so the form re-initialises from whichever one was
            tapped, rather than keeping the values from the last edit. */}
        {editingEvent && (
          <AddItem
            key={editingEvent.id}
            compact
            editing={editingEvent}
            events={state.events}
            onAddEvent={addEvent}
            onUpdateEvent={updateEvent}
            onRemoveEvent={removeEvent}
            onAddTask={addTask}
            tz={TZ}
            onDone={(moved) => { setEditingEventId(null); setSelectedEventId(null); announce(moved); }}
          />
        )}
      </Sheet>
    </main>
  );
}
