'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Availability, BusyBlock, FixedEvent, StudyBlock } from '@/lib/types';
import type { Deadline } from '@/lib/schedule/deadlines';
import { statusLabel } from '@/lib/schedule/deadlines';
import { localParts, fmtTime, zonedInstant } from '@/lib/time';
import { categoryForBusyKind, colorVar } from '@/lib/categories';
import { usePlanMotion } from '@/hooks/use-plan-motion';
import { isCourseCode, keepCodes } from './course-name';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The grid is this tall whatever the range, so a pixel height is a percent of it. */
const GRID_PX = 640;

/**
 * Commitments you can't move are drawn as solid bands rather than hatched
 * voids, because a work shift *is* an event. It is most of a weekday, and
 * rendering it as an absence made the week look emptier and less true than
 * it is.
 *
 * They recede, though. A band is a neutral wash with its category's colour as
 * a thin edge, taken from the same validated palette as everything else. They
 * used to carry four hex values of their own, so a work shift was slate here
 * and teal in the month view's legend.
 */
const BAND_FILL = 'color-mix(in oklab, var(--ink) 5%, var(--surface))';

/** Pixels per stacked deadline flag: a 16px flag and a 4px gap. */
const FLAG_PX = 20;

/** "9 AM", matching how every block's own time is written. */
function hourLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "1:40", for the marker in the gutter. The column says which day. */
function clockLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * A week as a time grid rather than a list.
 *
 * Two things a list can't do. Proportion: a 90-minute build session should look
 * three times a 30-minute one, so a heavy evening reads as heavy at a glance.
 * And context: the hours the student already lost to work, class and sleep are
 * drawn in, which is what makes an empty-looking Tuesday legible as "you were
 * at your job", not "the app forgot you".
 */

interface Positioned {
  block: StudyBlock;
  topPct: number;
  heightPct: number;
}

/** Minutes after local midnight, for an instant. */
function minuteOfDay(iso: string, tz: string): number {
  return localParts(new Date(iso), tz).minutesOfDay;
}

/**
 * Expand a weekly busy pattern into the bands for one weekday, splitting
 * anything that wraps past midnight onto the following day.
 */
function busyFor(busy: BusyBlock[], weekday: number): Array<{ startMin: number; endMin: number; label: string; kind: string }> {
  const out = [];
  for (const b of busy) {
    const wraps = b.endMin <= b.startMin;
    if (b.day === weekday) out.push({ startMin: b.startMin, endMin: wraps ? 1440 : b.endMin, label: b.label, kind: b.kind });
    if (wraps && (b.day + 1) % 7 === weekday) out.push({ startMin: 0, endMin: b.endMin, label: b.label, kind: b.kind });
  }
  return out;
}

export function WeekGrid({
  days, blocks, events, availability, tz, colourFor, selectedId, onSelect, onMove,
  onSelectEvent, selectedEventId, todayKey, deadlines, focusAssignmentId, onSelectDeadline,
}: {
  days: string[];
  blocks: StudyBlock[];
  /** One-off fixed commitments, drawn alongside the recurring ones. */
  events: FixedEvent[];
  availability: Availability;
  tz: string;
  colourFor: (group: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called with the new start instant once a block is dropped. */
  onMove: (blockId: string, startMs: number) => void;
  /** Tapping a one-off event. Everything on the calendar should be tappable. */
  onSelectEvent: (id: string) => void;
  selectedEventId: string | null;
  todayKey: string;
  /** Deadlines by local date. Drawn in the column they fall on, at their time. */
  deadlines?: Map<string, Deadline[]>;
  /**
   * The assignment whose deadline and sessions should read as one thing. Set by
   * tapping either: a block lights up its deadline, a deadline its blocks.
   */
  focusAssignmentId?: string | null;
  onSelectDeadline?: (assignmentId: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Whether there is more week off either edge.
   *
   * Fourteen columns are rendered and a phone shows three, and the only thing
   * saying so was the words "scroll sideways for next week" in the faintest
   * grey in the palette. A soft edge is the standard way to say "this
   * continues" without spending a sentence on it, and it has to know when it is
   * lying: a fade still showing at the end of the scroll is worse than none,
   * because it promises content that is not there.
   */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  /*
   * Measured imperatively rather than through onScroll and a mount effect.
   *
   * The first version did it the obvious way and got the fades backwards: a
   * mount effect runs before the grid has been laid out, so `scrollWidth` still
   * equals `clientWidth`, the arithmetic says there is nothing to the right, and
   * nothing recomputes it afterwards. A ResizeObserver fires once the element
   * actually has a size, which is the only moment the measurement is worth
   * taking, and it also covers rotating the phone and the column count changing.
   */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft < max - 4 });
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [days.length]);

  /**
   * Drag state lives in a ref *and* in state.
   *
   * The ref is the source of truth for the handlers: a quick drag fires
   * pointermove before React has committed the pointerdown render, so a handler
   * reading the state closure sees `null`, bails, and the drag silently does
   * nothing. The state copy exists only to trigger the re-render that shows the
   * block following the pointer.
   */
  const dragRef = useRef<{ id: string; dateKey: string; minute: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dateKey: string; minute: number } | null>(null);

  /**
   * Blocks travel to their new slots when the plan changes rather than
   * teleporting. Measured against gridRef, so scrolling does not register as
   * movement.
   *
   * Stood down while a drag is in progress: the dragged block is redrawn under
   * the thumb on every pointer move, and animating that would fight the finger
   * rather than follow it.
   */
  usePlanMotion(gridRef, drag === null);

  const setDragBoth = (next: { id: string; dateKey: string; minute: number } | null) => {
    dragRef.current = next;
    setDrag(next);
  };
  /**
   * The current time, as a minute of the day, for the line across today.
   *
   * Starts null and is filled in by the effect rather than read during render.
   * The server has no idea what time it is where the student is, so rendering a
   * position on the first pass is a hydration mismatch by construction, and the
   * line is the one thing on this grid guaranteed to differ between the two.
   *
   * It ticks every thirty seconds and glides between ticks with a linear
   * transition of the same length, so it moves the way a clock hand does
   * rather than jumping a pixel a minute. A second would cost a render for a
   * third of a pixel.
   */
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const p = localParts(new Date(), tz);
      setNowMin(p.minutesOfDay + new Date().getSeconds() / 60);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tz]);

  // Show only the hours that matter. Rendering midnight to midnight wastes half
  // the screen on hours nobody is awake for.
  const starts = blocks.map((b) => minuteOfDay(b.start, tz));
  const ends = blocks.map((b) => minuteOfDay(b.end, tz));
  const rangeStart = Math.max(0, Math.min(availability.dayStartMin, ...(starts.length ? starts : [availability.dayStartMin])) - 30);
  const rangeEnd = Math.min(1440, Math.max(availability.dayEndMin, ...(ends.length ? ends : [availability.dayEndMin])) + 30);
  const span = Math.max(60, rangeEnd - rangeStart);

  const hourMarks: number[] = [];
  for (let m = Math.ceil(rangeStart / 60) * 60; m < rangeEnd; m += 60) hourMarks.push(m);

  const pct = (min: number) => ((min - rangeStart) / span) * 100;

  /**
   * Deadlines split by where they can be drawn.
   *
   * Inside the drawn hours, at their time. Outside them (most of Canvas says
   * 11:59pm) in a strip under the grid, the same height in every column so each
   * day's time axis still lines up with the hour gutter. Pinning them to the
   * bottom edge of the grid instead was tried first and covered the evening's
   * last study blocks.
   */
  const deadlineSplit = new Map<string, { inside: Deadline[]; after: Deadline[] }>();
  for (const dateKey of days) {
    const list = deadlines?.get(dateKey) ?? [];
    const inside: Deadline[] = [];
    const after: Deadline[] = [];
    for (const d of list) {
      const m = minuteOfDay(d.dueAt, tz);
      (m >= rangeStart && m <= rangeEnd - 20 && !d.allDay ? inside : after).push(d);
    }
    deadlineSplit.set(dateKey, { inside, after });
  }
  const footerRows = Math.max(0, ...[...deadlineSplit.values()].map((v) => v.after.length));

  // Distinguishes a tap (open the block) from a drag (move it). Without it,
  // every drop also fires a click and the detail panel opens on top.
  const moved = useRef(false);

  /**
   * Which day and minute a screen point lands on.
   *
   * Read from the DOM rather than tracked in state because the columns are
   * flexible width and horizontally scrollable, so their geometry isn't known
   * up front. Snapped to fifteen minutes: finer is not a decision anyone is
   * making with their thumb.
   */
  function locate(clientX: number, clientY: number): { dateKey: string; minute: number } | null {
    const root = gridRef.current;
    if (!root) return null;

    const columns = root.querySelectorAll<HTMLElement>('[data-daycol]');
    for (const col of columns) {
      const r = col.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right) continue;
      const ratio = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      const raw = rangeStart + ratio * span;
      return {
        dateKey: col.dataset.daycol!,
        minute: Math.max(rangeStart, Math.round(raw / 15) * 15),
      };
    }
    return null;
  }

  const px = (pctValue: number) => (pctValue / 100) * GRID_PX;

  return (
    <div>
      <div className="relative">
        <div ref={scrollerRef} className="overflow-x-auto overscroll-x-contain">
        <div
          ref={gridRef}
          className="flex"
          style={{ minWidth: days.length * 92 }}
          /**
           * The whole gesture lives here rather than on the block.
           *
           * A block is unmounted and remounted every time the pointer crosses
           * into another day, and it can also sit underneath a block it is being
           * dragged over. Handlers on the block therefore stop firing exactly
           * when the drag gets interesting. The grid is present for the whole
           * gesture and under the pointer the entire time.
           */
          onPointerMove={(e) => {
            const cur = dragRef.current;
            if (!cur) return;
            const hit = locate(e.clientX, e.clientY);
            if (!hit) return;
            if (hit.dateKey !== cur.dateKey || hit.minute !== cur.minute) moved.current = true;
            setDragBoth({ id: cur.id, ...hit });
          }}
          onPointerUp={() => {
            const cur = dragRef.current;
            if (cur && moved.current) {
              onMove(cur.id, zonedInstant(cur.dateKey, cur.minute, tz).getTime());
            }
            setDragBoth(null);
          }}
          // A cancel is the browser taking the gesture away, so the block goes
          // back rather than landing somewhere the student did not choose.
          onPointerCancel={() => setDragBoth(null)}
        >
        {/*
          Hour gutter. It starts with a spacer the height of the day headers,
          so each label sits on its own line. Without it every label was drawn
          a header's height above the hour it named, about twenty minutes out.
        */}
        <div className="sticky left-0 z-20 w-14 shrink-0 bg-[var(--bg)]">
          <div className="h-12" />
          <div className="relative" style={{ height: GRID_PX }}>
            {hourMarks.map((m) => (
              <div
                key={m}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-xs text-[var(--muted)]"
                style={{ top: `${pct(m)}%` }}
              >
                {hourLabel(m)}
              </div>
            ))}
            {/* The time now, on the axis, masking whichever hour it lands on. */}
            {nowMin !== null && nowMin >= rangeStart && nowMin <= rangeEnd && (
              <div
                className="absolute right-1 z-10 -translate-y-1/2 rounded-sm bg-[var(--bg)] px-1 text-xs font-medium text-[var(--accent)]"
                style={{ top: `${pct(nowMin)}%`, transition: 'top 30s linear' }}
                aria-hidden
              >
                {clockLabel(Math.floor(nowMin))}
              </div>
            )}
          </div>
        </div>

        {days.map((dateKey, col) => {
          const weekday = localParts(new Date(dateKey + 'T12:00:00Z'), 'UTC').weekday;
          /**
           * Blocks this column draws.
           *
           * A dragged block moves between columns, so it is taken out of the one
           * it came from and added to the one under the pointer. Before this it
           * was only ever drawn by its own column, so dragging to another day
           * rendered nothing anywhere: the element unmounted mid-gesture, took
           * its pointer capture with it, and the drop never happened.
           */
          const dayBlocks = blocks.filter((b) => {
            const home = localParts(new Date(b.start), tz).dateKey;
            if (drag?.id === b.id) return drag.dateKey === dateKey;
            return home === dateKey;
          });
          const isToday = dateKey === todayKey;
          const first = col === 0;
          const last = col === days.length - 1;

          const positioned: Positioned[] = dayBlocks.map((block) => {
            const s = minuteOfDay(block.start, tz);
            const e = minuteOfDay(block.end, tz);
            return { block, topPct: pct(s), heightPct: Math.max(2.5, ((e - s) / span) * 100) };
          });

          return (
            <div key={dateKey} className="min-w-0 flex-1">
              <Link
                href={`/day/${dateKey}`}
                aria-label={new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-US', {
                  timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric',
                })}
                className={`flex h-12 flex-col items-center justify-center gap-1 text-xs ${
                  isToday ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <span className={isToday ? 'font-medium' : ''}>{DAY_LABELS[weekday]}</span>
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm ${
                    isToday ? 'bg-[var(--accent)] font-semibold text-[var(--accent-ink)]' : 'text-[var(--ink)]'
                  }`}
                >
                  {Number(dateKey.slice(8))}
                </span>
              </Link>

              <div
                data-daycol={dateKey}
                className={`relative overflow-hidden border-y border-r border-[var(--border)] ${
                  first ? 'rounded-l-sm border-l' : ''
                } ${last ? 'rounded-r-sm' : ''}`}
                style={{
                  height: GRID_PX,
                  background: isToday
                    ? 'color-mix(in oklab, var(--accent) 5%, var(--surface))'
                    : 'var(--surface)',
                }}
              >
                {/* Hour lines */}
                {hourMarks.map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-[var(--border)]" style={{ top: `${pct(m)}%` }} />
                ))}

                {/*
                  Now, on today's column only.

                  Drawn above the blocks so it is never buried, and
                  `pointer-events-none` so it cannot swallow a tap or interrupt a
                  drag passing under it. A dragged block carries a higher z-index,
                  so it still rides over the line rather than under it.

                  Hidden when the clock is outside the drawn range. The grid
                  starts half an hour before the day does, so at 6am the line
                  would otherwise pin itself to the top edge and read as "your
                  day is nearly over".
                */}
                {isToday && nowMin !== null && nowMin >= rangeStart && nowMin <= rangeEnd && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10"
                    style={{ top: `${pct(nowMin)}%`, transition: 'top 30s linear' }}
                    aria-hidden
                  >
                    <div className="h-0.5 w-full -translate-y-1/2 bg-[var(--accent)]" />
                    <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  </div>
                )}

                {/* Time you don't have: work, class, sleep. Drawn first, behind everything. */}
                {busyFor(availability.busy, weekday).map((b, i) => {
                  const top = pct(Math.max(b.startMin, rangeStart));
                  const height = ((Math.min(b.endMin, rangeEnd) - Math.max(b.startMin, rangeStart)) / span) * 100;
                  if (height <= 0) return null;
                  const edge = colorVar(categoryForBusyKind(b.kind as BusyBlock['kind']), 0);
                  return (
                    <div
                      key={`${b.label}-${i}`}
                      className="absolute inset-x-0 overflow-hidden py-1 pl-2 pr-1"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        background: BAND_FILL,
                        boxShadow: `inset 2px 0 0 ${edge}`,
                      }}
                      title={b.label}
                    >
                      {px(height) >= 24 && (
                        <span className="block truncate text-xs leading-4 text-[var(--muted)]">
                          {b.label}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* One-off events: fixed, so drawn like the recurring commitments,
                    with a full-strength edge because each one can be tapped. */}
                {events
                  .filter((e) => localParts(new Date(e.start), tz).dateKey === dateKey)
                  .map((e) => {
                    const sMin = minuteOfDay(e.start, tz);
                    const eMin = minuteOfDay(e.end, tz);
                    const top = pct(Math.max(sMin, rangeStart));
                    const height = ((Math.min(eMin, rangeEnd) - Math.max(sMin, rangeStart)) / span) * 100;
                    if (height <= 0) return null;
                    const chosen = e.id === selectedEventId;
                    const edge = colorVar(e.category, e.shade);
                    return (
                      <button
                        key={e.id}
                        onClick={() => onSelectEvent(e.id)}
                        className={`absolute inset-x-0.5 overflow-hidden rounded-sm py-1 pl-2 pr-1 text-left active:transform-none ${
                          chosen ? 'z-10 outline-2 outline-offset-1 outline-[var(--ink)]' : ''
                        }`}
                        style={{
                          top: `${top}%`,
                          height: `${Math.max(2.5, height)}%`,
                          background: BAND_FILL,
                          // The edge is the colour signal. At a wash's strength
                          // the categories sit about 2 ΔE apart.
                          boxShadow: `inset 3px 0 0 ${edge}`,
                        }}
                        title={`${e.title} · ${fmtTime(e.start, tz)}`}
                      >
                        <span className="block truncate text-xs font-medium leading-4">{keepCodes(e.title)}</span>
                      </button>
                    );
                  })}

                {/* Study blocks */}
                {positioned.map(({ block, topPct, heightPct }) => {
                  const settled = block.status !== 'planned';
                  const colour = colourFor(block.course);
                  const selected = block.id === selectedId;
                  const dragging = drag?.id === block.id;

                  // While dragging, the block follows the pointer's quarter-hour.
                  // Which column draws it is already decided by `dayBlocks`.
                  const shownTop = dragging ? pct(drag!.minute) : topPct;

                  // How many 16px lines fit, after 4px of padding. The name
                  // comes first: the time can already be read off the axis. A
                  // course code is one line and never wraps, so it leaves room
                  // for the time sooner than a name does.
                  const lines = Math.floor((px(heightPct) - 4) / 16);
                  const code = isCourseCode(block.course);
                  const nameLines = code ? 1 : Math.min(2, Math.max(1, lines));
                  const showTime = dragging || lines > nameLines;

                  return (
                    <button
                      key={block.id}
                      onClick={() => { if (!moved.current) onSelect(block.id); }}
                      draggable={false}
                      onPointerDown={(e) => {
                        if (settled) return;
                        // Without this the browser starts a text selection
                        // instead, which swallows the gesture entirely: the
                        // block never moves and no pointerup reaches React.
                        e.preventDefault();
                        moved.current = false;
                        // Capture keeps move events coming once the pointer
                        // leaves the block, which it does immediately. It can
                        // throw for a pointer id the browser isn't tracking, and
                        // that must not take the drag down with it.
                        // Captured on the grid rather than on the block. The
                        // block unmounts the moment the pointer crosses into
                        // another day, and capture dies with the element it was
                        // set on, which is what killed cross-day drags. The grid
                        // outlives the whole gesture.
                        try {
                          gridRef.current?.setPointerCapture(e.pointerId);
                        } catch {
                          /* falls back to bubbling, which still reaches the grid */
                        }
                        setDragBoth({ id: block.id, dateKey, minute: minuteOfDay(block.start, tz) });
                      }}
                      title={`${block.course} · ${fmtTime(block.start, tz)}`}
                      data-block-id={block.id}
                      data-block-start={block.start}
                      data-status={block.status}
                      className={`absolute inset-x-0.5 touch-none select-none overflow-hidden rounded-sm pb-1 pl-2 pr-1 pt-1 text-left active:transform-none ${
                        selected
                          ? 'z-10 outline-2 outline-offset-1 outline-[var(--ink)]'
                          : focusAssignmentId && block.assignmentId === focusAssignmentId
                            // The sessions of the deadline being looked at.
                            ? 'z-10 outline-1 outline-offset-1 outline-[var(--muted)]'
                            : ''
                      } ${settled ? '' : 'cursor-grab'} ${
                        dragging ? 'z-20 scale-[1.03] cursor-grabbing shadow-float' : ''
                      }`}
                      style={{
                        top: `${shownTop}%`,
                        height: `${heightPct}%`,
                        background: settled
                          ? 'transparent'
                          : `color-mix(in oklab, ${colour} 14%, var(--surface))`,
                        boxShadow: `inset 3px 0 0 ${
                          settled ? `color-mix(in oklab, ${colour} 40%, transparent)` : colour
                        }`,
                        // Under the finger it glides between quarter-hours on a
                        // spring instead of stepping, and lifts slightly.
                        transition: dragging
                          ? 'top 140ms var(--ease-spring), scale 140ms var(--ease)'
                          : 'scale var(--dur-exit) var(--ease)',
                      }}
                    >
                      <span
                        className={`block text-xs font-medium leading-4 ${
                          settled ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'
                        } ${nameLines === 1 ? 'truncate' : 'line-clamp-2'}`}
                      >
                        {keepCodes(block.course)}
                      </span>
                      {showTime && (
                        <span className="block truncate text-xs leading-4 text-[var(--muted)]">
                          {dragging
                            ? fmtTime(zonedInstant(drag!.dateKey, drag!.minute, tz), tz)
                            : fmtTime(block.start, tz)}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Deadlines inside the drawn hours, at their time. Dashed and
                    outlined, because a deadline is a moment, not time spent,
                    and must never read as a block. */}
                {(deadlineSplit.get(dateKey)?.inside ?? []).map((d) => (
                  <DeadlineFlag
                    key={`due-${d.id}`}
                    d={d}
                    tz={tz}
                    colour={colourFor(d.course)}
                    focused={d.id === focusAssignmentId}
                    onSelect={onSelectDeadline}
                    style={{ top: `${pct(minuteOfDay(d.dueAt, tz))}%`, transform: 'translateY(-100%)' }}
                  />
                ))}
              </div>

              {/* Deadlines outside the drawn hours, in a strip under the grid.
                  Every column gets the same height, so the axis stays level. */}
              {footerRows > 0 && (
                <div className="relative mt-1" style={{ height: footerRows * FLAG_PX }}>
                  {(deadlineSplit.get(dateKey)?.after ?? []).map((d, i) => (
                    <DeadlineFlag
                      key={`due-${d.id}`}
                      d={d}
                      tz={tz}
                      colour={colourFor(d.course)}
                      focused={d.id === focusAssignmentId}
                      onSelect={onSelectDeadline}
                      style={{ top: i * FLAG_PX }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
        </div>

        {/*
          Soft edges, so the week visibly continues past the screen instead of
          being cut off. Rendered always and faded with opacity rather than
          mounted and unmounted, so reaching the end of the scroll is a settle
          rather than a pop. `pointer-events-none` keeps them out of the drag,
          which runs across this exact area. The left one starts after the
          gutter, which stays put.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-14 w-8 transition-opacity duration-200"
          style={{
            opacity: edges.start ? 1 : 0,
            background: 'linear-gradient(to right, var(--bg), transparent)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 transition-opacity duration-200"
          style={{
            opacity: edges.end ? 1 : 0,
            background: 'linear-gradient(to left, var(--bg), transparent)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * One deadline: a dashed marker in the course colour, with its status at a
 * glance. It shows the course code and a mark, not the word "Due": at 12px
 * both do not fit a 92px column, and cutting the code is the one thing a
 * label here must never do. The dashed outline says deadline, and the label
 * read aloud says the rest.
 */
function DeadlineFlag({
  d, tz, colour, focused, onSelect, style,
}: {
  d: Deadline;
  tz: string;
  colour: string;
  focused: boolean;
  onSelect?: (assignmentId: string) => void;
  style: React.CSSProperties;
}) {
  const alarm = d.status === 'unplanned' || d.status === 'short';
  const done = d.status === 'done';
  return (
    <button
      onClick={() => onSelect?.(d.id)}
      data-deadline-id={d.id}
      className={`absolute inset-x-0.5 z-[5] flex h-4 items-center gap-1 overflow-hidden rounded-sm pl-1 pr-1 text-left text-xs font-medium leading-4 active:transform-none ${
        focused ? 'outline-2 outline-offset-1 outline-[var(--ink)]' : ''
      }`}
      style={{
        ...style,
        background: 'var(--surface)',
        border: `1px dashed ${done ? `color-mix(in oklab, ${colour} 40%, transparent)` : colour}`,
        borderLeft: `3px solid ${done ? `color-mix(in oklab, ${colour} 40%, transparent)` : colour}`,
      }}
      title={`Due ${fmtTime(d.dueAt, tz)} · ${d.course} · ${d.title} · ${statusLabel(d)}`}
      aria-label={`${d.title}, ${d.course}, due ${fmtTime(d.dueAt, tz)}, ${statusLabel(d)}`}
    >
      {(done || alarm) && (
        <span className={`shrink-0 ${alarm ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}`} aria-hidden>
          {done ? '✓' : '!'}
        </span>
      )}
      <span className={`truncate ${done ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>
        {keepCodes(d.course)}
      </span>
    </button>
  );
}
