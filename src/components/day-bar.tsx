'use client';

import { useState } from 'react';
import type { DayBreakdown } from '@/lib/schedule/day';

const hrs = (m: number) => (m >= 60 ? `${(m / 60).toFixed(m % 60 === 0 ? 0 : 1)}h` : `${m}m`);

/**
 * Where a day goes, as one horizontal stacked bar.
 *
 * A pie was the obvious reach and the wrong one: comparing segment lengths on a
 * single axis is far easier than comparing wedge angles, long course names have
 * somewhere to sit, and this still reads at 10px tall on a phone.
 *
 * Segments are separated by a 2px surface gap rather than a border, so adjacent
 * colours never touch — which is what makes the two closest hues in the palette
 * distinguishable to a colourblind reader even before the labels.
 */
export function DayBar({ day }: { day: DayBreakdown }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = day.segments.reduce((s, x) => s + x.minutes, 0) || 1;

  if (day.segments.length === 0) {
    return <p className="text-sm text-[var(--faint)]">Nothing on this day yet.</p>;
  }

  return (
    <div>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg" role="img"
        aria-label={day.segments.map((s) => `${s.label} ${hrs(s.minutes)}`).join(', ')}>
        {day.segments.map((s) => {
          const pct = (s.minutes / total) * 100;
          return (
            <div
              key={s.key}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              className="relative h-full transition-opacity first:rounded-l-lg last:rounded-r-lg"
              style={{
                width: `${pct}%`,
                background: s.color,
                opacity: hovered && hovered !== s.key ? 0.45 : 1,
              }}
              title={`${s.label} · ${hrs(s.minutes)}`}
            />
          );
        })}
      </div>

      {/* Colour is never the only encoding: three of the light steps sit below
          3:1 on a light surface, so every segment is named here. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {day.segments.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-1.5"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className={s.kind === 'work' ? '' : 'text-[var(--muted)]'}>{s.label}</span>
            <span className="tabular-nums text-[var(--faint)]">{hrs(s.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Three numbers, which is the honest summary of a day. */
export function DayStats({ day }: { day: DayBreakdown }) {
  const cells = [
    { label: 'Planned', value: hrs(day.plannedMinutes) },
    { label: 'Spoken for', value: hrs(day.fixedMinutes) },
    { label: 'Unscheduled', value: hrs(day.freeMinutes) },
  ];

  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)]">
      {cells.map((c) => (
        <div key={c.label} className="bg-[var(--surface)] px-3 py-2.5">
          <dt className="text-xs text-[var(--faint)]">{c.label}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
