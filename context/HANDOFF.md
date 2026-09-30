# Heron — project brief

*Generated 2026-09-30 from the project's `context/` files by `npm run handoff`.
Don't edit this by hand; edit the source files and regenerate.*

This is the standing context for Heron. It covers the person building it,
what's being built, where it stands, and what has already been decided — so a
conversation can start from here instead of from scratch.


---

# Who you're working with

Sourced from his own CLAUDE.md (2026-08-18). Accurate, not inferred.

## Who

Electrical & Computer Engineering senior at UW, class of 2027, based in Kenmore
WA. Focus: embedded systems, hardware design, computer architecture. Builds end
to end and doesn't consider a prototype finished until it runs on real hardware
with a real interface.

FE Electrical & Computer exam October 2026. Sponsorship Lead for the UW Solar
Vehicle Team (51 people). Deep golf domain knowledge from three years in a pro
shop. DJs and runs an FPV/aerial YouTube channel.

## Technical background

**Languages:** Python, JavaScript/TypeScript, Verilog, Java, C/C++ (Arduino,
embedded)

**Web stack he already ships:** Next.js, TypeScript, Supabase (Postgres, RLS,
storage), Tailwind, shadcn/ui, Vercel, FastAPI, React

**Hardware:** KiCad, Quartus, ModelSim, Fusion 360, Raspberry Pi 5, Arduino,
systemd, SQLite, sensor integration, FPV builds

**Also:** SQL migrations, REST integration, Anthropic API

### What this means for Quarterly

He is not learning this stack. He is currently running SQL migrations against
Supabase for another Next.js/TypeScript/Vercel product (Prismwave Network, a
verification-led professional network built for his mother's HR/biotech
consultancy).

So: skip explanations of React, Next, Tailwind, Supabase, deployment, and Git.
Explain the parts specific to *this* project, the scheduler's design, and
anything genuinely non-obvious. shadcn/ui is a safe default for UI here since he
already uses it.

Prior work worth knowing: a Kalshi weather bot on a Pi via systemd (killed after
forward testing found no edge, which is the right instinct), a World Cup bracket
coherence engine, and a DIY golf launch monitor using Doppler radar with a
FastAPI backend and React dashboard.

## How to work with him

His own rules, verbatim in substance:

- Give a direct recommendation, not a list of options. If there are tradeoffs,
  pick one and say why.
- Concrete next steps over extended planning. Give the command to run.
- Be concise. Skip preamble. Skip summaries of what you just did.
- **No em dashes.** No AI filler ("delve", "it's worth noting", "let's dive in").
- If what he's asking for is a bad idea, say so before writing the code.
- Assume he can read code. Explain the non-obvious parts, not the syntax.

Two things confirmed in practice: he pushed back correctly on a padded week-1
estimate (installing Node took three minutes, not a week), and he has taken
every piece of bad news and acted on it. Don't soften findings.

## Context that shapes decisions

Solo, AI-assisted, launching September 30 2026. Budget $500 to $5,000 for six
months. Two other active projects competing for the same hours, so scope
discipline matters more than architecture.

---

# The product

A scheduler for students that plans around the life they actually have. Free.
UW first.

**The positioning shifted on 2026-08-18 and it matters.** This started as a study
planner driven by Canvas. Building the off-season case — recurring commitments
with no deadline — showed that the engine never cared where work came from.
Canvas is one input, not the product. That change does three things: it makes the
app useful in the eight months a year that aren't midterms, it removes the
seasonality problem that would otherwise make every summer a dead zone, and it
widens the addressable user from "student with heavy coursework" to "student with
a job, a sport, and a side project", which is most of them.

## The problem, stated precisely

It is not "students are disorganised." It's narrower, and the narrowness is the
whole product:

> A student sits down at 9pm knowing they have work to do, and spends the first
> twenty minutes deciding *what* to work on. They pick whatever is due soonest,
> which is rarely what matters most.

That's the "9pm decision problem." Everything in the product exists to answer it
before the student has to.

The secondary failure is estimation — students routinely underestimate how long
work takes by a factor of two, so even a good plan collapses by Wednesday.

## What it does

1. Reads Canvas deadlines from the student's own calendar feed URL
2. Learns their real week — classes, sleep, work shifts, commitments
3. Lays out study blocks with a specific task, a duration, a method, and a
   one-line reason each block is there
4. Rebuilds the week when they fall behind, which is the differentiating feature

## What actually differentiates it

Four things, in the order they'd convince a sceptical user:

1. **It plans hours, not lists.** Almost everything else tells you what's due.
   This works out when each piece happens, in sessions long enough to be worth
   sitting down for, around time already spent.
2. **Every block explains itself.** The reason is generated from whichever
   scoring term actually dominated, so it's a real account of the ranking rather
   than decoration. A student who can't see why a block exists won't do it.
3. **It refuses to lie about capacity.** Work that doesn't fit comes back with a
   reason while there's still time to act. Every competitor quietly overbooks and
   lets Thursday deliver the news.
4. **It reschedules on demand, not silently.** Silent reshuffling is why planners
   become fiction: nothing ever feels missed and the app always says you're fine.

## Why it can work

Twelve competitors were reviewed. The pattern is that nobody fills the whole row:

| | Knows deadlines | Reschedules | Knows *what* to study |
|---|---|---|---|
| Planners (Notion, MyStudyLife, Todoist) | yes | no | no |
| AI calendars (Motion, Reclaim) | no | yes | no |
| Study tools (Anki, Quizlet) | no | no | yes |
| Shovel | yes | partly | no |
| **Cram Fighter** | **yes** | **yes** | **yes** |

Cram Fighter fills every column — for two medical board exams, for money. That's
the strongest validation available and the clearest statement of what's open:
nobody does it for a normal undergraduate quarter, free.

Shovel is the closest real competitor. Mature, genuinely good, $39/year, and
already connects via the Canvas feed. The wedge against it is rescheduling and
topic-level planning, not deadline tracking.

## The honest caveats

**Don't market grade improvements.** The evidence for spaced retrieval in actual
classrooms is about a 2 percentage point effect across nine intro STEM courses,
with only two significant on their own. Laboratory effects are dramatic;
classroom effects are modest. University students will catch overclaiming faster
than any other audience, and getting caught once is fatal on a campus.

**Don't scrape Canvas.** It violates Instructure's terms, means handling
students' university credentials, and would get the project blocked by UW-IT and
remembered badly by the administration this eventually needs to sell to. The
public calendar feed carries what's needed and requires no approval at all.

## The metric that decides everything

**Week-4 retention.** Not signups. Planner apps get downloaded in week-1
optimism and abandoned by week 4. Under 25% and nothing else matters; over 40%
and there's something real here.

## Constraints

- **Launch: September 30 2026**, the first day of UW autumn quarter. 30 onboarded
  students before instruction begins.
- **Budget: $500–$5,000** for six months. Realistic spend is $1,500–$2,500.
- **One person**, AI-assisted. Every feature cut is a week returned.
- Free money worth chasing: GitHub Student Pack, cloud education credits,
  Anthropic/OpenAI startup credits, and UW's Dempsey Startup Competition
  ($92,500 awarded in 2026, $25,000 grand prize).

## Scale, for reference

UW has roughly 60,000 students across three campuses. The campus-density thesis
is that 40+ students in a single large course is worth more than 400 scattered
across a hundred courses, because shared topic maps and word of mouth both
compound within a course.

---

# Where things stand

**Updated: 2026-09-30** · launch day (private beta)

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

Launch day, and Brydon used it on his own real week for the first time. The
product works mechanically: Canvas imports, classes and weekly commitments are
respected, nothing overlaps, the plan is deterministic, tapping anything opens
its card beside it, and a class shows its room with a campus map link.

**It is not yet delivering its promise.** On his real week, 6 of 46.5 planned
hours were coursework; the rest was what he typed himself. That is mostly the
two planner rules set today: **one hour per assignment** (Done finishes it,
Partly books a follow-up) and **a block lands in the five days before its
deadline**. Both made the screen legible; together they switched off most of the
planner's judgement about how much time things need. See decisions.md,
2026-09-30.

**The rule for the next two weeks: the planner rules are frozen.** Brydon uses
it daily and answers Done, Partly or Skipped. Then one question is decided on
his data: is one hour enough, or should blocks be sized from the estimate again
(one a day, capped at two hours)? Repeated Partly on the same items says the
latter.

Class meeting times are not in Canvas for most courses; they are in MyUW. Until
that is solved, students type classes into Setup, Classes.

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

---

# Recent sessions

## 2026-09-30 · Claude Code · Launch week on a real schedule: DNS, link sync, and a planner reshaped by one screen

Spanned Sept 23 to launch day. Sign-in from `heron.study` now works for anyone
(Resend records were already in Vercel DNS; the missing step was the SMTP
sender). Calendar links sync to the account, AES-GCM encrypted with the key in
Vercel only. Then Brydon used it on his real UW week for the first time and it
fell apart visibly: taps did nothing (pointer capture swallowed the click, and on
touch the trailing click closed the card again), "Final Reminder" items were
read as exams with eight sessions, every course was red, a daily-items course
filled every gap with slivers, and classes were not in Canvas at all. Each was
fixed and shipped the same day, tested in a real browser.

**What went badly:** four planner rule changes on launch day, each a reaction to
how one screen looked. One hour per assignment and a five-day lead window made
the week legible and left 6 of 46.5 hours as coursework; the planner is now
mostly a display of what the student typed. Stopped there: rules frozen for two
weeks while Brydon uses it, then decide block sizing on his data.

## 2026-09-23 · Claude Code · The sweep, and nine promises no test was checking

An unattended overnight run on `claude/practical-cori-81ddb0`. Built
`npm run sweep`, which drives seeded simulated students through the app's own
replan path and checks every plan against the planner's promises, then fixed
what it found. Nothing pushed.

**Read this before merging the feed branch.** A plain `git merge` with
`elastic-hertz-fef8da` produces no conflict and a planner that charges
`fitNewWork`'s blocks against the ceiling twice: tonight's charging is
unconditional and theirs still runs behind `chargeExistingToCap`. Their 349
tests, tonight's, and every `npm run refresh` check all pass with the double
charge, because it only makes the plan emptier. On merge, delete the option, its
default and the `if (opts.chargeExistingToCap)` loop in `plan.ts`, and the
`chargeExistingToCap: true` line in `fit-new.ts`. Done that way in a scratch
copy: 364 tests pass, typecheck is clean, and `refresh` prints byte-identically
to their version.

**What ran.** Seed 1, 5,000 scenarios, 29,647 plans in 293s; seeds 2 to 5 at
1,500 to 3,000 while fixing. Promises: (a) no day over its ceiling, (b) nothing
on a kept block, event, busy block or outside the day, (c) nothing past its
deadline or over the work left, (d) no session under 25 minutes, (e) commitment
quota, daily limit and window, (f) deterministic with input untouched, (h) under
100ms, (i) unique ids, (j) reasons that read as English. Every fix below had a
failing test first, then `npm run check`, and the three week scripts came out
identical to the commit before it every time.

| Found | How often | Reduced to | Fix |
|---|---|---|---|
| A moved block and the new session in its old hour share an id, so ticking one marks both | 2,792 in 1,893 plans | 1 commitment, 1 pinned block | `157e49f` |
| Weekly quota ignores pinned sessions, and the tally is wiped by the week's first replan | 775 in 1,893 | 1 commitment, 1 pinned block | `2eb0d85` |
| A daily limit above one was never enforced | 245 in 1,893 | 1 commitment | `a0d475a` |
| A pinned coursework session is planned again on top of itself | 614 in 1,885 | 1 assignment, 1 pinned block | `46cc632` |
| Work due exactly now is planned after its deadline | 25 in 32,643 | 1 assignment | `81e3143` |
| "due in 1 hours"; the Sunday push said "About 1 hours" and "About 0 hours" | reading output | | `05a0ab6`, `a70d90c` |
| "you haven't touched MATH 124 in 0 days" | 715 in 400 scenarios | 1 assignment | `b7008af` |
| A window starting off the hour (4:15) can never be used | ~80% of warnings | 1 commitment | `6c9ec14` |
| The Sunday quota push trusted the wiped tally | follows from the quota fix | | `fe4dba7` |

Also: the planner is 8.5 times faster (`9445afd`). Every `localParts` call built
a new `Intl.DateTimeFormat`, which was 84% of planner time: p50 went from 32ms
to 3.3ms and `npm run week` from 45ms to 11ms, with byte-identical output. And
two tests picked a day by UTC date prefix, so one never saw Monday after 5pm
Pacific (`1967b92`).

**Left for Brydon.**

1. **Sessions under 25 minutes**, the one promise still broken (5,607 in 29,647
   plans, all 15 to 22 minutes). `buildSessions` deliberately lets the last 13 to
   24 minutes of an assignment be its own block, while `MIN_SESSION_MINUTES`
   says never schedule a fragment below 25. Two rules disagree. Recommend
   rounding the last bit up to 25: finishing early is pleasant, a 15-minute
   block is an interruption. One line, and then `npm run sweep` exits 0.
2. **A commitment whose window cannot hold one session** (2,290 reports). The
   planner trims a session only to the day's allowance, never to fit a window or
   a gap, so a 40-minute run with a 7 to 8am window and a day that starts at
   7:30 is never placed, and every replan says "the week ran out before you hit
   the target". The student has a settings conflict and is told their week is
   full. Recommend trimming down to `minSessionMinutes` to fit, and a truthful
   reason when even that fails.
3. **Sessions run in order** (345 warnings left). Each session must follow the
   one before, so when one takes a later, better-fitting hour the rest can run
   out of days: a 7-a-week habit whose first session takes Tuesday loses Monday.
   Paired on identical inputs, unchaining commitments cut their shortfalls 11%
   (2,358 plans better, 102 worse) and left 3% more coursework unplanned (1,688
   plans worse) as commitments won the room back. A trade-off, and "3 of 5 this
   week" would need renumbering by date. Not changed.
4. **Phantom shortfalls at the horizon's edge.** The last, partial week gets a
   proportional share, such as one run in a Monday that ends at 5pm. If that
   sliver cannot hold it, "Didn't fit" says "1 session short, the week ran out"
   about a week that has barely started. Not measured. Recommend not reporting
   shortfalls for a week the horizon cuts off.
5. **`pushAside` uses the machine's time zone** (`getHours`, `toDateString`), not
   the student's. Harmless while the browser's zone is the student's.
6. **How a block's reason is chosen.** Only the false "0 days" case was fixed.
   The general measure is in today's decisions entry.

**To review:**

```
git log --reverse main..claude/practical-cori-81ddb0
npm run check
npm run sweep
npm run sweep -- --only 1 --plan 0
npm run sweep -- --scenarios 500 --dump e
```

The fourth prints a 15-minute block with its whole input. A fresh worktree
needs `npx next typegen` once before `npm run check`, or typecheck fails on
`LayoutProps`.

## 2026-08-29 · Claude Code · Every blocker cleared, and three checks that lied

A long session that started with three dashboard actions and ended in a design
pass. All of it shipped.

**The Supabase work is done.** `0002` ran so account deletion actually deletes,
which closed the one place the product was lying to a student: the privacy page
had promised it for days. Custom SMTP went in through Resend and **sign-in was
run end to end for the first time**, which had never once been done. The
notification cron went from inert to returning 200.

**The interesting part was how much reported success while being wrong.** The
cron logged `succeeded` twice while the app returned 401, because pg_net is
asynchronous and the cron only records that it asked. A placeholder pasted into
`vault.update_secret` stored itself happily as the secret. `service_role` bypasses
RLS and still could not read the table, because `0001` granted only to
`authenticated`; `0004` fixes that. A first sign-in sends the Confirm signup
template rather than Magic Link, and Supabase's OTP length was 8 against an app
built for 6, which `normaliseCode` silently truncates. Every one of those looked
like something else.

**Three items on the status file had already shipped** and were still listed as
pending: the learned energy pattern, the returning-student experience, and later
the drag, which Brydon confirmed by thumb. A session was minutes from rebuilding
finished work.

**The name went round again.** A collision-first search across roughly 450
domains and a dozen trademark checks landed on Heron for the second time; Cusp,
Cairn, Pika, Bower, Nuthatch and Tortoise all died on marks. Brydon parked it to
keep thinking. Nothing bought, nothing renamed.

**A design read closed the session.** Measured on a 375px phone rather than
eyeballed, which was the right call: the type scale I was about to criticise
turned out to be fine, and the real bugs were 63px of footer permanently behind
the tab bar and a week grid showing three of fourteen columns. Fixed the first,
and shipped the replan animation, whose first version passed 276 tests while
animating nothing.

---

# Recent decisions

*Older decisions and the full findings log stay in the repo, in
`context/decisions.md` and `context/learned.md`. Ask for them if a question
turns on history this brief doesn't cover.*

## 2026-09-30 · Work waits for the five days before it is due

**Decided (Brydon):** an assignment's one block aims for the five days before
its deadline (`LEAD_DAYS`), lands earlier only when those days are full, and is
not planned at all while less than two days of that window fall inside the
plan. Opening the week tops up (`topUp`): open work with no block gets one,
nothing already planned moves, and nothing is written when nothing changed.

**Why:** with one hour per assignment and a free week, everything fitted into
the first day or two, and the first block on his calendar was a 30-minute item
due in two weeks. On a synthetic 150-item term the longest block-to-deadline
gap went from 17.8 days to 5.0, at one to five blocks a day.

**Cost:** `npm run refresh`'s "moved deadline kept its minutes" now checks an
item with nothing logged, because started-and-open work due after week 4 no
longer happens in the simulation. It passes without testing anything; worth
rebuilding the scenario when the refresh code next changes.

## 2026-09-30 · One hour per assignment; Done finishes it, Partly books a follow-up

**Decided (Brydon):** every assignment gets one 60-minute block. Done marks the
assignment done whatever the estimate. Partly logs the minutes and books one
follow-up straight away, later that day or on another day before it is due: an
hour if under half the first went on it, otherwise 30 minutes. A day's
allowance can still trim it, as it can any session.

**Why:** splitting by estimate (a quiz 90 minutes in three, an exam in eight)
filled his first real week with slivers of one course and made it unreadable.
One block per thing is legible, and the student's own Done and Partly carry
the information the estimate was guessing at.

**What it costs:** exams and projects get an hour up front and rely on Partly
for the rest; spaced exam prep across days is gone for now. Estimates are still
stored and still learned from, so returning to sized sessions is a planner
change, not a data migration. The sweep's promise (c) is now "one planned block
per assignment"; `npm run refresh` simulates Partly and answers only work due
within the week, since a student finishing everything two weeks early left
nothing open to test.

## 2026-09-30 · Courses get their own hues; Canvas reminders are notifications

From Brydon's first real week, on launch day.

**Course hues.** Coursework shades were a four-step red ladder, so a week of
study blocks was one colour: "everything is red, I can't tell anything apart".
Shade 0 stays the canonical red (the only one the month view uses); shades 1 to
5 are now separate hues with their own lightness, and there are six of them.
`npm run palette` validates them like everything else, including under all
three CVD simulations; one candidate violet collided with the class blue under
deuteranopia and was moved darker until it passed. Rejected: colour by kind of
work, which is what produced the problem.

**Reminders.** Instructors post "Final Reminder to Complete Peer Feedback" as a
Canvas assignment. "Final" made it an exam: eight sessions, billed as 40% of the
grade. Any title with "reminder" now gets no study time, no deadline flag, and a
push at 9am on its due day (8pm the day before if due earlier). Checked by title
in the planner, not just at import, so weeks imported before this lose the
sessions on their next replan.

**One notification per moment, without state.** The sender runs every ten
minutes and reads a plan the device overwrites on its next push, so nothing
stored can dedupe a send. A time-bound notice is eligible for exactly one
ten-minute window instead. That also fixed "Next up", which could fire twice
(15 and 5 minutes before).

## 2026-09-23 · Calendar links sync to the account, encrypted

**Supersedes** the "device and not the server" half of 2026-09-22, "Remember
the Canvas link on the device, never on the server". Remembering stays opt-in
and ticked by default; what changes is where a remembered link lives when the
student is signed in.

**Decided:** signed in, a remembered link is also saved to the account in
`calendar_feed` (`0005`), AES-256-GCM encrypted by `/api/feeds` with
`FEED_LINK_KEY`, which lives in Vercel and never in Supabase. Rows are found by
an HMAC of the URL, and the user id is the associated data, so a row moved to
another account does not open. The route talks to Supabase with the student's
own token, so RLS decides access; there is no service-role key in it. Signed
out, nothing changes: the link stays in the browser. Forget deletes the row on
every device; Delete my data cascades.

**Why:** Brydon hit it on his own phone on day one. Device-only meant a link
pasted on a laptop could never refresh the phone, and the phone is both where a
student uses Heron and where getting the link is hardest. That is the week-4
stale-deadline problem the 2026-09-22 decision existed to fix, back again for
anyone with two devices.

**The sync rule, and why it needs a flag.** A link missing from the account is
either forgotten on another device or saved here before signing in. They look
the same and need opposite answers, so each entry carries `synced`: missing and
synced goes, missing and never synced is uploaded (`feed-sync-rule.ts`). A fetch
is sent as a touch that only updates an existing row, never an upsert, so a
device that has not heard about a forget cannot revive the link. A forget that
fails on the network is kept on the device and sent before anything is read at
the next sign-in. Each of those has a test that fails when the rule is flipped.

**What it costs, stated.** The claim is no longer "never on our server". It is
"only if you ask, encrypted, with the key outside the database". A database
dump or backup alone reveals no link. Someone holding both the database and
Vercel's environment could decrypt them, and that includes Brydon. The privacy
page, the import page and `growth.md`'s "never holds a credential" line now say
so; the pitch is "never your Canvas login".

**Rejected:** plaintext behind RLS (a dump is a list of live passwords);
Supabase Vault or pgsodium (puts the key next to the data it protects);
syncing the link inside `plan_state` (it would also land in every backup file);
keeping device-only and just improving the iPhone instructions (the phone still
could not refresh a link saved on the laptop).

**Revisit when:** a server-side daily refresh is built. The link is now
reachable server-side, which is what that needs, and the 2026-09-22 reasoning
about "fetching data vs changing the plan" still governs what it may do.

## 2026-09-23 · Whatever is on the calendar counts, everywhere

**Decided:** a session already on the calendar, reported or pinned, counts
against every limit it belongs to: the day's ceiling (2026-09-22), the
commitment's weekly quota and daily limit, and the assignment's remaining work.
For the current week's quota the planner takes the larger of the stored tally
and the sessions reported this week, then adds the pinned ones. The Sunday quota
notice uses the same count.

**Why:** `npm run sweep` found the same mistake three times. A pinned run was not
in the weekly quota (a 5-a-week habit got 6), a pinned hour of a problem set was
not in its remaining work (it was planned twice), and a limit of two a day was
never enforced at all. Each is the planner counting only what was reported and
ignoring what the student had already put on the calendar.

**Why the larger of two counts, not either one.** The tally is wiped when the
week's first replan comes after a session was already done (plan Sunday night,
run Monday morning, replan at noon), so it can read low. The blocks miss a
session dropped with "I'm not doing this", which raises the tally and leaves no
block, so they can read low too. Neither is ever high by mistake.

**Rejected:**
- Fixing `resetWeeklyTallies` to recount from blocks. It does not receive the
  blocks, the hook calls it, and the tally would still miss drops.
- Deriving the quota from blocks alone and deleting `doneThisWeek`. Drops need
  somewhere to live, and the notification engine reads it.

**Revisit when:** drops get a block of their own (a skipped block marked
"dropped" would do), at which point the tally can go and the blocks are the
whole truth.

---

# Currently waiting on Brydon

- **Notifications have never been seen arriving on a phone.** Install from the
  home screen, sign in, Settings, turn them on, then wait for a "Next up" 15
  minutes before a block. Reminders ("Final Reminder…" items) now arrive this
  way too, at 9am on their due day, so this is load-bearing.
- **Two-device sync has never been confirmed.** Plan on the laptop, open the
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
