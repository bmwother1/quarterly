'use client';

import { useEffect, useState } from 'react';
import type { StudyBlock } from '@/lib/types';
import type { Completion } from '@/lib/schedule/complete';
import { fmtDay, fmtTime } from '@/lib/time';
import { keepCodes } from './course-name';
import { BlockActions } from './block-card';

/**
 * The one block the screen is about, from the 2026-10-01 redesign: the course
 * in its colour, the assignment big, why it is now, and a ring that counts the
 * session down once it starts.
 *
 * Remounted per block (`key`) by the page, so a new block rises in instead of
 * the text swapping in place, which is what makes Done feel like progress.
 */
export function NowCard({
  block, colour, tz, lead, rest, due, isPast, onComplete, onDrop,
}: {
  block: StudyBlock;
  colour: string;
  tz: string;
  /** "Now", "Next", "Missed". */
  lead: string;
  /** "12:45 PM, in 18 min". */
  rest: string;
  due?: { at: string; allDay: boolean; url?: string | null } | null;
  isPast: boolean;
  onComplete: (outcome: Completion, minutes: number | null) => void;
  onDrop: () => void;
}) {
  // Ticks once a minute; nothing here needs finer than that.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const start = Date.parse(block.start);
  const end = Date.parse(block.end);
  const running = now !== null && now >= start && now < end;
  const left = running ? Math.max(1, Math.round((end - (now ?? 0)) / 60_000)) : block.minutes;
  const progress = running ? (now! - start) / (end - start) : 0;
  const R = 48;
  const C = 2 * Math.PI * R;

  const course = block.course === block.title ? null : keepCodes(block.course);
  const dueText = due ? `Due ${fmtDay(due.at, tz)}${due.allDay ? '' : `, ${fmtTime(due.at, tz)}`}` : null;

  return (
    <section
      aria-label={lead}
      className="today-rise relative grid gap-6 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-[minmax(0,1fr)_132px] sm:p-8"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{ background: isPast ? 'var(--border-strong)' : 'var(--accent)', color: isPast ? 'var(--ink)' : 'var(--accent-ink)' }}
          >
            {lead}
          </span>
          <span className="text-sm text-[var(--muted)]">{rest}</span>
        </div>
        <div>
          {course && <p className="text-base font-semibold" style={{ color: colour }}>{course}</p>}
          <h2 className="font-display mt-1 text-display font-bold">{keepCodes(block.title)}</h2>
        </div>
        <p className="rounded-[12px] px-4 py-3 text-base leading-snug" style={{ background: 'color-mix(in oklab, var(--accent) 9%, var(--surface))' }}>
          <span className="font-semibold text-[var(--accent)]">Why now · </span>
          {block.why}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <BlockActions block={block} onComplete={onComplete} onDrop={onDrop} primary />
          {due?.url && (
            <a
              href={due.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 text-sm text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]"
            >
              Open in Canvas
            </a>
          )}
        </div>
      </div>

      <div className="hidden flex-col items-center gap-2 pt-1 sm:flex" aria-hidden>
        <div className="relative h-[120px] w-[120px]">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={R} fill="none" stroke={colour} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * progress}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-display font-extrabold">{left}</span>
            <span className="text-xs text-[var(--muted)]">{running ? 'min left' : 'min'}</span>
          </div>
        </div>
        {dueText && <p className="text-center text-sm text-[var(--muted)]">{dueText}</p>}
      </div>

    </section>
  );
}

/**
 * The little burst when something is marked done. Lives outside the card,
 * because Done replaces the card with the next block straight away.
 */
export function DoneBurst({ colour }: { colour: string }) {
  const [on, setOn] = useState(true);
  if (!on) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-12 left-20 z-10" onAnimationEnd={() => setOn(false)}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <span
            key={i}
            className="today-spark"
            style={{
              background: i % 2 ? colour : 'var(--accent)',
              ['--dx' as string]: `${Math.round(Math.cos(a) * 90)}px`,
              ['--dy' as string]: `${Math.round(Math.sin(a) * 70)}px`,
            }}
          />
        );
      })}
    </div>
  );
}
