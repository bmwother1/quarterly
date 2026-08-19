'use client';

import type { Availability, BusyBlock, StudyBlock } from '@/lib/types';
import { localParts, fmtTime } from '@/lib/time';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  days, blocks, availability, tz, colourFor, selectedId, onSelect, todayKey,
}: {
  days: string[];
  blocks: StudyBlock[];
  availability: Availability;
  tz: string;
  colourFor: (group: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  todayKey: string;
}) {
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

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--faint)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-[var(--border)]"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, var(--border) 0 4px, transparent 4px 8px)' }}
            aria-hidden
          />
          time you don&rsquo;t have
        </span>
        <span>tap a block for the reason and to mark it off</span>
      </div>

      <div className="overflow-x-auto">
      <div className="flex min-w-[640px] gap-px">
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
                  return (
                    <div
                      key={`${b.label}-${i}`}
                      className="absolute inset-x-0 border-y border-[var(--border)]"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        // Hatched rather than flat, so it reads as unavailable at a
                        // glance instead of looking like an empty slot with a tint.
                        backgroundImage:
                          'repeating-linear-gradient(45deg, var(--border) 0 6px, transparent 6px 12px)',
                        opacity: b.kind === 'sleep' ? 0.5 : 0.85,
                      }}
                      title={b.label}
                    >
                      {height > 6 && (
                        <span className="block px-1 pt-1 text-[9px] font-medium leading-tight text-[var(--muted)]">
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
                  return (
                    <button
                      key={block.id}
                      onClick={() => onSelect(block.id)}
                      title={`${block.course} · ${fmtTime(block.start, tz)}`}
                      className={`absolute inset-x-0.5 overflow-hidden rounded px-1 py-0.5 text-left text-[10px] leading-tight transition-shadow ${
                        selected ? 'ring-2 ring-[var(--ink)]' : ''
                      } ${settled ? 'opacity-45' : ''}`}
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        background: `color-mix(in srgb, ${colour} 22%, var(--surface))`,
                        borderLeft: `3px solid ${colour}`,
                      }}
                    >
                      <span className={`block truncate font-medium ${settled ? 'line-through' : ''}`}>
                        {block.course}
                      </span>
                      {heightPct > 6 && (
                        <span className="block truncate text-[var(--muted)]">{fmtTime(block.start, tz)}</span>
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
