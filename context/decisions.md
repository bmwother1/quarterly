# Decisions

Newest first. A decision belongs here if a reasonable person could have chosen
otherwise. Naming a variable is not a decision.

Format: what was decided, why, what was rejected, and what would make it worth
revisiting. When one is reversed, mark it **Superseded** and link forward — the
record of what was tried and abandoned is worth more than a tidy file.

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
