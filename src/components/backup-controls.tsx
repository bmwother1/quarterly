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
        <button onClick={download} className="btn-secondary">
          Download a backup
        </button>
        <button onClick={() => fileRef.current?.click()} className="btn-secondary">
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
        <p role="alert" className="border-l-3 border-[var(--warn)] pl-3 text-sm text-[var(--warn)]">
          {error}
        </p>
      )}

      {pending && (
        <div className="enter rounded-md border border-[var(--border)] p-4 text-sm">
          <p>{pending.summary}</p>
          <p className="mt-1 text-[var(--muted)]">
            Restoring replaces everything currently in this browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Danger, not primary: this overwrites everything on the device. */}
            <button
              onClick={() => { onImport(pending.state); setPending(null); onMessage('Backup restored'); }}
              className="btn-danger"
            >
              Replace my data
            </button>
            <button onClick={() => setPending(null)} className="btn-quiet">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
