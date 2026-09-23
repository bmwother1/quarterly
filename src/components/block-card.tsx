'use client';

import { useState } from 'react';
import type { StudyBlock } from '@/lib/types';
import { fmtTime } from '@/lib/time';
import type { Completion } from '@/lib/schedule/complete';
import { keepCodes } from './course-name';

/**
 * One study block, in the three shapes it takes.
 *
 * - `BlockCard` is a block on its own: the next thing to do at the top of the
 *   week and the day, and the detail under the calendar when a block is
 *   tapped.
 * - `BlockRow` is a block in a timeline, with its time in a column shared by
 *   every row so the eye runs straight down one axis.
 * - A settled block collapses to one quiet line, because a record of what
 *   happened should not compete with what is left to do.
 *
 * The "why" line is the thing that distinguishes this from a to-do list, so
 * it stays visible in every shape rather than hiding behind a tap. A student
 * who can't see why a block is there won't do it.
 */

interface BlockProps {
  block: StudyBlock;
  tz: string;
  colour: string;
  onComplete: (outcome: Completion, minutes: number | null) => void;
  /** "I'm not doing this at all": stop planning it. */
  onDrop: () => void;
  isPast: boolean;
}

/** "MATH 126 · Problem set 4", or just the title when the two are the same. */
export function blockTitle(block: StudyBlock): string {
  return keepCodes(block.course === block.title ? block.title : `${block.course} · ${block.title}`);
}

function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Method and session, the second line of every block. */
function metaParts(block: StudyBlock, isPast: boolean, sayOpen = true): string[] {
  const parts: string[] = [];
  if (sayOpen && isPast && block.status === 'planned') parts.push('Still open');
  if (block.method !== 'work session') parts.push(sentence(block.method));
  if (block.sessionCount > 1) parts.push(`session ${block.sessionIndex} of ${block.sessionCount}`);
  if (block.pinned) parts.push('moved by you');
  return parts;
}

function settledText(block: StudyBlock): string {
  if (block.status === 'done') return `Done · ${block.actualMinutes ?? block.minutes} min`;
  if (block.status === 'partial') return `Partly · ${block.actualMinutes ?? 0} min`;
  return 'Skipped · replan to move it';
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Done, partly, skipped, and the one question each of the last two asks.
 *
 * `primary` is for the block the screen is about: its Done is the one filled
 * button on the page. Everywhere else Done is outlined, so a list of twenty
 * blocks is not twenty competing calls to action.
 */
function BlockActions({
  block, onComplete, onDrop, primary,
}: Pick<BlockProps, 'block' | 'onComplete' | 'onDrop'> & { primary: boolean }) {
  const [askingPartial, setAskingPartial] = useState(false);
  const [askingSkip, setAskingSkip] = useState(false);
  const [partialMinutes, setPartialMinutes] = useState(String(Math.round(block.minutes / 2)));

  if (askingSkip) {
    return (
      <div className="enter mt-3">
        <p className="text-sm">Skipping this one. Still need to do it?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => { onComplete('skipped', null); setAskingSkip(false); }}
            className={primary ? 'btn-primary' : 'btn-secondary'}
          >
            Find another time
          </button>
          <button
            onClick={() => { onDrop(); setAskingSkip(false); }}
            className="btn-secondary"
          >
            Drop it
          </button>
          <button onClick={() => setAskingSkip(false)} className="btn-quiet">
            Cancel
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Find another time keeps it in the queue, and it moves when you replan. Drop it stops it
          taking up your week.
        </p>
      </div>
    );
  }

  if (askingPartial) {
    return (
      <div className="enter mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          Minutes spent
          <input
            type="number"
            min={1}
            max={600}
            value={partialMinutes}
            onChange={(e) => setPartialMinutes(e.target.value)}
            className="field w-24"
          />
        </label>
        <button
          onClick={() => {
            const n = Number(partialMinutes);
            onComplete('partial', Number.isFinite(n) && n > 0 ? n : block.minutes);
            setAskingPartial(false);
          }}
          className="btn-secondary"
        >
          Log it
        </button>
        <button onClick={() => setAskingPartial(false)} className="btn-quiet">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        onClick={() => onComplete('done', block.minutes)}
        className={primary ? 'btn-primary' : 'btn-secondary'}
      >
        {/* The tick is for the one primary Done. In a row it costs the width
            that keeps all three answers on one line at 375px. */}
        {primary && <CheckIcon />}
        Done
      </button>
      <button onClick={() => setAskingPartial(true)} className="btn-quiet">
        Partly
      </button>
      <button onClick={() => setAskingSkip(true)} className="btn-quiet">
        Skipped
      </button>
    </div>
  );
}

/**
 * A block on its own.
 *
 * `label` is what the screen says about it ("Next · 3:00 PM, in 1h 20m");
 * without one the block's own time range is used.
 */
export function BlockCard({
  block, tz, colour, onComplete, onDrop, isPast, label, primary = false, as: Tag = 'div', tracked = false,
  className = '', style,
}: BlockProps & {
  className?: string;
  style?: React.CSSProperties;
  label?: React.ReactNode;
  /** This block's Done is the screen's one primary action. */
  primary?: boolean;
  as?: 'div' | 'section';
  /** Take part in the list's motion, so a block moving between here and a
      row travels rather than jumping. */
  tracked?: boolean;
}) {
  const settled = block.status !== 'planned';
  // A label from the screen already says whether the block is still open.
  const meta = metaParts(block, isPast, !label);

  return (
    <Tag
      data-block-id={tracked ? block.id : undefined}
      data-block-start={tracked ? block.start : undefined}
      className={`border-l-3 pl-4 ${isPast && !settled ? 'border-dashed' : ''} ${className}`}
      style={{ ...style, borderColor: isPast && !settled ? 'var(--border-strong)' : colour }}
    >
      <p className="text-sm">
        {label ?? (
          <span className="text-[var(--muted)]">
            {fmtTime(block.start, tz)} to {fmtTime(block.end, tz)} · {block.minutes} min
          </span>
        )}
      </p>
      <h2
        className={`mt-1 text-title font-semibold ${
          settled ? 'text-[var(--muted)] line-through decoration-[var(--border-strong)]' : ''
        }`}
      >
        {blockTitle(block)}
      </h2>
      {meta.length > 0 && (
        <p className="mt-1 text-sm text-[var(--muted)]">{meta.join(' · ')}</p>
      )}
      <p className="mt-2 max-w-prose text-base text-[var(--ink)]">{block.why}</p>

      {settled ? (
        <p className="mt-3 flex items-center gap-1 text-sm text-[var(--muted)]">
          {block.status === 'done' && <CheckIcon />}
          {settledText(block)}
        </p>
      ) : (
        <BlockActions block={block} onComplete={onComplete} onDrop={onDrop} primary={primary} />
      )}
    </Tag>
  );
}

/**
 * A block in a timeline.
 *
 * The time sits in a fixed column shared by every row, so the day reads down
 * one straight edge. The course colour is a thin rule beside the content
 * rather than a filled card: at list density a fill turns into a wall of
 * boxes, and the rule carries the same signal.
 */
export function BlockRow({
  block, tz, colour, onComplete, onDrop, isPast, stagger,
}: BlockProps & {
  /** Position in the first-visit entrance, or undefined for none. */
  stagger?: number;
}) {
  const settled = block.status !== 'planned';
  const openPast = isPast && !settled;
  const meta = metaParts(block, isPast);
  // Settling plays only for a block that was open when this row appeared,
  // which is to say one the student has just answered, never on page load.
  const [wasOpen] = useState(!settled);

  const enter = stagger !== undefined
    ? { className: 'enter', style: { '--i': stagger } as React.CSSProperties }
    : { className: '', style: undefined };

  if (settled) {
    return (
      <li
        data-block-id={block.id}
        data-block-start={block.start}
        className={`grid grid-cols-[4rem_1fr] gap-x-3 py-2 ${wasOpen ? 'settle' : ''} ${enter.className}`}
        style={enter.style}
      >
        <span className="text-sm leading-6 text-[var(--muted)]">{fmtTime(block.start, tz)}</span>
        <div
          className="flex min-w-0 items-baseline gap-3 border-l-3 pl-3"
          style={{ borderColor: `color-mix(in oklab, ${colour} 40%, transparent)` }}
        >
          <span className="min-w-0 flex-1 truncate text-base text-[var(--muted)] line-through decoration-[var(--border-strong)]">
            {blockTitle(block)}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--muted)]">
            {block.status === 'done' && <CheckIcon />}
            {settledText(block)}
          </span>
        </div>
      </li>
    );
  }

  return (
    <li
      data-block-id={block.id}
      data-block-start={block.start}
      className={`grid grid-cols-[4rem_1fr] gap-x-3 py-3 ${enter.className}`}
      style={enter.style}
    >
      <div className="text-sm leading-6">
        <div className="font-medium">{fmtTime(block.start, tz)}</div>
        <div className="text-[var(--muted)]">{block.minutes} min</div>
      </div>
      <div
        className={`min-w-0 border-l-3 pl-3 ${openPast ? 'border-dashed' : ''}`}
        style={{ borderColor: openPast ? 'var(--border-strong)' : colour }}
      >
        <p className="text-base font-medium">{blockTitle(block)}</p>
        {meta.length > 0 && <p className="text-sm text-[var(--muted)]">{meta.join(' · ')}</p>}
        <p className="mt-1 text-sm text-[var(--muted)]">{block.why}</p>
        <BlockActions block={block} onComplete={onComplete} onDrop={onDrop} primary={false} />
      </div>
    </li>
  );
}
