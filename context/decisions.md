# Decisions

Newest first. A decision belongs here if a reasonable person could have chosen
otherwise. Naming a variable is not a decision.

Format: what was decided, why, what was rejected, and what would make it worth
revisiting. When one is reversed, mark it **Superseded** and link forward — the
record of what was tried and abandoned is worth more than a tidy file.

---

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

---

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

---

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

---

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

---

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

## 2026-08-20 · Bottom tab bar, reversing the hamburger

**Decided:** three tabs fixed to the bottom on phones, inline links on laptops.
The hamburger built the day before is gone.

**Why, and this reverses a decision made on request:** the evidence is
one-sided. Bottom tab bars lift engagement up to 58% over hidden menus, feature
discovery rises 30%+ when apps switch, and users are 2–3× less likely to find
anything behind a hamburger at all. Google measured a 76% usage increase from
bottom-aligned navigation.

The ergonomic half decides it for this product specifically. A hamburger sits
top-right, the hardest place to reach one-handed, and a student checking their
next block on the walk to class has one thumb.

**Three tabs, not four.** Canvas is a once-ever setup action, so it lives inside
Plan rather than spending a permanent tab.

**Superseded:** the hamburger menu from 2026-08-19.

---

## 2026-08-20 · First run is two questions

**Decided:** `/start` asks what you want to make time for and how often, then
plans and drops you on the calendar. Everything else waits.

**Why:** time-to-first-value should land inside 60–90 seconds; past ten minutes
abandonment climbs steeply and past thirty it roughly triples. Motion's 2–4 week
setup is its single most-cited complaint across three review sites. The previous
route in was a five-section form — the same mistake in miniature.

Every setting except one already has a working default. The only input the
scheduler genuinely cannot invent is something to schedule, so it's the only
thing asked for.

**Measured:** two taps, three seconds, ten blocks on a real calendar. It was
three to five minutes.

**Canvas stays out of it.** Feeds are empty in August by construction, and it
asks for a credential to an entire schedule before the product has proven
anything — the worst possible moment to ask.

---

## 2026-08-20 · Sell surviving a bad week, not planning a good one

**Decided:** the landing page leads with "a plan that survives you falling
behind," and "no account needed" is a visible badge rather than a footnote.

**Why:** research into why students abandon planners produced three sentences
that describe this product's differentiators without knowing it exists — the
maintenance burden exceeding the value, the mid-week collapse forcing manual
rework or abandonment, and streaks punishing imperfection. The page was selling
"plans your hours," which is the half every competitor also claims.

Duolingo's largest measured onboarding lift (+20% DAU) came from putting value
before account creation. Quarterly has no account at all, which is the strongest
position in the category and was buried under a button.

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
