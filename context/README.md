# The context system

Shared memory between Claude Code (building) and Cowork (thinking, research,
documents). The point is that neither one starts cold, and neither one re-derives
what the other already worked out.

## The files

| File | What's in it | Changes |
|---|---|---|
| `founder.md` | Who Brydon is, what he can build, how he wants to work | Rarely |
| `product.md` | What Quarterly is, who it's for, why it can win | Rarely |
| `decisions.md` | Every real decision, why, and what was rejected | Append |
| `learned.md` | Evidence — from research, from building, from students | Append |
| `status.md` | What's shipped, what's next, what's blocked | Every session |
| `sessions.md` | One short entry per session, newest first | Every session |
| `roadmap.md` | What gets built next, and what the retention number decides | Rarely |
| `HANDOFF.md` | Generated. The single file to paste into a Cowork chat | `npm run handoff` |

## Reading it efficiently

This matters more than it sounds. Loading all seven files into every conversation
is how a context system stops being useful — it crowds out the actual work and
costs money on every turn.

`/CLAUDE.md` at the repo root is the only file that loads automatically. It's
deliberately short. Everything else is read **on demand**, using this routing:

| If the work is… | Read |
|---|---|
| Writing or changing code | `status.md`, then `decisions.md` |
| "Why is it built this way?" | `decisions.md` only |
| "Should we build X?" | `product.md`, `decisions.md` |
| Pitching, applying, writing copy | `product.md`, `learned.md` |
| Picking up after a break | `status.md`, `sessions.md` |
| Starting a Cowork chat | paste `HANDOFF.md` |

Don't read a file speculatively. If the routing table doesn't point at it, it
isn't needed.

## Updating it

At the end of a working session, run the `/wrap` skill. It reads what changed and
writes the updates. Roughly:

1. **`sessions.md`** — one entry: what happened, what it cost, what's true now
   that wasn't before. Three or four sentences, not a changelog.
2. **`decisions.md`** — only if a real decision was made. A decision is something
   a reasonable person could have done differently. Naming a variable isn't one.
3. **`learned.md`** — only if something was *discovered*, especially something
   that contradicted the plan. Findings that cost effort to obtain go here so
   they're never paid for twice.
4. **`status.md`** — rewrite the top section. This file describes the present, so
   it gets replaced rather than appended.
5. **`npm run handoff`** — regenerate the Cowork brief.

## Two rules that keep it honest

**Write what's true, including when it's unflattering.** A context file that only
records wins is one that will confidently repeat a mistake. The most valuable
entries in `learned.md` are the ones that begin "this didn't work."

**Prune.** Append-only files rot. When `sessions.md` passes about 15 entries,
compress the oldest into a single paragraph and delete them. When a decision is
reversed, don't delete it — mark it superseded and link to the replacement.
Knowing what was tried and abandoned is worth more than a tidy file.
