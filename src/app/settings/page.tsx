'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useHeron } from '@/hooks/use-heron';
import { ThemePicker } from '@/components/theme-provider';
import { Insights } from '@/components/insights';
import { BackupControls } from '@/components/backup-controls';
import { AccountPanel } from '@/components/account-panel';
import { NotificationToggle } from '@/components/notification-toggle';
import { Toast } from '@/components/toast';
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
  const { state, hydrated, updateAvailability, replaceAll, reset, reopenSetup } = useHeron(TZ);
  const [saved, setSaved] = useState<string | null>(null);

  function flash(text: string) {
    setSaved(text);
    setTimeout(() => setSaved((cur) => (cur === text ? null : cur)), 2200);
  }

  if (!hydrated) {
    return <main className="mx-auto min-h-[60vh] max-w-2xl px-5 pt-8 sm:pt-12" aria-busy="true" />;
  }

  return (
    <main className="rise mx-auto max-w-2xl px-5 pb-12 pt-8 sm:pt-12">
      <h1 className="text-heading font-semibold">Settings</h1>

      <Section title="Account">
        <AccountPanel lastSyncedAt={state.lastSyncedAt} tz={TZ} />
      </Section>

      <Section title="Notifications">
        <NotificationToggle />
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
            // Either button here is the student answering deliberately, so both
            // lock it. Adopting means they agree; refusing means they have been
            // shown the evidence and chosen anyway, and the app should stop
            // arguing with them.
            const refusing = p === state.availability.energy;
            updateAvailability((prev) => ({ ...prev, energy: p, energyLocked: true }));
            flash(refusing ? 'Keeping what you chose' : 'Updated from your own blocks');
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
          <Link href="/onboarding" onClick={reopenSetup} className="btn-secondary">
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
          className="btn-danger"
        >
          Delete my data
        </button>
      </Section>

      <Toast message={saved} />
    </main>
  );
}

/** A setting, set apart from the one above it by a rule and space, not a box. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
