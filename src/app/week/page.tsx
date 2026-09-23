'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useHeron } from '@/hooks/use-heron';
import { useNarrow } from '@/hooks/use-narrow';
import { useNow } from '@/hooks/use-now';
import { useFirstVisit } from '@/hooks/use-first-visit';
import { usePlanMotion } from '@/hooks/use-plan-motion';
import { BlockCard, BlockRow } from '@/components/block-card';
import { WeekGrid } from '@/components/week-grid';
import { MonthGrid } from '@/components/month-grid';
import { Sheet, AddButton } from '@/components/sheet';
import { UndoBar } from '@/components/undo-bar';
import { Toast } from '@/components/toast';
import { CountUp } from '@/components/count-up';
import { keepCodes } from '@/components/course-name';
import { dayName, focusLabel, shortDate } from '@/components/when';
import { AddItem } from '@/components/add-item';
import { SetupPrompt } from '@/components/setup-prompt';
import { RescueNotice } from '@/components/rescue-notice';
import { DEFAULT_TZ, addDays, fmtDay, fmtTime, localParts } from '@/lib/time';
import { missedBlocks } from '@/lib/schedule/complete';
import { absence } from '@/lib/schedule/absence';
import type { StudyBlock } from '@/lib/types';
import { categoryForCommitment, colorVar, type Category } from '@/lib/categories';

const TZ = DEFAULT_TZ;

const hours = (min: number) => `${(min / 60).toFixed(1)}h`;

export default function WeekPage() {
  const {
    state, hydrated, replan, complete, drop, moveBlock,
    addEvent, updateEvent, removeEvent, addTask, undo, undoLabel, dismissUndo,
    skipStep, confirmSleep, markLiveIfReady, ackLive, startFresh,
  } = useHeron(TZ);
  // Fixed at mount so every render agrees on "now" — reading the clock during
  // render is impure and drifts between the server and client passes. Anything
  // that decides something reads this one.
  const [now] = useState(() => new Date());
  // Kept current, for labels only: "in 20 min" should not stay "in 20 min".
  const liveNow = useNow();
  const firstVisit = useFirstVisit('heron.week.entered');
  /**
   * Which lens the week is shown through.
   *
   * The calendar is the default on a laptop and the wrong default on a phone.
   * `week-grid.tsx` sets a minimum width of 92px across fourteen columns, so the
   * grid is 1288px wide; on a 375px screen that is two and a half visible days
   * and a sideways scroll to find the rest. The first thing a student sees is
   * then a fragment of their week, and the drag-to-move interaction is unusable
   * at that column width.
   *
   * `null` means "nobody has chosen", not "grid". Once a student picks a lens
   * that choice wins at every size, including picking Calendar on a phone,
   * which is theirs to do. Deriving the fallback instead of storing it is what
   * keeps rotating a tablet from silently overriding a deliberate choice.
   */
  const narrow = useNarrow();
  const [chosenView, setChosenView] = useState<'grid' | 'list' | 'month' | null>(null);
  const view = chosenView ?? (narrow ? 'list' : 'grid');
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
  // The block at the top when the page first showed. A different one arriving
  // there later (because the first was answered) is worth an entrance; the
  // same one on every visit is not.
  const [firstFocusId, setFirstFocusId] = useState<string | null>(null);

  /**
   * The next block and the list travel together: answering the block at the
   * top sends it down into the day's done rows, and the one after it rises
   * to take its place. The calendar has its own motion inside WeekGrid.
   */
  const flowRef = useRef<HTMLDivElement>(null);
  usePlanMotion(flowRef, true, { shifts: true });

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

  const todayKey = localParts(now, TZ).dateKey;

  // Fourteen days, matching the planner's horizon. Showing seven while planning
  // fourteen is what made next week look empty.
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(todayKey, i)), [todayKey]);

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

  /**
   * The one block the screen is about: the first unanswered block from today
   * on. A block today whose time has already passed comes first, because
   * answering it is what the rest of the week depends on; after that it is
   * whatever is under way or next.
   */
  const focus = useMemo(() => {
    for (const dateKey of days) {
      const hit = (byDay.get(dateKey) ?? []).find((b) => b.status === 'planned');
      if (hit) return hit;
    }
    return null;
  }, [days, byDay]);

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

  if (!hydrated) return <WeekSkeleton />;

  const hasInputs = state.assignments.length > 0 || state.commitments.length > 0 || state.events.length > 0;
  const planned = state.blocks.filter((b) => b.status === 'planned');
  const today = byDay.get(todayKey) ?? [];
  const leftToday = today.filter((b) => b.status === 'planned').length;
  const doneToday = today.filter((b) => b.status === 'done' || b.status === 'partial').length;

  // One primary action per screen. After an absence it is "Plan from today";
  // with nothing planned it is planning; otherwise it is the next block's Done.
  const away = gap.kind === 'away';
  const replanIsPrimary = hasInputs && !focus && !away;
  const focusIsPrimary = !away;

  const focusPast = focus ? new Date(focus.end) < now : false;
  const label = focus ? focusLabel(focus, focusPast, liveNow, todayKey, TZ) : null;

  if (focus && firstFocusId === null) setFirstFocusId(focus.id);
  const heroEnters = firstVisit || (firstFocusId !== null && focus?.id !== firstFocusId);

  let order = 0;
  const stagger = () => (firstVisit ? order++ : undefined);
  const heroOrder = stagger() ?? 0;

  return (
    <main
      // The calendar needs roughly twice the width of the prose views. Both
      // widths are written out in full because Tailwind reads source text: a
      // class name stitched together at runtime is a string it never sees, so
      // the utility is never generated. That is what broke here before, not the
      // `max-w-*` utilities themselves, which work everywhere else in the app.
      className={`rise mx-auto w-full px-5 pb-12 pt-6 sm:pt-10 ${
        view === 'grid' ? 'max-w-[1080px]' : 'max-w-2xl'
      }`}
    >
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold">This week</h1>
          {hasInputs && (
            <button
              onClick={() => replan(new Date())}
              className={replanIsPrimary ? 'btn-primary' : 'btn-secondary'}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {state.lastPlannedAt ? (
                <>
                  <span className="sm:hidden">Replan</span>
                  <span className="hidden sm:inline">Replan from now</span>
                </>
              ) : 'Plan my week'}
            </button>
          )}
        </div>
        <p className="text-sm text-[var(--muted)]">
          {fmtDay(now, TZ)}
          {leftToday > 0 && <> · {leftToday} left today</>}
          {doneToday > 0 && <> · <CountUp value={doneToday} format={(n) => String(Math.round(n))} /> done</>}
        </p>
      </header>

      {/*
        A skipped block and a week away are not the same event and must not
        get the same screen. Asking someone to adjudicate fifteen blocks
        from last Tuesday is a toll gate charged at the exact moment they
        are deciding whether to keep using this.
      */}
      <div className="mt-6 space-y-4 empty:hidden">
        <RescueNotice tz={TZ} />

        {away && (
          <div className="well enter">
            <h2 className="text-base font-semibold">Welcome back.</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {gap.blocks.length} block{gap.blocks.length === 1 ? '' : 's'} went by over{' '}
              {gap.days} day{gap.days === 1 ? '' : 's'} while you were away. You don&rsquo;t have to
              account for them. They stay in your history as missed, so nothing here pretends
              the week happened.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={() => startFresh(new Date())} className="btn-primary">
                Plan from today
              </button>
              <span className="text-sm text-[var(--muted)]">or mark them yourself below</span>
            </div>
          </div>
        )}

        {/*
          Same container as the 'away' notice above, deliberately.

          An absence was made calm in August; a lapse never was, and it kept a
          warn border, a warn heading, and a count of blocks that "passed
          without an answer". `notify.ts` bans exactly that phrasing for the
          recovery notice, on the grounds that a count of failures is never
          the thing to lead with, and this banner was doing it on the screen
          the student actually opens.

          A lapse still asks, because two days is inside honest recall and the
          answers are worth having. It just stops treating a normal week as an
          error condition.
        */}
        {gap.kind === 'lapse' && (
          <div className="well enter">
            <h2 className="text-base font-semibold">
              {missed.length} block{missed.length === 1 ? '' : 's'} still open
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Mark what happened and the rest of the week rebuilds around what&rsquo;s left.
              Nothing moves until you say so.
            </p>
          </div>
        )}
      </div>

      {!hasInputs && (
        <section className="enter mt-8">
          <h2 className="text-title font-semibold">Nothing in your week yet.</h2>
          <p className="mt-1 max-w-prose text-base text-[var(--muted)]">
            Tell it about your classes, your job and your sleep. Study time gets fitted around
            them.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/setup" className="btn-primary">Set up my week</Link>
            <Link href="/import" className="btn-secondary">Import a calendar</Link>
          </div>
        </section>
      )}

      <div ref={flowRef} className="mt-6">
        {focus && label && (
          <BlockCard
            key={focus.id}
            as="section"
            tracked
            block={focus}
            tz={TZ}
            colour={colourFor(focus.course)}
            isPast={focusPast}
            primary={focusIsPrimary}
            label={
              <>
                <span className="font-semibold text-[var(--accent)]">{label.lead}</span>
                <span className="text-[var(--muted)]"> · {label.rest}</span>
              </>
            }
            onComplete={(outcome, minutes) => complete(focus.id, outcome, minutes)}
            onDrop={() => drop(focus.id)}
            className={heroEnters ? 'enter' : ''}
            style={heroEnters ? ({ '--i': heroOrder } as React.CSSProperties) : undefined}
          />
        )}

        {/*
          The notification preview used to live here and told students
          "delivery isn't wired up yet". Shipping an admission that a feature
          is broken, to someone who has been using the app for ten seconds, is
          worse than shipping nothing. It comes back when delivery works, and
          it belongs in Settings rather than above the calendar.
        */}

        {state.unscheduled.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-semibold">Didn&rsquo;t fit</h2>
            <p className="text-sm text-[var(--muted)]">
              Your week is smaller than your list. Better to know now than on Thursday.
            </p>
            <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {state.unscheduled.map((u) => (
                <li key={u.assignmentId ?? u.commitmentId ?? u.title} className="py-2 text-sm">
                  <span className="font-medium">{keepCodes(u.course)}</span>
                  {u.title !== u.course && <span className="text-[var(--muted)]"> · {u.title}</span>}
                  <span className="block text-[var(--muted)]">
                    {u.sessionsShort
                      ? `${u.sessionsShort} session${u.sessionsShort === 1 ? '' : 's'} short`
                      : `${u.minutes} min`}
                    {', '}{u.reason}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="segmented" role="group" aria-label="View">
            {(['grid', 'list', 'month'] as const).map((v) => (
              <button key={v} onClick={() => setChosenView(v)} aria-pressed={view === v}>
                {v === 'grid' ? 'Calendar' : v === 'list' ? 'List' : 'Month'}
              </button>
            ))}
          </div>
          {planned.length > 0 && (
            <p className="text-sm text-[var(--muted)]">
              {planned.length} blocks, {hours(planned.reduce((s, b) => s + b.minutes, 0))}
              {state.lastPlannedAt && <> · planned {fmtDay(state.lastPlannedAt, TZ)}</>}
            </p>
          )}
        </div>

        {/*
          Keyed on the view so switching Calendar / List / Month fades between
          them. Without it the whole screen is replaced between frames, which on
          the busiest control in the product reads as a page load rather than a
          change of lens.
        */}
        <div key={view} className="rise mt-4">
          {view === 'grid' && (
            <div className="space-y-4">
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
                todayKey={todayKey}
              />

              {selectedEvent ? (
                <div key={selectedEvent.id} className="well enter">
                  <div
                    className="border-l-3 pl-4"
                    style={{ borderColor: colorVar(selectedEvent.category, selectedEvent.shade) }}
                  >
                    <p className="text-sm text-[var(--muted)]">
                      {fmtDay(selectedEvent.start, TZ)} · {fmtTime(selectedEvent.start, TZ)} to {fmtTime(selectedEvent.end, TZ)}
                    </p>
                    <h2 className="mt-1 text-title font-semibold">{keepCodes(selectedEvent.title)}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Fixed, so nothing gets scheduled over it.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => setEditingEventId(selectedEvent.id)} className="btn-secondary">
                        Edit
                      </button>
                      <button
                        onClick={() => { removeEvent(selectedEvent.id); setSelectedEventId(null); }}
                        className="btn-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : selected ? (
                <div key={selected.id} className="well enter">
                  <BlockCard
                    block={selected}
                    tz={TZ}
                    colour={colourFor(selected.course)}
                    isPast={new Date(selected.end) < now}
                    label={
                      <span className="text-[var(--muted)]">
                        {fmtDay(selected.start, TZ)} · {fmtTime(selected.start, TZ)} to {fmtTime(selected.end, TZ)} · {selected.minutes} min
                      </span>
                    }
                    onComplete={(outcome, minutes) => complete(selected.id, outcome, minutes)}
                    onDrop={() => { drop(selected.id); setSelectedId(null); }}
                  />
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  {hasInputs
                    ? 'Tap a block to see why it is there. Drag it to move it.'
                    : 'Study blocks appear here, fitted around the hours you already gave away.'}
                </p>
              )}
            </div>
          )}

          {view === 'month' && (
            <MonthGrid
              blocks={state.blocks}
              events={state.events}
              availability={state.availability}
              tz={TZ}
              colorFor={colourFor}
              categoryFor={categoryFor}
            />
          )}

          {view === 'list' && (
            <div>
              {days.map((dateKey) => {
                const all = byDay.get(dateKey) ?? [];
                // The block at the top of the page is not repeated here. What
                // is left of today runs first, and what is already answered
                // collapses to the end of the day.
                const rest = all.filter((b) => b.id !== focus?.id);
                const blocks = dateKey === todayKey
                  ? [...rest.filter((b) => b.status === 'planned'), ...rest.filter((b) => b.status !== 'planned')]
                  : rest;
                const total = all.filter((b) => b.status === 'planned').reduce((s, b) => s + b.minutes, 0);

                return (
                  <section key={dateKey} className="mt-2 first:mt-0">
                    <div
                      className="sticky z-10 flex items-baseline justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)] py-2"
                      style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}
                    >
                      <h2 className="text-sm">
                        <Link href={`/day/${dateKey}`} className="font-semibold hover:text-[var(--accent)]">
                          {dayName(dateKey, todayKey)}
                        </Link>
                        <span className="text-[var(--muted)]"> · {shortDate(dateKey)}</span>
                      </h2>
                      <span className="text-sm text-[var(--muted)]">
                        {/* A day whose only block is the one at the top of the
                            page says so, rather than showing hours over an
                            empty list. */}
                        {blocks.length === 0
                          ? all.length > 0
                            ? dateKey === todayKey ? 'Nothing else today' : 'Nothing else planned'
                            : 'Nothing planned'
                          : total > 0 ? hours(total) : ''}
                      </span>
                    </div>

                    {blocks.length > 0 && (
                      <ul className="divide-y divide-[var(--border)]">
                        {blocks.map((b) => (
                          <BlockRow
                            key={b.id}
                            block={b}
                            tz={TZ}
                            colour={colourFor(b.course)}
                            isPast={new Date(b.end) < now}
                            stagger={dateKey === todayKey || dateKey === addDays(todayKey, 1) ? stagger() : undefined}
                            onComplete={(outcome, minutes) => complete(b.id, outcome, minutes)}
                            onDrop={() => drop(b.id)}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/*
        Setup sits under the week, not over it.
        A student arrives here having asked for one thing: to see a plan. It
        used to render above the calendar, so the first screen after a
        two-question setup was another setup card, and the thing they came
        for started roughly 900px down. Below the plan it reads as "and
        here's how to make it better", which is what it is.
      */}
      {hasInputs && (
        <div className="mt-10">
          <SetupPrompt
            state={state}
            skipStep={skipStep}
            confirmSleep={confirmSleep}
            markLiveIfReady={markLiveIfReady}
            ackLive={ackLive}
          />
        </div>
      )}

      <Toast message={movedNotice} />

      <UndoBar label={undoLabel} onUndo={undo} onDismiss={dismissUndo} />

      {/* Before anything is set up the page has one job, to get you set up. A
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

/**
 * The shape of the week before it has loaded.
 *
 * This is what the server sends, so it is what a cold load paints first. It
 * used to be the words "Loading your week…" alone on an empty page, and the
 * real layout then arrived underneath the header all at once. The skeleton
 * holds the same places the week will fill, in the same sizes, with no
 * shimmer: it is a placeholder, not a performance.
 */
function WeekSkeleton() {
  const bar = 'rounded-sm bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]';
  // Laptops open on the calendar, which is the wider layout, so the skeleton
  // takes that width there and the page does not change size when it loads.
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-12 pt-6 sm:max-w-[1080px] sm:pt-10" aria-busy="true" aria-label="Loading your week">
      <div className="space-y-2">
        <div className={`h-5 w-24 ${bar}`} />
        <div className={`h-4 w-40 ${bar}`} />
      </div>
      <div className="mt-6 space-y-2 border-l-3 border-[var(--border)] pl-4">
        <div className={`h-4 w-44 ${bar}`} />
        <div className={`h-6 w-64 ${bar}`} />
        <div className={`h-4 w-36 ${bar}`} />
        <div className={`h-12 w-full max-w-md ${bar}`} />
      </div>
      <div className="mt-8 h-11 w-56 rounded-full bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]" />
      <div className="mt-6 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[4rem_1fr] gap-x-3">
            <div className={`h-4 w-14 ${bar}`} />
            <div className="space-y-2">
              <div className={`h-5 w-48 ${bar}`} />
              <div className={`h-4 w-full max-w-sm ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
