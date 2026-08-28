# Status

**Updated: 2026-08-27** · 34 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (public). Live and current at
`quarterly-alpha.vercel.app`. Pushes to `main` auto-deploy in about 20 seconds,
confirmed working by watching a deploy land 27 seconds after a push. 276 tests.
Supabase project `dxvekspnhqrcwqbqxleh` (West US Oregon); keys are in
`.env.local` and in all three Vercel environments. Node lives at `~/.local/node` and is on Brydon's PATH but not in a
fresh agent shell — prefix `export PATH="$HOME/.local/node/bin:$PATH"`.

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
**Delivery is scheduled, not yet observed:** nobody has read
`cron.job_run_details` to confirm a run succeeded, and no notification has
arrived on a real phone.

One thing is still blocked on a dashboard action:

1. **Sign-in cannot complete.** No custom SMTP, so the template still sends a
   link with no code in it, and Supabase will not let the template be edited
   until SMTP exists.

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
  unchanged. Untestable until SMTP exists
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
- **Drag-to-move, unverified.** Cross-day drags and drops onto occupied slots
  were both broken and are both fixed, and blocks now push each other aside.
  Synthetic pointer events do not enter the drag state at all, so **this needs a
  real thumb before it can be called working.** Third time this feature has
  broken without a test noticing.
- **The name.** `Quarterly` encodes the quarter system and the product is now a
  general scheduler, which Brydon's own `product.md` said in August. A long
  stretch on 2026-08-26 produced no decision: Slate collides with Technolutions,
  which 2,000 universities use for admissions and retention, and Tessel collides
  with a live TESSELL software trademark. Nothing is branded, so the cost of
  changing is still near zero.

## Next, in order

1. **Confirm a cron run succeeded**, then get one notification onto a real
   phone. `cron.job_run_details` is the first check; a `failed` row most likely
   means the Vault secret and `CRON_SECRET` in Vercel disagree.
2. **Custom SMTP**, which also unblocks testing the sign-in code. Resend sends
   to the account owner's own address with no domain, which is enough to verify
   the flow today.
3. **Confirm the drag by hand**, and the sync loop while there.
4. **Syllabus parsing, or cut the claim.** The competitive table says Quarterly
   knows what to study and it does not. Decide by Sept 1 rather than carrying an
   untrue claim into recruiting.

## Blocked on Brydon

- **Custom SMTP**, before students exist rather than after.
- **Confirm the drag on a real pointer**, and the sync loop.
- **The name, then the domain.** Both still open, and the domain choice depends
  on the name.
- **A decision on the three doors** into configuration.
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
