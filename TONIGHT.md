# Tonight, about 20 minutes

Five things, in order. Steps 2 and 3 are the ones that matter; the rest is
plumbing. Delete this file once you've done them.

---

## 1 · Teach your terminal where Node is · 30 seconds

```
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
```

Then **close the terminal and open a new one**, and check:

```
node --version
```

You should see `v24.19.0`.

**Why:** Node is what runs JavaScript outside a browser — it's the engine under
the whole project. It's installed at `~/.local/node`, but your shell only looks
for programs in a specific list of folders and that isn't one of them. `PATH` is
that list. This line adds it permanently, so every future terminal knows. Without
it every command dies with `command not found`, which looks like a broken project
but is really just a lookup problem.

---

## 2 · Point it at your real Canvas feed · 5 minutes

Canvas → **Calendar** (left sidebar) → scroll the **right-hand** sidebar →
**Calendar Feed** → copy the URL.

```
cd ~/Desktop/quarterly && npm run feed -- "<paste your url>"
```

Keep the quotes.

**Why:** everything built so far has been checked against a sample quarter I
wrote. That sample is clean because I made it clean. Your real feed is the first
contact with reality — real Canvas data has odd course naming, assignments with
no due date, section codes, professors who name things strangely. This is how we
find out what the parser gets wrong, and it's cheaper to find out now than after
thirty students have signed up.

**If it's empty, that's expected.** Canvas only carries 30 days back and 366
forward, and it's August. An empty feed is still useful information — it tells us
what a new user sees if they sign up before their quarter loads.

> **Don't paste that URL into a chat, ever.** Anyone holding it can read your
> whole schedule. Tell me what you *saw*, not the link.

---

## 3 · Read your own week and judge it · 5 minutes

```
cd ~/Desktop/quarterly && npm run week -- "<same url>" --busy --energy evening
```

Swap `evening` for `morning` or `steady` — whichever you actually are.

**Why:** this is the product. You're the first user, and the question isn't "did
it run" — it's **would I actually follow this?** Your gut reaction is worth more
than another day of me tuning weights, because I've never been a student in your
courses.

Things worth noticing:

- Is anything scheduled at a genuinely stupid time?
- Are the sessions too long, or too short to be worth sitting down for?
- Does the "why this block" line under each one make sense, or read like filler?
- Is something obviously missing that you know you have to do?

Write down whatever annoys you. Annoyance is the most useful signal here.

---

## ~~4 · Correct the file about you~~ · done

Replaced with your own CLAUDE.md. No action needed.

---

## 5 · Push to GitHub · 2 minutes

You already have GitHub and Vercel from Prismwave, so this is just a repo.

```
cd ~/Desktop/quarterly && gh repo create quarterly --private --source=. --push
```

If `gh` isn't installed, make the repo in the browser and push the remote
manually. Keep it **private** for now: the fixtures are synthetic, but this
becomes a repo that handles student schedule data.

Grab **education.github.com/pack** if you haven't already. Free credits against
the six-month budget.

---

## 6 · Text five people · 5 minutes

Something like:

> hey — I'm building a thing for students trying to stay on top of coursework.
> can I ask you like 8 minutes of questions about how you actually plan your
> week? not selling anything, just need to know if I'm building the right thing.

**Why:** this is the only thing on the whole project that depends on other
people's calendars. Code I can write at any hour; twenty conversations take a
week no matter how fast either of us moves. Sending the texts tonight is what
makes those conversations happen *this* week instead of next.

Zero interviews have been done. It's the biggest hole in the project right now,
and it's the one thing I can't do for you.

---

## Then message me

Tell me:

1. Did the feed work, and how many assignments did it find?
2. What looked wrong or annoying in your week?

Then I'll build the interface — the screens that turn all of this into something
you can actually show someone.
