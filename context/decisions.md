# Decisions

Newest first. A decision belongs here if a reasonable person could have chosen
otherwise. Naming a variable is not a decision.

Format: what was decided, why, what was rejected, and what would make it worth
revisiting. When one is reversed, mark it **Superseded** and link forward — the
record of what was tried and abandoned is worth more than a tidy file.

---

## Open — needs a call

### Ship with no signup at all?

**Proposed:** everything in the browser, no account, no email. Data in local
storage behind an interface so Supabase can slot in later.

**For:** removes the single biggest drop-off point for a student trying something
a classmate mentioned, and removes an entire auth surface from a first build.

**Against:** no cross-device sync, and no usage data — which is awkward given
that week-4 retention is the metric that decides everything.

**Status:** recommended, not yet decided.

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
