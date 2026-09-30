'use client';

import Link from 'next/link';
import { mapUrl, type ClassEntry } from '@/lib/classes';
import { colorVar } from '@/lib/categories';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function clock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const link = 'text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]';

/** A class from Setup, tapped on the calendar: when, where, and a way to change it. */
export function ClassCard({ entry, onRemove }: { entry: ClassEntry; onRemove: () => void }) {
  return (
    <div className="border-l-3 pl-4" style={{ borderColor: colorVar('class', 0) }}>
      <p className="text-sm text-[var(--muted)]">
        {entry.days.map((d) => DAYS[d]).join(', ')} · {clock(entry.startMin)} to {clock(entry.endMin)} · every week
      </p>
      <h2 className="mt-1 text-title font-semibold">{entry.label}</h2>
      {entry.location ? (
        <p className="mt-1 text-base">
          {entry.location}
          {' · '}
          <a href={mapUrl(entry.location)} target="_blank" rel="noreferrer" className={link}>
            Map
          </a>
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">No room yet. Add the building and room in Edit.</p>
      )}
      <p className="mt-1 text-sm text-[var(--muted)]">Fixed, so nothing gets scheduled over it.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/setup?class=${encodeURIComponent(entry.group)}`} className="btn-secondary">
          Edit
        </Link>
        <button onClick={onRemove} className="btn-danger">
          Remove
        </button>
      </div>
    </div>
  );
}
