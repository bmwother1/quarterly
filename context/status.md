# Status

**Updated: 2026-10-02** · two days into the private beta

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (public). Live at **`heron.study`** (Vercel, DNS on
Vercel's nameservers; `quarterly-alpha.vercel.app` 307s to it). Pushes to `main`
deploy in about 20 seconds. 406 tests, passing under TZ=UTC, Pacific and Tokyo.
Supabase project `dxvekspnhqrcwqbqxleh`. Sign-in codes come from
`signin@heron.study` through Resend and reach any address. Node lives at
`~/.local/node`; prefix `export PATH="$HOME/.local/node/bin:$PATH"` in a fresh
agent shell.

---

## Right now

The private beta is live and Brydon is its first daily user, on phone and
laptop. The UI was rebuilt from an approved canvas prototype
(https://claude.ai/artifact/UebdtiScxuNFoDJCBW4FKH): Today leads the Week page
(now-card, day timeline, Coming up, overview sidebar with this week's
assignments and goals), views are Day / Week / 2 weeks / Month, and the landing
page leads with a live demo of a week filling in.

**Planner rules are still frozen until Oct 14** (one hour per assignment, five-
day lead window). On Oct 14, decide block sizing from his Done/Partly history.

Sync now picks a winner (first sign-in takes the account; newer wins after) and
re-checks every minute; **not yet confirmed on his two devices**. Drop it,
Find another time and the popover were fixed on Oct 1 to 2 after he hit them.

Class meeting times are not in Canvas for most courses; students type them into
Setup, Classes, or import MyUW's file if it has one.

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
- **Privacy page** rewritten 2026-08-24 against the code, covering what a
  signed-in student's data actually is. Its delete control is real but currently
  fails, see above
- **Backup** — export and import JSON, and now a server copy as well
- **Accounts** — a six-digit code, no passwords, no links. Optional throughout:
  signed out is a supported state everywhere and the no-account product is
  unchanged. Confirmed working end to end on 2026-08-27
- **Sync** — the plan mirrors to `plan_state` on change, debounced. When both
  copies changed since they were last level it reports a conflict and does
  nothing, because there is no merge and any automatic choice eats a week
- **Telemetry** — `opened`, `planned`, `block_done`, `block_skipped`,
  `block_moved`, `feed_synced`. Counts and durations only, never titles or
  course names. Append-only by grant: the client cannot update or delete
- **Onboarding with an ending** — `/onboarding` is a five-step guided flow, and
  the app now knows when a student is finished. One prompt at a time, every one
  answerable in both directions, and once `wentLiveAt` is stamped setup prompts
  never return. The account step is real and deliberately last
- **Categories** — six of them owning hue families, with shades inside for
  individual courses. Nothing stores a hex; rendering resolves a CSS variable.
  `npm run palette` validates the whole thing under three colour vision
  deficiencies in both modes, with an exit code
- **Month view** — one bar per day, weighted by minutes rather than event count,
  coloured by the day's dominant category, tapping through to the day view
- **A welcome carousel** at `/welcome`, showing a week repairing itself, because
  people hearing the pitch kept asking whether Outlook already did this
- **Calendar file import** — `.ics` parsed in the browser and never uploaded,
  because the link route means publishing an Apple calendar publicly
- **Push notifications** — permission, subscription, service-worker handlers, a
  Settings toggle that detects the iOS home-screen requirement, and a sender
  that runs the same engine the app uses. The key and the cron are both in
  place as of 2026-08-27; a successful run has not been observed yet
- **Account deletion** — a `security definer` function so a student can remove
  their auth row and cascade everything. `0002` run 2026-08-27 and verified:
  `prosecdef` true, so the function runs with owner rights as intended
- **A bad week is no longer an error state** — a past unanswered block is dashed
  and neutral rather than warn-bordered, and the lapse banner uses the same calm
  container as the away notice instead of a warn heading counting blocks that
  "passed without an answer". `--warn` is now reserved for real errors and
  destructive actions
- **A line across today** — one accent pixel with a dot, on today's column only,
  ticking once a minute. Hidden when the clock falls outside the drawn range, and
  `pointer-events-none` so it cannot swallow a tap or interrupt a drag
- **The replan is watched, not announced** — blocks travel to their new slots at
  560ms with a 24ms stagger instead of teleporting while a banner explains what
  moved. FLIP rather than a CSS transition, because a block moving day unmounts
  from one column and mounts in another. See `learned.md` for why the first
  version passed 276 tests while animating nothing
- **Drag-to-move** — cross-day drags and drops onto occupied slots both work and
  blocks push each other aside. Confirmed by thumb on 2026-08-27, which is the
  only way it can be confirmed: synthetic pointer events never enter the drag
  state
- **Learned energy pattern** — the scheduler plans against observed completion
  rate by hour rather than the setup dropdown, but only with 24+ settled blocks,
  evidence that separates, and disagreement with what the student said. A stated
  preference locks it. Insights leads with the switch and offers a refusal
- **The returning-student experience** — shipped 2026-08-24. `absence()` tells a
  lapse from an away: two days or fewer still asks for answers, longer says
  "Welcome back", offers "Plan from today", and releases the unanswered blocks
  as skipped rather than making the student itemise last Tuesday

## Blocked on Brydon

- **Notifications have never been seen arriving on a phone.** Install from the
  home screen, sign in, Settings, turn them on, then wait for a "Next up" 15
  minutes before a block. Reminders ("Final Reminder…" items) now arrive this
  way too, at 9am on their due day, so this is load-bearing.
- **Two-device sync, rebuilt 2026-10-02, still unconfirmed.** Sign in on both,
  close and reopen the phone; then tap Done on one and watch the other within a
  minute. Replan once to restore runs the old Drop it bug deleted.
- **Two-device sync has never been confirmed (older note).** Plan on the laptop, open the
  phone. Calendar links should appear in Settings on both. 0005 ran; confirm
  `FEED_LINK_KEY` was saved with a fresh value (the first one was shown in a
  screenshot) and the deployment redeployed after it.
- **Fix his MGMT 305A class time** in Setup (typed as 10:30 to 12:50; MyUW says
  roughly 10:30 to 11:20). The form now warns about the overlap with EE 454A.
- **Paid testers: tag them before they sign up**, so the retention cohort is
  not measuring the payment.
- **Move the repo off the iCloud Desktop.**
- **Three doors into configuration** (`/start`, `/onboarding`, `/setup`): a
  product call, still open.

## Known, not yet fixed

- Sweep open items 2 (a commitment window too short for one session is
  reported as "the week ran out") and 3 (sessions run in order). Items 4 and 5
  were fixed on 2026-09-30.
- `npm run refresh`: "the moved deadline kept its minutes" now passes vacuously
  (0 minutes); rebuild the scenario when refresh code next changes.
- A downloaded Canvas file imported as events has no refresh; only the link
  refreshes.
- Is the UW campus map link (`washington.edu/maps/?l=CODE`) actually opening
  on the building? Unverified.
- Deployment Protection is on for raw deploy URLs only; not a launch item.

## Owed to Brydon

- **The business plan is gone.** It was written on 2026-08-22 covering the
  interviews, distribution, the domain, Dempsey and the revenue model, delivered
  as a file, and never filed into `context/`. The scratchpad holding it has since
  been cleared, so the only copy is in that conversation. Worth rewriting rather
  than recovering: interviews are now parked, the tester plan has changed to paid
  friends through autumn, and the name is being replaced, so most of its
  distribution section is out of date anyway.
- **One correction it contained**, since it affects a date elsewhere: the Dempsey
  application does not go in over winter break. It opens late February and closes
  in early April, with four rounds after that.

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

## The next two weeks (Oct 1 to Oct 14)

1. **Brydon uses it daily** on his real week and answers every block. No
   planner rule changes; bugs only.
2. **Prove the unproven**: a notification on his phone, sync across two
   devices, and the first paid testers signed up and tagged.
3. **Oct 14: decide block sizing** from his Done/Partly history.
4. **Then class times**: whether MyUW offers a calendar export, or Setup stays
   the way in.
