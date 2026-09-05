# Heron — project brief

*Generated 2026-09-05 from the project's `context/` files by `npm run handoff`.
Don't edit this by hand; edit the source files and regenerate.*

This is the standing context for Heron. It covers the person building it,
what's being built, where it stands, and what has already been decided — so a
conversation can start from here instead of from scratch.

**25 days to launch** (September 30 2026).

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

**Updated: 2026-08-29** · 32 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (public). Live and current at
**`heron.study`**, registered at Name.com on 2026-09-05 and attached to Vercel;
`quarterly-alpha.vercel.app` still works and is the fallback. Pushes to `main`
auto-deploy in about 20 seconds,
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

## In progress, not finished

- **Three doors into configuration.** `/start`, `/onboarding` and `/setup` all
  configure the same state. `/start` is the default and `/onboarding` is the
  guided alternative; `/setup` is now only reachable from the nav and from
  individual setup prompts. Two of the three should survive to launch and it is
  undecided which. **This one needs Brydon**, it is a product call.
- **The name is Heron and the rename is done**, as of 2026-09-05. Code, copy,
  metadata and manifest all say Heron. Four storage identifiers still say
  `quarterly` on purpose and are commented as such.
- **Register `heron.study`, then verify it in Resend.** The
  shared `onboarding@resend.dev` only delivers to Brydon's own address, so no
  student can sign in until a real domain is verified. The name is no longer
  what blocks this.
- **Confirm the sync loop** on two devices. The drag is confirmed.
- **A decision on the three doors** into configuration.
- **What the phone shows instead of a seven-day grid.** See Next, item 5.
- **DNS for `heron.study`.** Two records still to add, both Brydon's: Resend's
  verification records so sign-in codes come from the domain rather than a
  shared sender, and `https://heron.study/**` in Supabase's redirect allow-list.
  Sign-in breaks the moment students use the new URL without the second one.
- **Whether paid testers are tagged separately.** Paying people to open the app
  measures the payment, not the product, so they must not pollute the retention
  cohort.
- **Deployment Protection** is still on, set to
  `all_except_custom_domains`. That means it never affected students and never
  will: `heron.study` is public today, and so was the vercel.app URL before it
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

---

# Recent sessions

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

## 2026-08-26 · Claude Code · Colour, a code, a month, and a drag that never worked

Three specified pieces of work, in order, plus two bugs Brydon found by using it.

Colour became a category system. Five separate hex arrays in five files were
replaced by six categories owning hue families, with shades inside for
individual courses. Nothing stores a hex any more, so dark mode stopped being a
second palette to maintain. The palette is generated and validated by
`npm run palette` rather than chosen: the first attempt failed 24 ways under
colour vision deficiency and nobody would have seen it by eye.

Sign-in became a six-digit code. Brydon spotted that this removes the need for a
pending-signup table entirely rather than mitigating it, because a student who
never leaves the tab still has their answers in hand when they type the code.
That deleted a whole unauthenticated write path from the design.

The month view landed, reusing `breakdownForDay` rather than deriving a second
workload number, with a test asserting the two views cannot disagree.

Then Brydon reported sleep hours that would not save, and dragging a block to
another day making it vanish. Both were real, both had causes other than the
obvious one, and both are in `learned.md`.

A long stretch went on naming and produced no decision. Slate died to
Technolutions, Tessel to a live TESSELL trademark, and four of five candidates
were killed by collisions found only after they had been recommended. The
process was backwards and is recorded as such.

## 2026-08-23 · Claude Code · The data layer, and a bug a student would have found

Supabase went in: schema, magic-link auth, plan sync, and the telemetry that
week-4 retention is measured from. Nothing in the product requires an account
and nothing does now; every path treats signed-out as "stay local", so the
no-account product is exactly what it was.

Two bugs in it were the interesting part. The Supabase client is created lazily,
so when a magic link landed on `/week` and nothing on that page touched
Supabase, no client existed, the code in the URL was never exchanged, and the
sign-in silently did nothing while looking identical to success. And
`lastSyncedAt` was doing double duty as "does this device have unsynced edits",
which made a device that had never synced read as infinitely old, so a week
built offline lost to any server copy without a word.

Then Brydon looked at his own calendar and found the real one: a 5-a-week run
and a 4-a-week project were both landing seven times, on every single day.
Sessions carried a deadline and no floor, so the early-bias in slot value
dragged later weeks forward. Fixing placement exposed a second bug underneath
it, where the reason text said "6 of 5 this week" because it counted across the
whole plan rather than within a week.

Neither was found by a test. Both were found by reading real output, which is
now four sessions running.

Ended with 198 tests and a live product with accounts. The sync loop has still
never been watched end to end by anyone, because the magic link goes to an inbox
no agent can reach.

---

# Recent decisions

*Older decisions and the full findings log stay in the repo, in
`context/decisions.md` and `context/learned.md`. Ask for them if a question
turns on history this brief doesn't cover.*

## 2026-08-28 · The name is Heron, and the search had to change shape first

**Executed 2026-09-05.** Code, copy, metadata and manifest renamed in one pass.
Four storage identifiers deliberately still say `quarterly` and are commented as
such: the localStorage key, the Supabase auth storage key, and the two service
worker cache names. Renaming those would read as tidying and would empty the
calendar of, or sign out, everyone already using it.

**Decided:** the product is renamed **Heron**, on `heron.study`. `Quarterly`
encoded the quarter system for a product that stopped being quarter-shaped in
August.

**Why the two previous attempts produced nothing.** Both searched for a name
that was short, had a free `.com`, and was clear of software trademarks. That
set is empty, and it is worth stating as a fact rather than a feeling: 213
candidates were checked against the registry, real words and coined ones, and
**213 were registered.** Three were confirmed by hand against whois rather than
trusted from one source. `horalis.com` had been taken in December 2025.
Domainers sweep anything pronounceable within weeks, so the `.com` constraint
was doing all the killing and none of the choosing.

Dropping `.com` rather than dropping "short" is what made it tractable, because
the thing being sold is a name people say, and the domain is plumbing. Resend
verifies any domain, and students have only ever seen a `vercel.app` URL.

**What was rejected, and on what evidence.** Trellis: an LMS in education plus a
registered TRELLIS mark. Kestrel: registered mark #6015386 in software products,
plus Kestrel Software LLC. Kiln: registered mark plus an apps company filing for
downloadable software. Crest: CREST Technologies in education and Raise Crest
Education, on top of a famous consumer mark. Cadence, Lattice, Tempo, Stride and
Lumen are large software or education companies outright. Lantern survived
availability but carries three live software marks. Vesper was the runner-up and
was set aside only because Samsung holds a VESPER mark whose class could not be
established.

**Why Heron specifically.** Two syllables, spells itself, unmistakable out loud.
The only trademark hits are Blue Heron Scientific, HEREON with a different
spelling, and a Shenzhen camera company; no bare HERON mark in productivity or
education software surfaced. It also means something here: a heron stands still
for a long time and moves exactly once, at the right moment, which is the
product's whole thesis.

**On the domain, and a correction.** `.study` names what a student uses it for
and reads correctly to them. It also narrows the product to studying, which
`product.md` already says it outgrew, so an escape hatch on a neutral TLD was
the plan. There isn't one: `heron.co` has been registered since 2017 and
`heron.so` since 2021. `heron.study` is $55 a year.

**The availability check for non-`.com` TLDs was wrong and should not be reused.**
`.com` went to Verisign's RDAP directly and three results were confirmed against
whois, so those 213 hold. `.co`, `.so` and `.study` went through `rdap.org`,
where a 404 can mean the registry has no RDAP endpoint rather than the domain
being free, and every 404 was read as available. Vercel's registrar search
caught it. **Check a domain at a registrar before believing it is available**,
whatever a script says.

**Worth revisiting if:** a clearance search turns up a live HERON mark in class 9
or 41, or the product's audience stops being students. Note that none of the
above is a clearance search. It is web research, and a lawyer's twenty minutes
should precede any money or launch behind the name.

## 2026-08-26 · Two colour axes, and a code instead of a link

**Decided:** colour carries two independent things. Category owns the hue family
and answers "what kind of hour is this". Shade steps within the family and
answers "which course". The month view reads category only; week and day views
read both.

**Why not category alone, which is what was asked for:** with one colour per
category, five courses render identically in the week grid, and the same request
also said course distinction should survive there. Both cannot come from one
field.

**Why not per-course alone, which is what existed:** the same red was a lecture
one week and a gym session the next, so colour meant nothing and was decoration.

**What it cost to get right.** The first palette gave every family the same
lightness ladder and differed them only by hue. It failed 24 ways, because hue
is precisely what colour vision deficiency destroys. Families now own lightness
bands and no two are neighbours on both axes at once. `npm run palette` runs
OKLCH generation, Viénot simulation for all three deficiencies and CIEDE2000, in
both modes, with an exit code.

**The limit, recorded rather than hidden:** the week grid paints blocks as a 26%
tint, and at that strength two shades of one family sit about 1.5 ΔE apart.
Within-family distinction there rests on the label and the 3px full-strength
border, not on the fill. Category separation, which is what the month view
needs, is 10.9.

---

**Decided:** sign-in is a six-digit code typed into the tab, not a magic link.

**Why:** a link can only be completed in the browser that requested it, because
that browser holds the PKCE verifier. A student who onboards in Safari and opens
the link from the mail app lands in a different context and gets an error about
a code verifier. The code never leaves the tab, so the failure cannot happen
rather than being handled.

**What it removed.** The original plan was to persist onboarding answers
server-side against a pending signup record. Brydon spotted that the code flow
deletes the need for it: the student still has their answers when they verify,
so the write happens as a normal authenticated user. No pending table, no anon
INSERT, no claim token, no security-definer claiming function, and no
unauthenticated write path to carry forever.

**The stated cost was a 60-second window where a tab crash loses the answers.**
It does not exist: `/onboarding` writes through the store at every step, so
everything is in localStorage before the code screen.

**Rejected: implicit flow.** It would make links work anywhere, and it puts
access tokens in browser history on an app holding a person's whole schedule.

**What would make it worth revisiting:** if code delivery turns out to be the
thing students fail at, which depends entirely on email deliverability rather
than on the flow.

## 2026-08-27 · A dragged block pushes, and never merges

**Decided:** dropping a block on top of another displaces the other one
downward into the next free gap, and says so. The dragged block never moves.

**Why the dragged one wins:** it is the only thing on screen the student has
just made an explicit decision about. Everything else is the scheduler's
opinion, and an opinion yields to an instruction. Same reasoning as an
appointment beating a plan, one level down.

**Why settled blocks are obstructions rather than things to shove:** a finished
block is a record of what happened. Shifting it to tidy the present is
rewriting the past, so a displaced block goes around it.

**Why a push past the end of the day is refused:** a visible overlap the student
can see and fix beats work silently relocated to 2am.

**Rejected: merging two sessions of the same commitment into one longer block.**
Two 30-minute runs are not one 60-minute run, and for study it is worse: the
entire premise of spacing is that separate sessions beat one double session.
`maxPerDay` and `separateDays` exist to prevent exactly this, so an automatic
merge would silently undo what the scheduler is for.

**What would make it worth revisiting:** an explicit version, where dragging one
session onto another merges them *and says what it costs*. That is a real
feature with real copy, not a side effect of dragging, and it should wait until
a student asks for it.

## 2026-08-23 · Magic links, no server session, and a sync that refuses to guess

**Decided:** three things, all from putting Supabase in.

**Magic link, no passwords anywhere.** A password is one more thing to invent at
9pm, and the most common reason someone never returns to an app is that they
cannot get back into it. The cost is a hard dependency on email delivery, which
makes custom SMTP a launch blocker with a lead time rather than a launch-day
task: Supabase's built-in sender is documented as testing-only and rate limited
to a handful an hour, and thirty students onboarding during welcome week would
hit that wall and see what looks like a broken app.

**Known limitation, accepted:** PKCE stores a verifier in the browser that asked
for the link, so a student who requests it on their phone and opens the email on
a laptop cannot sign in. Implicit flow would fix it and puts access tokens in
browser history instead. For an app holding a real person's whole schedule that
is the worse trade, so the flow stays and the copy tells people to open it on
the same device.

**No `proxy.ts` and no `@supabase/ssr`.** Next 16 renamed Middleware to Proxy
and every Supabase-with-Next guide still says `middleware.ts`, but it does not
matter here: every page is a client component reading localStorage and no
server-rendered content depends on who you are. Cookie-based session refresh
would be machinery serving no request.

**Sync picks a winner, or refuses to.** The plan syncs as a single JSON blob
mirroring the local store, so syncing is "write the same object somewhere else"
rather than a schema translation kept in step forever. There is no merge. When
both sides changed since they were last level, any automatic choice discards a
real week, so `decideDirection` returns `conflict` and nothing happens. A sync
that does not run is far better than one that eats a week.

**What would make it worth revisiting:** a student actually hitting the conflict
state, which needs two devices and is not the realistic case yet. The `revision`
column is already in the schema for when it is.

## 2026-08-22 · The account step goes last, and setup is a phase you leave

**Decided:** two things, from the same session.

**First, an account is asked for at the end of onboarding, never at the front.**
The mock at step five of `/onboarding` comes after there is a planned week on
screen, and the ask is "keep this if you lose your phone" rather than "sign up
to continue". Email link, no password field.

**Why, given this reverses what was asked for:** the input was a signup flow
followed by a calendar flow. The evidence points the other way. Time-to-value
should land inside 60–90 seconds and abandonment roughly triples past thirty
minutes; `/start` currently gets a student to a real week in three seconds. An
identity wall in front of that trades the single best-measured advantage this
product has for an email address that nothing can use until Supabase lands.
Asked at the end, the same question has a reason a student can evaluate.

**What would make it worth revisiting:** if sync turns out to be the thing
students actually want, or if week-4 retention among account-holders is
dramatically higher than among device-only users, the ask has earned a more
prominent place. Not before there is data.

**Second, being live is permanent.** Once `wentLiveAt` is stamped, setup prompts
never render again, even for a student who later deletes every commitment and
falls back below the bar that `isLive` tests for.

**Why not just derive it:** because the honest answer to "do you have classes?"
is sometimes "no". A model that recomputes readiness on every render nags that
student forever, which was the original defect. Setup is a phase you leave, not
a score you can drop below. `liveNoticeSeen` is tracked separately from
`wentLiveAt` for the same reason: deriving "have we told them" from "are they
live" re-shows the confirmation on every reload.

**What it costs:** a student who genuinely wants to redo setup needs a route
back in. `unskipStep` exists and clears `wentLiveAt`; nothing in the UI calls it
yet. That is a real gap, and it is the deliberate kind.

---

# Currently waiting on Brydon

_Nothing blocked._
