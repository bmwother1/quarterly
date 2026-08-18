# Status

**Updated: 2026-08-18** · 43 days to launch (September 30)

This file describes the present. It gets rewritten, not appended to.

---

## Right now

The domain layer is done and trustworthy. Canvas ingestion and the scheduling
engine are built, tested, and committed — 66 tests, no dependencies, no React.
Planning a full quarter takes ~21ms and is deterministic.

Nothing is on screen yet. The next stretch is all interface.

Zero student interviews done. That's the real risk on the board.

## Shipped

- **Canvas ingestion** — dependency-free iCal parser handling all three timestamp
  shapes including floating times across a DST boundary; course extraction, work
  classification, seed durations and grade weights, estimate revision from
  observed time
- **Scheduling engine** — scoring function, free-time discovery, greedy
  placement with constraints (deadline, busy time, daily cap, 20% buffer, 2-hour
  consecutive-course limit, exam sessions on separate days), generated per-block
  explanations, honest reporting of what didn't fit
- **Terminal tooling** — `npm run week` prints a real planned week; `npm run
  feed` prints raw Canvas deadlines and a workload-by-week chart
- **66 tests** covering timezone edges, every scheduling constraint, determinism,
  and a 150ms performance ceiling
- Next.js 16 / React 19 / Tailwind 4 scaffold, clean typecheck, lint, and build

## Next, in order

1. **Canvas feed proxy route** — the browser can't fetch the ICS directly (CORS),
   so a Next route handler fetches it server-side and returns parsed JSON
2. **Onboarding** — paste feed URL → see your courses and your quarter's workload
   chart. This screen is also the recruiting demo.
3. **Availability grid** — weekly click-and-drag to mark class, sleep, work
4. **Week view** — blocks with course, duration, method, and the "why now" line;
   mark done / skipped / partial; the **reschedule my week** button, which is the
   differentiating feature and does not get cut
5. **Local-first persistence** behind a storage interface
6. **Deploy** to a public URL and check it on a real phone

## Blocked on Brydon

- **Add Node to the shell.** The permission classifier blocked two attempts to
  write `~/.zshrc`. Until then every terminal needs
  `export PATH="$HOME/.local/node/bin:$PATH"`.
  ```
  echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
  ```
- **Run the planner against a real Canvas feed.** Everything so far is validated
  against fixtures. Don't paste the feed URL into a chat — it's a password.
  ```
  cd ~/Desktop/quarterly && npm run week -- "<your feed url>"
  ```
- **GitHub and Vercel accounts** before deploying. Account creation isn't
  something Claude can do.
- **Twenty interviews.** Not on the code critical path — run them in parallel,
  starting now.

## Open questions

- Ship with no signup at all? Recommended, not decided. See `decisions.md`.
- Nothing in the product has been seen by a student. Every design choice so far
  rests on research and reasoning, not observation.
