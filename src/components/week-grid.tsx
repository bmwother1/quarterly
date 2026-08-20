'use client';

import { useRef, useState } from 'react';
import type { Availability, BusyBlock, StudyBlock } from '@/lib/types';
import { localParts, fmtTime, zonedInstant } from '@/lib/time';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Commitments you can't move get their own colours.
 *
 * Drawn as solid blocks rather than hatched voids, because a work shift *is* an
 * event — it's most of a weekday — and rendering it as an absence made the week
 * look emptier and less true than it is.
 */
const BUSY_COLOR: Record<string, string> = {
  work: '#64748b',
  class: '#7c3aed',
  commitment: '#0891b2',
  sleep: '#475569',
};

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
  days, blocks, availability, tz, colourFor, selectedId, onSelect, onMove, todayKey,
}: {
  days: string[];
  blocks: StudyBlock[];
  availability: Availability;
  tz: string;
  colourFor: (group: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called with the new start instant once a block is dropped. */
  onMove: (blockId: string, startMs: number) => void;
  todayKey: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

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

  const setDragBoth = (next: { id: string; dateKey: string; minute: number } | null) => {
    dragRef.current = next;
    setDrag(next);
  };
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

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--faint)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded-sm"
            style={{ background: 'color-mix(in srgb, #64748b 40%, var(--surface))', borderLeft: '3px solid #64748b' }}
            aria-hidden
          />
          fixed commitments
        </span>
        <span>tap a block for the reason, or drag it to move it</span>
        <span className="ml-auto">scroll sideways for next week</span>
      </div>

      <div className="overflow-x-auto">
        <div ref={gridRef} className="flex gap-px" style={{ minWidth: days.length * 92 }}>
        {/* Hour gutter */}
        <div className="relative w-11 shrink-0" style={{ height: 640 }}>
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-[var(--faint)]"
              style={{ top: `${pct(m)}%` }}
            >
              {String(Math.floor(m / 60) % 24).padStart(2, '0')}
            </div>
          ))}
        </div>

        {days.map((dateKey) => {
          const weekday = localParts(new Date(dateKey + 'T12:00:00Z'), 'UTC').weekday;
          const dayBlocks = blocks.filter((b) => localParts(new Date(b.start), tz).dateKey === dateKey);
          const isToday = dateKey === todayKey;

          const positioned: Positioned[] = dayBlocks.map((block) => {
            const s = minuteOfDay(block.start, tz);
            const e = minuteOfDay(block.end, tz);
            return { block, topPct: pct(s), heightPct: Math.max(2.5, ((e - s) / span) * 100) };
          });

          return (
            <div key={dateKey} className="min-w-0 flex-1">
              <div className={`pb-1 text-center text-xs ${isToday ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                {DAY_LABELS[weekday]}{' '}
                <span className="text-[var(--faint)]">{Number(dateKey.slice(8))}</span>
              </div>

              <div
                data-daycol={dateKey}
                className={`relative overflow-hidden rounded border ${
                  isToday ? 'border-[var(--accent)]/40' : 'border-[var(--border)]'
                } bg-[var(--surface)]`}
                style={{ height: 640 }}
              >
                {/* Hour lines */}
                {hourMarks.map((m) => (
                  <div key={m} className="absolute inset-x-0 border-t border-[var(--border)]/50" style={{ top: `${pct(m)}%` }} />
                ))}

                {/* Time you don't have: work, class, sleep. Drawn first, behind everything. */}
                {busyFor(availability.busy, weekday).map((b, i) => {
                  const top = pct(Math.max(b.startMin, rangeStart));
                  const height = ((Math.min(b.endMin, rangeEnd) - Math.max(b.startMin, rangeStart)) / span) * 100;
                  if (height <= 0) return null;
                  const colour = BUSY_COLOR[b.kind] ?? BUSY_COLOR.commitment;
                  return (
                    <div
                      key={`${b.label}-${i}`}
                      className="absolute inset-x-0.5 overflow-hidden rounded px-1 py-0.5"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        background: `color-mix(in srgb, ${colour} 26%, var(--surface))`,
                        borderLeft: `3px solid ${colour}`,
                      }}
                      title={b.label}
                    >
                      {height > 4 && (
                        <span className="block truncate text-[10px] font-medium leading-tight text-[var(--ink)]">
                          {b.label}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Study blocks */}
                {positioned.map(({ block, topPct, heightPct }) => {
                  const settled = block.status !== 'planned';
                  const colour = colourFor(block.course);
                  const selected = block.id === selectedId;
                  const dragging = drag?.id === block.id;

                  // While dragging, the block follows the pointer's day and
                  // quarter-hour rather than its stored position.
                  const shownTop = dragging ? pct(drag!.minute) : topPct;
                  const inThisColumn = dragging ? drag!.dateKey === dateKey : true;
                  if (dragging && !inThisColumn) return null;

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
                        try {
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        } catch {
                          /* dragging still works, it just stops at the edges */
                        }
                        setDragBoth({ id: block.id, dateKey, minute: minuteOfDay(block.start, tz) });
                      }}
                      onPointerMove={(e) => {
                        const cur = dragRef.current;
                        if (!cur || cur.id !== block.id) return;
                        const hit = locate(e.clientX, e.clientY);
                        if (!hit) return;
                        if (hit.dateKey !== cur.dateKey || hit.minute !== cur.minute) moved.current = true;
                        setDragBoth({ id: block.id, ...hit });
                      }}
                      onPointerUp={() => {
                        const cur = dragRef.current;
                        if (cur && cur.id === block.id && moved.current) {
                          onMove(block.id, zonedInstant(cur.dateKey, cur.minute, tz).getTime());
                        }
                        setDragBoth(null);
                      }}
                      onPointerCancel={() => setDragBoth(null)}
                      title={`${block.course} · ${fmtTime(block.start, tz)}`}
                      className={`absolute inset-x-0.5 touch-none select-none overflow-hidden rounded px-1 py-0.5 text-left text-[10px] leading-tight ${
                        selected ? 'ring-2 ring-[var(--ink)]' : ''
                      } ${settled ? 'opacity-45' : 'cursor-grab active:cursor-grabbing'} ${
                        dragging ? 'z-10 shadow-[var(--shadow-md)] ring-2 ring-[var(--accent)]' : 'transition-shadow'
                      }`}
                      style={{
                        top: `${shownTop}%`,
                        height: `${heightPct}%`,
                        background: `color-mix(in srgb, ${colour} 24%, var(--surface))`,
                        borderLeft: `3px solid ${colour}`,
                      }}
                    >
                      <span className={`block truncate font-medium ${settled ? 'line-through' : ''}`}>
                        {block.course}
                      </span>
                      {heightPct > 6 && (
                        <span className="block truncate text-[var(--muted)]">
                          {dragging
                            ? fmtTime(zonedInstant(drag!.dateKey, drag!.minute, tz), tz)
                            : fmtTime(block.start, tz)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
