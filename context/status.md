# Status

**Updated: 2026-08-21** · 40 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (public). Live and current at
`quarterly-alpha.vercel.app`. Pushes to `main` auto-deploy in about 20 seconds.
181 tests. Node lives at `~/.local/node` and is on Brydon's PATH but not in a
fresh agent shell — prefix `export PATH="$HOME/.local/node/bin:$PATH"`.

---

## Right now

The product is finished enough to hand to a student. Import any calendar, get a
planned week, check things off, replan when it falls apart. It installs to a
phone, works offline, and resolves conflicts on its own.

Two things remain untrue, and both outrank everything on the shipped list:

1. **Nobody has used it but Brydon.** One interview, logged as zero signal.
2. **Nothing measures retention**, which is the number that decides the project.

## Shipped

- **Scheduling engine** — scoring function, free-time discovery, constraint-aware
  placement, generated per-block reasons, honest reporting of what didn't fit.
  ~21ms for a full quarter, deterministic, no LLM in the path
- **Calendar import** — one paste box at `/import` for Canvas, Google, Apple and
  Outlook, with recurrence expansion. Canvas produces assignments to schedule;
  every other source produces fixed events to schedule around
- **Recurring commitments** — weekly quotas with no deadline, which is what makes
  the app usable outside a quarter
- **Two-question first run** at `/start` — two taps, three seconds, ten blocks
- **Interface** — landing, import, setup, week grid, day view with a validated
  colourblind-safe palette, check-off, explicit replan, drag-to-move with
  pinning, one-off events, undo, themes, offline, installable
- **Conflict resolution** — an event dropped on planned work moves the work,
  says what it moved, and never touches finished blocks
- **Notification engine** — decision logic and copy written and tested, with a
  banned-phrase list enforcing tone. Delivery is the only missing half
- **Privacy page** written against the code, with a working delete control
- **Backup** — export and import JSON, since there is no server copy

## In progress, not finished

- **Onboarding completion model** (`src/lib/onboarding.ts`, committed as WIP).
  Module, hook, store changes and 11 tests exist; **no page imports any of it**,
  so it currently does nothing. To land: render `OnboardingShell`, replace the
  `noFixedTime` banner on `/week` with it, confirm the resolved state survives a
  reload.

## Next, in order

1. **Nineteen more interviews.** Nothing else on this list matters as much.
2. **Use it for a full week.** The closest available proxy for retention.
3. **Supabase** — sync, retention measurement, and notification delivery all
   depend on it. Migration written and waiting at
   `supabase/migrations/0001_init.sql`; client libraries installed.
4. **Finish the onboarding model** above.
5. **Syllabus parsing** — the one job an LLM genuinely belongs in.
6. Tailwind oddity: `max-w-*` utilities produced no CSS, so the calendar width
   is set inline. It will bite again on a class that matters more.

## Blocked on Brydon

- **Supabase project** — send the project URL and the *anon* key. Never the
  service_role key. Five minutes, unblocks three features.
- **The interviews.** Ask what they did last Sunday. Don't show the product.
- **Deployment Protection** is still on, so `*-bmwother1s-projects.vercel.app`
  redirects to a Vercel login. `quarterly-alpha.vercel.app` is unaffected and is
  the one to share, but turn it off to avoid confusing yourself later.

## Owed to Brydon

- **A business-side action plan** — what to do, how, and why, covering the
  nineteen interviews, a distribution plan for thirty students, a real domain,
  the Dempsey application, and the undecided revenue model. Asked for on
  2026-08-21 and not delivered before the session ended. **Start here.**

## Struck from the plan

- **Google Calendar two-way sync.** `calendar.events` is a sensitive scope whose
  verification runs five-plus weeks, and writing back via a subscription feed is
  worse than nothing because Google refreshes those every 12–24 hours. Reading
  any calendar in via its ICS link shipped instead and covers most of the value.

## Open questions

- Does anyone outside this project describe the 9pm decision problem unprompted?
- Would a student who connected in week 0 and saw an empty feed come back?
- What is the business model? Free for students is an acquisition strategy, not
  a revenue plan, and nothing has been decided.

---

## The plan to September 30

Sequencing note: **push notifications need a server-side subscription store and
a scheduled job, so Supabase comes first** even though notifications are the
higher-value feature.

### Now → Aug 23 · prove it survives a real week
- Use it daily, with the real schedule.
- Five interviews. Past behaviour only, product not shown.

### Aug 24 → Aug 30 · the data layer
- Supabase: accounts, sync, and the first thing that measures retention.
- Learned energy pattern: replace the declared dropdown with observed completion
  rate by hour. The data is already being collected and read.
- Ten more interviews. Fifteen total by month end.

### Aug 31 → Sept 13 · the retention features
- Push notifications. One a day, always carrying the block's reason.
- Syllabus parsing, so a block names the topic rather than just the course.

### Sept 14 → Sept 22 · feature freeze
- Onboarding, empty states and bugs only. Anything added inside two weeks of
  launch ships without a real student having touched it.

### Sept 23 → Sept 30 · recruit
- Thirty students before instruction begins.
- Brydon is Sponsorship Lead of a 51-person solar vehicle team. That is more
  people than the target, in one room, with authority already established.

### The one number that decides everything
Week-4 retention from Sept 30. Under 25% and nothing else matters. Over 40% and
there is something real. Nothing measures it until Supabase ships.
