'use client';

import { useState } from 'react';
import type { Availability, FixedEvent, StudyBlock } from '@/lib/types';
import type { Completion } from '@/lib/schedule/complete';
import { categoryForBusyKind, colorVar } from '@/lib/categories';
import { mapUrl } from '@/lib/classes';
import { fmtTime, localParts, zonedInstant } from '@/lib/time';
import { keepCodes } from './course-name';
import { BlockActions } from './block-card';

interface Item {
  key: string;
  startMs: number;
  title: string;
  sub: string;
  colour: string;
  done: boolean;
  fixed: boolean;
  block?: StudyBlock;
  location?: string | null;
}

/**
 * Today as one line of stops, from the 2026-10-01 redesign: study blocks,
 * classes and events in time order, the current one pulsing, finished ones
 * ticked and faded. Tapping a stop opens it in place, so the day never jumps.
 */
export function DayTimeline({
  todayKey, blocks, events, availability, tz, colourFor, onComplete, onDrop, now,
}: {
  todayKey: string;
  blocks: StudyBlock[];
  events: FixedEvent[];
  availability: Availability;
  tz: string;
  colourFor: (group: string) => string;
  onComplete: (id: string, outcome: Completion, minutes: number | null) => void;
  onDrop: (id: string) => void;
  now: Date;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const weekday = (new Date(`${todayKey}T12:00:00Z`).getUTCDay() + 6) % 7;
  const nowMs = now.getTime();

  const items: Item[] = [
    ...blocks
      .filter((b) => localParts(new Date(b.start), tz).dateKey === todayKey)
      .map((b) => ({
        key: b.id, startMs: Date.parse(b.start), block: b, fixed: false,
        title: b.course === b.title ? keepCodes(b.title) : `${keepCodes(b.course)} · ${keepCodes(b.title)}`,
        sub: b.status === 'planned' ? `${b.minutes} min` : b.status === 'done' ? 'Done' : b.status === 'partial' ? 'Partly done' : 'Skipped',
        colour: colourFor(b.course), done: b.status !== 'planned',
      })),
    ...availability.busy
      .filter((x) => x.day === weekday && (x.kind === 'class' || x.kind === 'work'))
      .map((x) => ({
        key: x.id, startMs: zonedInstant(todayKey, x.startMin, tz).getTime(), fixed: true,
        title: x.label, sub: x.location ?? (x.kind === 'class' ? 'Class' : 'Work'),
        colour: colorVar(categoryForBusyKind(x.kind), 0), done: zonedInstant(todayKey, x.endMin, tz).getTime() < nowMs,
        location: x.location ?? null,
      })),
    ...events
      .filter((e) => localParts(new Date(e.start), tz).dateKey === todayKey)
      .map((e) => ({
        key: e.id, startMs: Date.parse(e.start), fixed: true, title: keepCodes(e.title), sub: `until ${fmtTime(e.end, tz)}`,
        colour: colorVar(e.category, e.shade), done: Date.parse(e.end) < nowMs,
      })),
  ].sort((a, b) => a.startMs - b.startMs);

  // The stop the day is on: the first unfinished study block.
  const current = items.find((i) => !i.fixed && !i.done)?.key ?? null;
  const left = items.filter((i) => !i.fixed && !i.done).length;

  if (items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nothing on today. A good day to get ahead.</p>;
  }

  return (
    <section aria-label="Your day">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-heading font-bold">Your day</h2>
        <span className="text-sm text-[var(--muted)]">{left === 0 ? 'All done' : `${left} left`}</span>
      </div>
      <ol className="relative">
        <span aria-hidden className="absolute bottom-3 left-[83px] top-3 w-0.5 rounded bg-[var(--border)]" />
        {items.map((it, i) => {
          const isNow = it.key === current;
          const expanded = open === it.key;
          return (
            <li key={it.key} className="today-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <button
                onClick={() => setOpen(expanded ? null : it.key)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[62px_44px_minmax(0,1fr)] items-center rounded-[16px] py-1.5 text-left transition-colors active:transform-none"
                style={{ opacity: it.done ? 0.55 : 1 }}
              >
                <span className="whitespace-nowrap pr-3 text-right text-xs text-[var(--muted)]">{fmtTime(new Date(it.startMs), tz).replace(/:00 /, ' ')}</span>
                <span className="flex justify-center">
                  <span
                    className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full ${isNow ? 'today-pulse' : ''}`}
                    style={{
                      border: `2px solid ${it.colour}`,
                      background: it.done ? it.colour : isNow ? 'var(--accent)' : 'var(--bg)',
                    }}
                  >
                    {it.done && !it.fixed && (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--bg)" strokeWidth="2.4" aria-hidden><path d="M3 7.5l2.5 2.5L11 4.5" /></svg>
                    )}
                  </span>
                </span>
                <span
                  className="ml-2 min-w-0 rounded-[12px] px-3 py-2"
                  style={{
                    background: isNow || expanded ? 'color-mix(in oklab, var(--accent) 10%, var(--surface))' : it.fixed ? 'transparent' : 'var(--surface)',
                    border: `1px solid ${isNow ? 'color-mix(in oklab, var(--accent) 35%, var(--border))' : 'var(--border)'}`,
                  }}
                >
                  <span className={`block truncate text-sm font-semibold ${it.done && !it.fixed ? 'line-through decoration-[var(--border-strong)]' : ''}`}>{it.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{it.sub}</span>
                </span>
              </button>
              {expanded && (
                <div className="enter mb-2 ml-[114px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  {it.block ? (
                    <>
                      <p className="text-sm text-[var(--ink)]">
                        <span className="font-semibold text-[var(--accent)]">Why · </span>{it.block.why}
                      </p>
                      {it.block.status === 'planned' && (
                        <BlockActions
                          block={it.block}
                          onComplete={(o, m) => { onComplete(it.block!.id, o, m); setOpen(null); }}
                          onDrop={() => { onDrop(it.block!.id); setOpen(null); }}
                          primary={false}
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--ink)]">
                      {it.location ? (
                        <>
                          {it.location} ·{' '}
                          <a href={mapUrl(it.location)} target="_blank" rel="noreferrer" className="underline underline-offset-4">Map</a>
                        </>
                      ) : 'Fixed, so nothing gets planned over it.'}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
