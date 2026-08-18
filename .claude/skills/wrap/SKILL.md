---
name: wrap
description: End-of-session ritual for the Quarterly project — updates the context/ files (sessions, decisions, learned, status) and regenerates the Cowork handoff brief. Use when the user says they're wrapping up, ending a session, "update the context", "log this session", or invokes /wrap.
---

# Wrap up a session

Update `context/` so the next session — in Claude Code or in Cowork — starts warm
instead of cold.

## First, work out what actually happened

Don't ask the user to summarise. Look:

```bash
git log --oneline -15
git diff --stat HEAD~1
```

Combine that with the conversation. You're looking for four different things, and
most sessions produce only some of them:

- **Events** — what was built, fixed, tried
- **Decisions** — choices where a reasonable person could have gone the other way
- **Findings** — things discovered, especially ones that contradicted the plan
- **State changes** — what's now shipped, next, or blocked

## Then update, in this order

### 1. `context/sessions.md` — always

Add an entry at the top, under the header. Format:

```
## YYYY-MM-DD · Claude Code · Short title
```

Three or four sentences. What happened, what changed, what's true now that wasn't
before. Not a changelog — `git log` already is one. If something surprising
happened, that's the sentence worth keeping.

### 2. `context/decisions.md` — only if a decision was made

Append a dated entry with: what was decided, why, what was rejected, and what
would make it worth revisiting. Skip this entirely on a session that was only
execution. Most sessions don't produce a decision, and inventing one dilutes the
file.

If a previous decision was reversed, mark the old one **Superseded** and link
forward. Don't delete it — knowing what was tried and abandoned is the point.

### 3. `context/learned.md` — only if something was discovered

Under `From students`, `From building`, or `From research`. The bar is that it
cost something to obtain and would cost the same again to rediscover.

Prefer entries that begin "this didn't work." A file of only wins will
confidently repeat a mistake.

### 4. `context/status.md` — always

**Rewrite the top sections**, don't append — this file describes the present.
Update the date and the days-to-launch count (launch is 2026-09-30). Move things
between Shipped / Next / Blocked on Brydon. Be honest about what's blocked and
why.

### 5. Regenerate the brief

```bash
export PATH="$HOME/.local/node/bin:$PATH" && npm run handoff
```

### 6. Commit

Commit the context updates with the session's work if it isn't committed already.

## Then tell the user

Two or three sentences: what was logged, and anything now sitting in "blocked on
Brydon". If `HANDOFF.md` changed materially, mention that it's ready to paste
into a Cowork chat.

## Keep it honest

If the session went badly, log that it went badly. A context system that only
records progress is one that will cheerfully lead the next session into the same
wall.

If nothing meaningful happened, say so and write a one-line session entry rather
than padding it out.

## Pruning

When `sessions.md` passes about 15 entries, compress the oldest into a single
paragraph under a `## Earlier` heading and delete the individual entries.
