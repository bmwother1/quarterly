'use client';

import { useRef, useState } from 'react';
import type { HeronState } from '@/lib/store';
import { toBackup, backupFilename, fromBackup } from '@/lib/backup';

/**
 * Take a copy, or restore one.
 *
 * Downloading is a Blob and an anchor click rather than anything clever,
 * because the file has to arrive even on a phone browser that treats novel
 * download mechanisms with suspicion.
 */
export function BackupControls({
  state, onImport, onMessage,
}: {
  state: HeronState;
  onImport: (next: HeronState) => void;
  onMessage: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ state: HeronState; summary: string } | null>(null);

  function download() {
    const blob = new Blob([JSON.stringify(toBackup(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onMessage('Backup downloaded');
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const result = fromBackup(await file.text());
    if (!result.ok) {
      setError(result.error);
      setPending(null);
    } else {
      // Importing overwrites everything, so it gets a confirmation step rather
      // than happening the instant a file is chosen.
      setPending({ state: result.state, summary: result.summary });
    }
    e.target.value = '';
  }

  const counts = `${state.commitments.length} commitments · ${state.assignments.length} assignments · ${state.blocks.length} blocks`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">Currently holding {counts}.</p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={download}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)]"
        >
          Download a backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-sm"
        >
          Restore from a file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={pick}
          className="hidden"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--warn)]/40 bg-[var(--accent-soft)] p-3 text-sm text-[var(--warn)]">
          {error}
        </p>
      )}

      {pending && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          <p>{pending.summary}</p>
          <p className="mt-1 text-[var(--muted)]">
            Restoring replaces everything currently in this browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => { onImport(pending.state); setPending(null); onMessage('Backup restored'); }}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-ink)]"
            >
              Replace my data
            </button>
            <button
              onClick={() => setPending(null)}
              className="px-2 text-sm text-[var(--faint)] underline underline-offset-4"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
