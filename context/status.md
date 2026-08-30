# Status

**Updated: 2026-08-29** · 32 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (public). Live and current at
`quarterly-alpha.vercel.app`. Pushes to `main` auto-deploy in about 20 seconds,
confirmed working by watching a deploy land 27 seconds after a push. 276 tests.
Supabase project `dxvekspnhqrcwqbqxleh` (West US Oregon); keys are in
`.env.local` and in Vercel, along with `SUPABASE_SERVICE_ROLE_KEY` and
`CRON_SECRET`. Custom SMTP runs through Resend on the shared
`onboarding@resend.dev` sender, which only delivers to Brydon's own address.
Node lives at `~/.local/node` and is on Brydon's PATH but not in a fresh agent
shell — prefix `export PATH="$HOME/.local/node/bin:$PATH"`.

---

## Right now

The product is finished enough to hand to a student. Import any calendar, get a
planned week, check things off, replan when it falls apart. It installs to a
phone, works offline, and resolves conflicts on its own.

The data layer landed on 2026-08-23 and the interface caught up on 2026-08-26:
categories, a month view, a six-digit sign-in, and push notifications that can
reach a phone.

**Brydon has changed the plan.** No marketing until a full quarter of real use.
He intends to pay a group of friends weekly for feedback and run them through
autumn. That makes Sept 30 a private beta and moves the first honest retention
read to winter quarter. Interviews are parked at his instruction.

All three dashboard actions were done on 2026-08-27. `0002` ran, so account
deletion works and the privacy page is accurate again.
`SUPABASE_SERVICE_ROLE_KEY` was added in Vercel as a Secret and `0003` ran,
returning job id 1, so the notification cron is scheduled every ten minutes.
Custom SMTP went in the same night, through Resend, and **sign-in was run end to
end for the first time: Brydon received a code and signed in.** Nothing is
blocked on a dashboard action any more.

The notification chain was then fixed end to end and **returns 200**: the cron
fires, the app authenticates, and the sender reads its tables. It took three
fixes, each hidden behind the one before it. The Vault secret did not match
`CRON_SECRET` (401), and then `service_role` had no grant on the tables it
reads, because `0001` granted only to `authenticated` (500). `0004` adds those
grants.

**Nothing has been delivered yet.** The endpoint reports `subscriptions: 0`,
because the Settings toggle was subscribing into a broken pipeline for as long
as it has existed and nobody has turned it on since. One phone needs to enable
it before delivery is real.

**Retention is measurable, not measured**, and now also unmeasurable by design
until the paid-tester question is resolved: paying people to open the app buys
the number rather than reading it. Tagging the cohort at signup is one column
and has not been done.

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

## In progress, not finished

- **Three doors into configuration.** `/start`, `/onboarding` and `/setup` all
  configure the same state. `/start` is the default and `/onboarding` is the
  guided alternative; `/setup` is now only reachable from the nav and from
  individual setup prompts. Two of the three should survive to launch and it is
  undecided which. **This one needs Brydon**, it is a product call.
- **The name, reopened and parked again on 2026-08-29.** Heron was chosen on a
  collision-first search and is still the standing recommendation; see
  `decisions.md` for what was checked and why Cusp, Cairn, Pika, Bower, Nuthatch
  and Tortoise all lost. Brydon wants to keep thinking, so nothing is bought and
  nothing is renamed.

  **The deadline on this is Sept 30, not the launch date in general.** Renaming
  is free today because nothing is branded and nobody has installed anything. It
  stops being free the moment friends onboard, because the name is then on their
  home screens and in every sign-in email, and changing it mid-beta puts a
  rebrand in front of the only users there are, while retention is being read.

## Next, in order

1. **Get one notification onto a real phone.** The pipeline returns 200 with
   zero subscriptions; enabling the toggle on one device is the last unproven
   step. `select status_code from net._http_response order by created desc` is
   the check that matters, because `cron.job_run_details` says `succeeded` even
   when the app rejects the call.
2. **Confirm the sync loop by hand.** The drag is done; the conflict path
   still has not been exercised on two real devices.
3. **Syllabus parsing, or cut the claim.** The competitive table says Quarterly
   knows what to study and it does not. Decide by Sept 1 rather than carrying an
   untrue claim into recruiting.
4. **Stop using warning colour for a bad week.** A past unanswered block gets a
   `--warn` border at 45% and the lapse banner is warn-coloured throughout. The
   product's position is that falling behind is survivable and the palette
   currently disagrees with the copy. An hour of token work.
5. **What a phone shows instead of a seven-day grid.** The week renders 14
   columns at 88px and a student sees three. Either the phone goes day-first
   with the grid on larger screens, or each day becomes a density bar rather
   than a readable column. **This one needs Brydon**, it is a product call.
   Measurements and the rest of the design read are in the 29 Aug artifact,
   "Quarterly at arm's length".

## Blocked on Brydon

- **Register `heron.study`, then verify it in Resend.** The
  shared `onboarding@resend.dev` only delivers to Brydon's own address, so no
  student can sign in until a real domain is verified. The name is no longer
  what blocks this.
- **Confirm the sync loop** on two devices. The drag is confirmed.
- **A decision on the three doors** into configuration.
- **What the phone shows instead of a seven-day grid.** See Next, item 5.
- **The name.** Heron is the standing recommendation and Brydon is still
  thinking. Free to change until students onboard on Sept 30.
- **Whether paid testers are tagged separately.** Paying people to open the app
  measures the payment, not the product, so they must not pollute the retention
  cohort.
- **Deployment Protection** is still on, set to
  `all_except_custom_domains`. That means it never affected students and never
  will: `quarterly-alpha.vercel.app` is public today and a custom domain will be
  too. It only walls off raw deploy URLs from Brydon himself. Worth switching
  off to stop wasting his own time, but it is not a launch item. Leave
  `gitForkProtection` on, since it stops a forked PR building with the Supabase
  keys once those exist.

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

## The plan to September 30

Sequencing note: **push notifications need a server-side subscription store and
a scheduled job, so Supabase comes first** even though notifications are the
higher-value feature.

### Aug 24 → Aug 30 · the week the interviews have to happen
- The data layer shipped a week early, on Aug 23. That bought this week back.
- **Spend it on students, not code.** Twelve interviews by Sept 6, eight with
  people who have no social reason to be nice about it.
- Use it daily, with the real schedule. Still the closest proxy for retention.
- Learned energy pattern. Shipped Aug 27.

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
