# Quarterly — project brief

*Generated 2026-08-24 from the project's `context/` files by `npm run handoff`.
Don't edit this by hand; edit the source files and regenerate.*

This is the standing context for Quarterly. It covers the person building it,
what's being built, where it stands, and what has already been decided — so a
conversation can start from here instead of from scratch.

**37 days to launch** (September 30 2026).

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

**Updated: 2026-08-24** · 37 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

Repo: `bmwother1/quarterly` (public). Live and current at
`quarterly-alpha.vercel.app`. Pushes to `main` auto-deploy in about 20 seconds,
confirmed working by watching a deploy land 27 seconds after a push. 198 tests.
Supabase project `dxvekspnhqrcwqbqxleh` (West US Oregon); keys are in
`.env.local` and in all three Vercel environments. Node lives at `~/.local/node` and is on Brydon's PATH but not in a
fresh agent shell — prefix `export PATH="$HOME/.local/node/bin:$PATH"`.

---

## Right now

The product is finished enough to hand to a student. Import any calendar, get a
planned week, check things off, replan when it falls apart. It installs to a
phone, works offline, and resolves conflicts on its own.

The data layer landed on 2026-08-23. Accounts, sync and telemetry all work, so
the thing that measures retention now exists rather than being a plan.

What remains untrue outranks everything on the shipped list:

1. **Nobody has used it but Brydon.** One interview, logged as zero signal.
   Fifteen were due by month end and none have happened.
2. **The sync loop has never been watched end to end.** Every piece is tested
   and rows did appear in Supabase, but nobody has signed in, made a change, and
   confirmed the server copy moved. The magic link goes to an inbox no agent can
   reach, so this needs Brydon and five minutes.
3. **Retention is measurable, not measured.** Nothing reads the
   `weekly_retention` view until there are students in it.

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
- **Backup** — export and import JSON, and now a server copy as well
- **Accounts** — magic link, no passwords. Optional throughout: signed out is a
  supported state everywhere and the no-account product is unchanged
- **Sync** — the plan mirrors to `plan_state` on change, debounced. When both
  copies changed since they were last level it reports a conflict and does
  nothing, because there is no merge and any automatic choice eats a week
- **Telemetry** — `opened`, `planned`, `block_done`, `block_skipped`,
  `block_moved`, `feed_synced`. Counts and durations only, never titles or
  course names. Append-only by grant: the client cannot update or delete
- **Onboarding with an ending** — `/onboarding` is a five-step guided flow, and
  the app now knows when a student is finished. One prompt at a time, every one
  answerable in both directions, and once `wentLiveAt` is stamped setup prompts
  never return. The account step is a labelled mock and is deliberately last

## In progress, not finished

- **Three doors into configuration.** `/start`, `/onboarding` and `/setup` all
  configure the same state. `/start` is the default and `/onboarding` is the
  guided alternative; `/setup` is now only reachable from the nav and from
  individual setup prompts. Two of the three should survive to launch and it is
  undecided which. **This one needs Brydon**, it is a product call.
- **The returning-student experience.** Five days away and `/week` opens with a
  red banner saying 15 blocks passed without an answer. Correct, and it reads
  like being told off at exactly the moment week-4 retention is decided.
- **Notification delivery.** Engine, copy and banned-phrase list are written and
  tested, and `push_subscription` is in the schema. Nothing sends anything: no
  VAPID keys, no service-worker push handler, no scheduled job.

## Next, in order

1. **Interviews.** Nothing else here matters as much and the count is still one.
   Twelve by Sept 6 is what the business plan argues for.
2. **Confirm the sync loop by hand.** Sign in, change something, watch
   `plan_state.updated_at` move. Five minutes, and it is the one claim in the
   data layer nobody has verified.
3. **Custom SMTP.** A launch blocker with a lead time. Supabase's built-in
   sender is documented as testing-only and rate limited to a handful an hour.
4. **Learned energy pattern** — replace the declared dropdown with observed
   completion rate by hour. `observed.ts` already collects it.
5. **Push notification delivery** — the higher-value half of a written feature.
6. **Syllabus parsing** — the one job an LLM genuinely belongs in.
7. Tailwind oddity: `max-w-*` utilities produced no CSS, so the calendar width
   is set inline. It will bite again on a class that matters more.

## Owed to Brydon

- **The business plan was written and is not yet filed.** It covers the
  interviews, distribution to thirty students, the domain, Dempsey and the
  revenue model, and it is sitting outside the repo rather than in `context/`.
  Brydon parked the business side to focus on code; picking it back up means
  filing it as `context/business.md` first.
- **One correction it contains, since it affects a date in `learned.md`:** the
  Dempsey application does not go in over winter break. It opens late February
  and closes in early April, with four rounds after that.

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
- Learned energy pattern, if there is time left after the interviews.

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

## 2026-08-22 · Claude Code · Onboarding got an ending

Wired up the completion model that had sat in the repo for three days as a
module no page imported, so it did nothing at all. The `/week` banner that could
only say one thing and had no way to be answered is gone, replaced by one prompt
at a time that a student can answer in either direction. The app now has a real
notion of **live**: once every required step is resolved the prompts stop
permanently, including for someone who later deletes every commitment.

Built `/onboarding`, a five-step guided flow on the `OnboardingShell` component
that was written last week and never used. `/start` keeps its two questions and
stays the default door; this is the other one.

The session started on the business plan that was owed, and turned into code
halfway through when a mentor's input arrived. The mentor asked for a signup
flow first and a calendar flow second; the signup half was pushed back on and
built last instead, as a labelled mock, because there are no accounts until
Supabase lands and putting an identity wall in front of a three-second first run
trades away the best-measured thing this product has.

One bug found by looking rather than by a test, again: `autoFocus` scrolled the
page 302px on load, so a student on a phone landed mid-form having never seen
the heading or the progress bar.

## 2026-08-21 · Claude Code · Import anything, and a day view

Four things landed. Two bugs in the first-run path, found by writing a script
that prints what a stranger actually gets from `/start` — one of which silently
stopped a commitment being scheduled forever after a single shortfall. Conflict
resolution, so an appointment dropped on planned work moves the work and says so.
A day view, whose palette work turned up that the course colours failed a
colourblind check. And calendar import for Canvas, Google, Apple and Outlook,
which needed recurrence expansion to be worth anything.

Two roadmap items were struck on evidence: Google's calendar API needs a
five-week verification, and writing a plan back into Google Calendar is worse
than nothing because subscriptions refresh every 12–24 hours.

Also found Canvas had become unreachable on a phone — the tab bar dropped it on
the reasoning that it belonged inside Plan, and it was never put inside Plan. A
commit message that was true about intent and false about the code.

Ended with a business-side action plan requested and not delivered. It is
recorded at the top of the owed section in `status.md`.

---

# Recent decisions

*Older decisions and the full findings log stay in the repo, in
`context/decisions.md` and `context/learned.md`. Ask for them if a question
turns on history this brief doesn't cover.*

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

## 2026-08-21 · Import from any calendar; never write back

**Decided:** one paste box at `/import` accepts Canvas, Google, Apple and
Outlook. The server decides what a feed's contents mean from where it came
from — Canvas produces assignments to schedule, everything else produces fixed
events to schedule around. Quarterly does not publish a feed back out.

**Why not write back, which was the obvious ask:** Google refreshes subscribed
calendars every 12–24 hours and won't let you force it. For a static timetable
that's fine; for a scheduler whose entire premise is that the plan changes when
you fall behind, the copy in their calendar would routinely show a plan already
replanned. Two sources of truth with the stale one being the calendar they
actually check. Better to ship no write-sync than a wrong one.

**Why not Google's API:** `calendar.events` is a sensitive scope requiring
verification — video demo, written justification, Trust & Safety review — with
real developers reporting five-plus weeks under review and no response. The
roadmap had two-way Google sync in phase three, Aug 31 to Sept 13. It could not
have landed, and building it first would have been how we found out.

**What it actually needed:** recurrence. A Canvas feed is nearly all one-off
deadlines so RRULE was ignored and nothing was lost. A personal calendar is the
opposite — a timetable is *all* recurrence, and without expansion it imports as
a single Tuesday lecture while the scheduler books over the rest of the term.

**What it deliberately doesn't do:** monthly and yearly rules are counted and
reported, never guessed at. Treating a monthly club meeting as weekly would put
four times as much in a student's calendar as exists. All-day entries are
dropped too — blacking out every hour of spring break is the opposite of the
truth.

**The security note:** widening the allowlist from one provider to four is
exactly how the lookalike-domain bug gets reintroduced four more times.
Suffix matching now lives in one place, and there's a test that tries
`calendar.google.com.attacker.com` and its equivalent for every provider.

## 2026-08-21 · A stacked bar, not a pie — and a validated palette

**Decided:** the day view answers "where does this day go" with one horizontal
stacked bar. Tapping a day in the week grid or a bar in the workload chart opens
it.

**Why not the pie that was asked for:** part-to-whole is a stacked bar's job.
Comparing segment lengths along one axis is a much easier read than comparing
wedge angles, long course names have somewhere to sit, and the bar still works
at 10px tall on a phone. The calendar column is also already a proportional
picture of the day, so a pie of the same data would duplicate it.

**The bigger finding:** the course colours, picked by eye months ago, failed a
colourblind check. The original pink and green sat at ΔE 4.9 under
deuteranopia against a ≥8 target — roughly one man in twelve could not tell two
of their courses apart. Replaced with a set validated in both modes: worst
adjacent CVD ΔE 9.1 light, 8.4 dark.

**Two rules that keep it valid.** Hues are assigned in fixed order and never
cycled into new ones — a ninth course reuses slot one rather than inventing a
colour indistinguishable from an existing one. And colour follows the entity,
not its position in a list, so removing a course never repaints the others.

Three light steps fall below 3:1 contrast, so every segment carries a visible
label. Colour is never the only encoding.

## 2026-08-21 · An appointment beats a plan, including a pinned one

**Decided:** adding or moving a one-off event resolves whatever it lands on,
immediately. Blocks move; the event doesn't. Pinned blocks move too, and get
named in a notice. Finished blocks are never touched.

**Why the event wins:** an appointment has a real time in the world and a study
block does not, so only one of the two *can* move. That isn't a judgement call.

**Why pinned blocks move as well:** a pin means "the scheduler should stop
arguing with me about this hour," which is a preference. An appointment is a
fact. The fact wins — but silently overriding the one place the app promised to
defer would be worse than the collision, so it says what it did: *"Moved
Quarterly — you'd placed it where Dentist is."*

**Why finished blocks don't move:** a completed block is a record of what
happened, not a plan. Rewriting it to tidy the calendar is falsifying history.

**Does auto-replanning here breach "replanning is explicit"?** No, and the
distinction matters. That rule is about not absorbing your *failures* quietly —
a missed block must never just vanish. Here the student has told the app about a
new constraint, and reacting to an instruction they gave is cause and effect,
not silent absorption. Same reasoning as the menu closing on click rather than
on a path change.

---

# Currently waiting on Brydon

- **The interviews.** Ask what they did last Sunday. Don't show the product.
- **Confirm sync end to end.** See "Next" above.
- **Custom SMTP**, before students exist rather than after.
- **A decision on the three doors** into configuration.
- **The domain.** `quarterlystudy.com`, about $11, still unregistered.
- **Deployment Protection** is still on, set to
  `all_except_custom_domains`. That means it never affected students and never
  will: `quarterly-alpha.vercel.app` is public today and a custom domain will be
  too. It only walls off raw deploy URLs from Brydon himself. Worth switching
  off to stop wasting his own time, but it is not a launch item. Leave
  `gitForkProtection` on, since it stops a forked PR building with the Supabase
  keys once those exist.
