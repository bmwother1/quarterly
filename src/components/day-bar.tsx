'use client';

import { useState } from 'react';
import type { DayBreakdown } from '@/lib/schedule/day';

const hrs = (m: number) => (m >= 60 ? `${(m / 60).toFixed(m % 60 === 0 ? 0 : 1)}h` : `${m}m`);

/**
 * Where a day goes, as one horizontal stacked bar.
 *
 * A pie was the obvious reach and the wrong one: comparing segment lengths on a
 * single axis is far easier than comparing wedge angles, long course names have
 * somewhere to sit, and this still reads at 12px tall on a phone.
 *
 * Segments are separated by a 2px gap rather than a border, so adjacent
 * colours never touch, which is what makes the two closest hues in the palette
 * distinguishable to a colourblind reader even before the labels.
 */
export function DayBar({ day }: { day: DayBreakdown }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = day.segments.reduce((s, x) => s + x.minutes, 0) || 1;

  if (day.segments.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nothing on this day yet.</p>;
  }

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={day.segments.map((s) => `${s.label} ${hrs(s.minutes)}`).join(', ')}>
        {day.segments.map((s) => {
          const pct = (s.minutes / total) * 100;
          return (
            <div
              key={s.key}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              className="h-full"
              style={{
                width: `${pct}%`,
                background: s.color,
                opacity: hovered && hovered !== s.key ? 0.45 : 1,
                transition: 'opacity var(--dur-exit) var(--ease)',
              }}
              title={`${s.label} · ${hrs(s.minutes)}`}
            />
          );
        })}
      </div>

      {/* Colour is never the only encoding: three of the light steps sit below
          3:1 on a light surface, so every segment is named here. */}
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {day.segments.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className={`min-w-0 truncate ${s.kind === 'work' ? '' : 'text-[var(--muted)]'}`}>{s.label}</span>
            <span className="ml-auto shrink-0 text-[var(--muted)]">{hrs(s.minutes)}</span>
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
    <dl className="grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-4">
      {cells.map((c) => (
        <div key={c.label}>
          <dt className="text-sm text-[var(--muted)]">{c.label}</dt>
          <dd className="text-title font-semibold">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
