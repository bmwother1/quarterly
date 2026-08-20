# Decisions

Newest first. A decision belongs here if a reasonable person could have chosen
otherwise. Naming a variable is not a decision.

Format: what was decided, why, what was rejected, and what would make it worth
revisiting. When one is reversed, mark it **Superseded** and link forward — the
record of what was tried and abandoned is worth more than a tidy file.

---

## 2026-08-19 · Offline, and one step of undo

**Decided:** a service worker that caches the app shell, and one level of undo on
the three actions that destroy something.

**Why offline:** everything already lives in localStorage, so the only reason
the app fails without a signal is that the page can't load. That's a small fix
for a real case — campus wifi — and the service worker is needed for push later
regardless, so it's on the path either way.

**The one rule in it:** `/api/` is never cached. That response is derived from a
Canvas feed URL, which is a bearer credential for a whole schedule, and a cached
copy sitting in a shared browser is exactly the leak the design avoids.

**Why undo:** there is no server copy and no version history, so a mistaken
"drop it" is permanent — and the app deliberately asks people to make quick
judgements about their week. One step covers the realistic case without
pretending to be a document editor.

**Not verified:** service worker registration is blocked in the automated
browser used for testing here, the same way pointer drags were. The script
serves correctly and the code fails safe, but it needs a human check: load the
app, turn on airplane mode, reload.

---

## 2026-08-19 · The calendar renders before there's anything in it

**Decided:** the week grid always renders, empty or not. Only the controls that
need data — replan, the didn't-fit report, the drag hint — are conditional.

**Why:** the page's identity should be obvious before it has content. A card
saying "nothing to plan yet" tells you the state; a visible calendar tells you
what this page *is* and what it will look like once you've set up.

**What it caught:** the first copy pointed at "the shaded bands below," and on a
genuinely fresh account there are none — default sleep is 23:00–07:00 and the
grid shows 07:30–22:30, so nothing falls in view. Copy that describes something
that isn't on screen is worse than no copy. It now says what will appear once
you've told it about your classes and job.

---

## 2026-08-19 · Everything on the calendar is tappable

**Decided:** one-off events are buttons like study blocks. Tapping one shows its
detail and a remove control.

**Why:** removing the "one-off things" section from setup — correct, since the +
replaces it — would otherwise have left events addable but not removable. The
answer isn't a management list somewhere; it's that the calendar is where these
things live, so the calendar is where you act on them. A thing you can see and
not touch is a dead end.

**Also:** the + is hidden until there's something to plan. On an empty week the
page has one job, and a floating add button there is a second call to action
competing with the one that matters.

---

## 2026-08-19 · Frequent actions on the page you're already on

**Decided:** a floating **+** on the calendar opens a sheet for a one-off event
or task. Set-once configuration moved to `/settings`. `/setup` is now just the
shape of a week, with the explanatory prose cut hard.

**Why:** setup had grown to ten sections of prose, and the single most frequent
action — adding a one-off — was buried at the bottom of it. That is a lot of
reading to perform a two-field task, and it is not how any calendar a student
already uses behaves.

**The general rule:** frequency decides placement. Daily actions belong on the
screen you're already looking at; things you touch once belong behind a tap.
Prose is the tell — when a section needs three sentences to explain itself, the
label is usually wrong or the thing is in the wrong place.

---

## 2026-08-19 · Learned patterns are offered, never applied

**Decided:** the app reads completion rate by hour, duration bias per course, and
hours the student never finishes anything in — then *shows* them and offers a
change. It does not silently rewrite settings.

**Why:** two reasons, and the second matters more. A pattern from thin data is
often wrong, so the eight-observation floor stays. And an app that quietly
rewrites your settings based on its own reading of you is unsettling even when
it is right. Describing behaviour and proposing is the difference between a tool
and something that thinks it knows you.

**The line held throughout:** describe behaviour, never character. "You rarely
finish anything at 2pm" is a fact about blocks. "You're bad at afternoons" is a
verdict about a person.

---

## 2026-08-19 · Export and import, before sync exists

**Decided:** a downloadable JSON backup and a restore, with a confirmation step.

**Why:** the privacy page tells students the truth — their schedule exists in one
browser and clearing site data destroys it with no copy to ask for. That is an
honest description of a real hazard, and leaving it unmitigated while sync is
weeks away is the wrong trade. A backup also moves a schedule from laptop to
phone today, which is most of what sync will do.

**Import is forgiving about shape and strict about identity.** A file from a
newer build may carry unknown fields, so it merges over a fresh empty state; a
file that is not a Quarterly backup is refused outright rather than half-loaded.

---

## 2026-08-19 · A fixed event and a dated task are separate primitives

**Decided:** two ways to add a one-off, chosen with a single tap. "At a set
time" creates a `FixedEvent` the scheduler works around. "Needs doing by"
creates an `Assignment` the scheduler places.

**Why:** conflating them is what makes most planners annoying. A dentist
appointment has its time already decided and the only correct behaviour is to
never book over it. A task has a deadline and no time yet, and deciding when it
happens is the entire product. One "add" box that guesses which you meant gets
it wrong constantly.

**What it did not need:** a new type for hand-entered work. That's an
`Assignment` — it wants exactly the same treatment as anything from Canvas,
split into sessions, ranked, placed, explained. Only its origin differs, and
nothing downstream cares.

---

## 2026-08-19 · A hand-moved block is pinned

**Decided:** dragging a block sets `pinned`, and the planner treats pinned
blocks like settled ones — kept across a replan and passed in as time already
spent.

**Why:** without it, dragging is theatre. The next replan puts the block back
where the algorithm wanted it, and the app overrules the person using it. The
scheduler is allowed to be opinionated about work the student hasn't touched;
it is not allowed to argue with an explicit instruction.

---

## 2026-08-19 · A skip asks what it meant

**Decided:** skipping offers "find another time" or "drop it" instead of just
recording a skip.

**Why:** a skip is ambiguous and the two meanings need opposite handling. "Not
now" is work that still exists and should be rescheduled. "I'm not doing this"
is work that should stop consuming the week. Guessing wrong in one direction
makes the app nag about something abandoned; in the other it silently loses
something that mattered. Asking costs one tap.

---

## 2026-08-19 · Two-week planning horizon

**Decided:** plan and display 14 days, with weekly quotas repeating per week and
partial weeks scaled proportionally.

**Why:** found by using it. A one-week horizon meant everything past Sunday was
empty except the student's job, which reads as a broken app rather than an
unplanned one — and it hides exactly the crunch week worth seeing coming.

---

## 2026-08-19 · Installable web app, not React Native

**Decided:** ship as a PWA. Manifest, generated icons, standalone display, safe
area handling. It installs to the home screen, opens without browser chrome, and
gets its own icon and splash.

**Why:** it is most of what "it's an app" means to a student, it ships from the
codebase that already exists, and it took under an hour against a month or more
for a second native codebase. One place to fix a bug, no app store review, and a
change is live in 13 seconds.

**Rejected:** React Native, and any wrapper that produces a second codebase.

**Revisit when:** something genuinely needs native — push notifications at a
specific time, background sync, or a widget. A nudge at 9pm is the most likely
trigger, and it's worth noting that's a real product feature rather than a
technical itch. Not before people are actually using it.

---

## 2026-08-19 · Design tokens carry depth, and motion is real but small

**Decided:** three layered surface tokens rather than one, two shadow levels, a
single shared easing curve, and one 0.32s entrance animation.

**Why:** "make it look professional" is not a library you install. It's
typography that tightens as it scales, consistent focus states, tap targets that
don't flash grey on iOS, tabular numbers that don't reflow, and depth that
separates a designed interface from a form. All of it is tokens and a stylesheet.

**The one rule:** everything respects `prefers-reduced-motion`. Animation is a
finish, not a personality.

---

## 2026-08-19 · The repo is public

**Decided:** `bmwother1/quarterly` is public.

**Why:** the forcing reason was mechanical — Vercel's Hobby plan blocks Git
deployments from a private repo when it can't verify the commit author has
project access, and Hobby provides no way to grant it. Seven consecutive builds
were blocked. Public repos skip that check entirely.

**Why it's the right call anyway:** the privacy page asks students to hand over a
Canvas feed URL, which is a bearer credential for their whole schedule, and makes
specific claims about what happens to it. "Read the code yourself" turns those
claims from a promise into something checkable. That is worth more to the exact
person deciding whether to trust this than code secrecy is.

**Rejected:** Vercel Pro at $20/month, which fixes the same problem by paying for
it. Not warranted before a single retained user exists.

**Checked first:** full history scanned for credentials, env files and keys.
Clean — the only matches were prose about passwords in the privacy copy.

**Revisit if:** the scheduler's scoring weights ever become genuinely
proprietary. They aren't now, and the moat was never the code.

---

## 2026-08-18 · Ship with no signup, move to Supabase later

**Decided:** local-first with no account, behind a storage interface. Supabase
becomes a second adapter rather than a rewrite.

**Why the original argument changed:** the case for no-signup rested partly on
auth being a burden for a first-time builder. It isn't — Brydon runs Supabase
with RLS on another product. So the remaining argument is purely about the
student: an account wall in front of something a classmate mentioned once is the
single biggest drop-off point available.

**What it costs, and this is real:** no cross-device sync, and no usage data. The
metric that decides this whole project is week-4 retention, and right now nothing
measures it. That is why Supabase is next rather than eventually.

**Superseded:** the earlier "Open — needs a call" entry on this question.

---

## 2026-08-18 · No test framework, no build step in the domain layer

**Decided:** `node --test` with Node 24's native TypeScript execution. Zero test
dependencies.

**Why:** the domain layer runs unchanged in the terminal, in tests, and in the
browser. `npm run week` prints a real planned week, which is a faster and more
honest check on a scoring change than any assertion. Requires
`allowImportingTsExtensions` and real `.ts` extensions on relative imports.

---

## 2026-08-18 · Every scoring term is bounded

**Decided:** the roadmap's `urgency × weight × decay × fit × (1/confidence)`
shape is kept, but each term is clamped.

**Why:** an unbounded `1/confidence` means one assignment a student rated 0.05 on
swamps five real deadlines and the schedule stops looking sane. Legibility beats
optimality here — a student who can't see why a block is there won't follow it.

---

## 2026-08-18 · Past-due Canvas items are surfaced, not scheduled

**Decided:** `includeOverdue` defaults to false. Overdue work comes back in a
separate `overdue` list for the student to confirm.

**Why:** also found by building. The first real preview of a planned week was
about 90% work from three weeks ago. A Canvas feed carries 30 days of history and
says nothing about what was submitted, so scheduling it — at maximum urgency, by
construction — buries the actual week under work already handed in.

**Revisit when:** there's submission status from somewhere. The feed will never
provide it.

---

## 2026-08-18 · Tasks pick slots, not slots picking tasks

**Decided:** rank work by everything that doesn't depend on timing, then let each
piece choose the best hour still open to it.

**Why:** this was found by building, not by planning. The obvious implementation
— walk time forward, drop in whatever scores highest at each opening — passed 61
of 62 tests. The failure was that a student who declared themselves an evening
person still got exam prep at 8am. It wasn't a tuning problem: when slots pick
tasks, the energy-fit term can only ever break ties between things competing for
the same hour, and can never *move* work to a better one. The "tailored to the
student" promise was structurally inert.

**Rejected:** (a) leaving it and tuning the weights — the term had no mechanism
to act through; (b) a two-pass version that deferred poor-fit placements and then
back-filled — the second pass simply re-filled the slot the first pass declined.

**Cost:** the inversion was 20× slower (15ms → 384ms). Fixed by precomputing the
hour grid and keeping per-course spans sorted, back to ~21ms. The perf test
ceiling is pinned at 150ms so this can't silently regress.

---

## 2026-08-17 · Boring managed stack

**Decided:** Next.js + TypeScript + Tailwind, Vercel, Supabase when persistence
is needed.

**Why:** largest training corpus means AI assistance is most reliable here, which
matters more than elegance for a solo first-time build. No custom backend, no
containers, no CI/CD.

---

## 2026-08-17 · Web app first, not native mobile

**Decided:** responsive web app, "Add to Home Screen" for the app feel.

**Why:** works on every phone, no app store review, and a fix ships in 90 seconds
instead of three days. Native comes after product-market fit.

---

## 2026-08-17 · The scheduler is deterministic code, not an LLM call

**Decided:** scoring function plus greedy assignment, in plain TypeScript.

**Why:** LLMs are bad at constraint satisfaction, cost money per run, take
seconds, and are non-deterministic — meaning a student's week reshuffles on
refresh for no visible reason, and they stop trusting it. The current
implementation plans a full quarter in ~20ms and returns identical output for
identical input, which is asserted in a test.

**Rejected:** having a model produce the schedule directly.

**Where the LLM does belong:** parsing syllabi into topic maps, and eventually
richer "why this block" phrasing. Narrow jobs that play to what models are good
at. Note that the current `why` strings are template-generated, not model-
generated, and should stay that way unless there's a reason.

---

## 2026-08-17 · Use the Canvas calendar feed, not an agent that scrapes Canvas

**Decided:** students paste their own Canvas calendar feed URL. No scraping, no
credentials, no institutional integration.

**Why:** the feed is a public per-user iCal URL sitting in Canvas under Calendar
→ Calendar Feed. It carries assignments and due dates, needs zero approval, and
is exactly how Shovel does it. Copy-paste instead of a six-month negotiation.

**Rejected:** (a) an agent that logs into Canvas and scans it — violates
Instructure's terms, requires handling university credentials, and invites a
block from UW-IT; (b) UW's formal LMS Vendor Integration Program — up to six
months of data-privacy agreements, which is longer than the runway.

**Revisit when:** selling to the university itself, at which point the formal
route becomes an asset rather than an obstacle.
