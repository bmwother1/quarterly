'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { ThemePicker } from '@/components/theme-provider';
import { Insights } from '@/components/insights';
import { BackupControls } from '@/components/backup-controls';
import { AccountPanel } from '@/components/account-panel';
import { deleteServerAccount } from '@/supabase/account';
import { DEFAULT_TZ } from '@/lib/time';

const TZ = DEFAULT_TZ;

/**
 * The things you touch once, kept away from the things you touch daily.
 *
 * Setup had grown to ten sections of prose, so the frequent actions were
 * competing with settings nobody changes twice. Splitting them costs a tap and
 * removes most of the reading.
 */
export default function Settings() {
  const { state, hydrated, updateAvailability, replaceAll, reset, reopenSetup } = useQuarterly(TZ);
  const [saved, setSaved] = useState<string | null>(null);

  function flash(text: string) {
    setSaved(text);
    setTimeout(() => setSaved((cur) => (cur === text ? null : cur)), 2200);
  }

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p className="text-[var(--muted)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Settings</h1>

      </header>

      <Section title="Account">
        <AccountPanel lastSyncedAt={state.lastSyncedAt} tz={TZ} />
      </Section>

      <Section title="Colours">
        <ThemePicker />
      </Section>

      <Section title="What your week says about you">
        <Insights
          blocks={state.blocks}
          availability={state.availability}
          tz={TZ}
          onAdoptPattern={(p) => {
            updateAvailability((prev) => ({ ...prev, energy: p }));
            flash('Updated from your own blocks');
          }}
        />
      </Section>

      <Section
        title="Backup"
        hint="Your schedule lives only in this browser. A backup is the only copy that survives clearing site data."
      >
        <BackupControls state={state} onImport={replaceAll} onMessage={flash} />
      </Section>

      {state.wentLiveAt && (
        <Section
          title="Go through setup again"
          hint="Your commitments, hours and plan all stay. This only reopens the questions."
        >
          <Link
            href="/onboarding"
            onClick={reopenSetup}
            className="inline-block rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-sm"
          >
            Redo setup
          </Link>
        </Section>
      )}

      <Section
        title="Delete everything"
        hint="Your week on this device, and your account and its copy on the server if you have one."
      >
        <button
          onClick={() => {
            if (!window.confirm(
              'Delete your account, your week and everything logged about how you used it? This cannot be undone.',
            )) return;

            // Server first, deliberately. If the local wipe went first and this
            // failed, the week would vanish and the server copy would remain,
            // and the student would have no reason to suspect it.
            void deleteServerAccount().then((result) => {
              if (!result.ok) {
                flash(result.message);
                return;
              }
              reset();
              flash(result.hadAccount ? 'Account and data deleted' : 'Everything deleted');
            });
          }}
          className="rounded-lg border border-[var(--warn)]/50 px-3.5 py-2 text-sm text-[var(--warn)]"
        >
          Delete my data
        </button>
      </Section>

      {saved && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-10 mx-auto w-fit rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)] shadow-lg"
        >
          {saved}
        </div>
      )}
    </main>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-sm text-[var(--muted)]">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}
