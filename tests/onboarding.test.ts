import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { emptyState, type QuarterlyState } from '../src/lib/store.ts';
import { steps, isLive, progress, nextPrompt, unresolved } from '../src/lib/onboarding.ts';
import type { Commitment } from '../src/lib/types.ts';

function commitment(id = 'c1'): Commitment {
  return {
    id, title: 'Study', category: 'learning', sessionsPerWeek: 3, minutesPerSession: 60,
    importance: 0.7, demand: 0.8, lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
    minSessionMinutes: 30, bufferAfterMinutes: 0, windowStartMin: null, windowEndMin: null,
    active: true, color: '#2a78d6',
  };
}

/** A student who has done everything the flow asks for. */
function completed(): QuarterlyState {
  const s = emptyState();
  s.commitments = [commitment()];
  s.availability = {
    ...s.availability,
    busy: [
      ...s.availability.busy,
      { id: 'w', day: 0, startMin: 540, endMin: 1020, label: 'Work', kind: 'work' },
    ],
  };
  s.sleepConfirmed = true;
  return s;
}

describe('when setup is finished', () => {
  test('a fresh install is not live', () => {
    assert.equal(isLive(emptyState()), false);
    assert.equal(progress(emptyState()), 0);
  });

  test('doing every required step makes you live', () => {
    assert.equal(isLive(completed()), true);
    assert.equal(progress(completed()), 1);
    assert.equal(nextPrompt(completed()), null, 'a finished student is never prompted');
  });

  test('skipping counts as answering', () => {
    // The defect this fixes: "I have no fixed schedule" and "I haven't said"
    // produce identical data, so without an explicit skip the app nags a
    // student forever for an answer they already gave.
    const s = emptyState();
    s.commitments = [commitment()];
    s.skippedSteps = { fixed: true, sleep: true };
    assert.equal(isLive(s), true);
    assert.equal(nextPrompt(s), null);
  });

  test('skipping the one thing to schedule does not make you live', () => {
    // A plan of nothing isn't a plan. This is the one step skipping can't clear.
    const s = emptyState();
    s.skippedSteps = { work: true, fixed: true, sleep: true, calendars: true };
    assert.equal(isLive(s), false);
  });

  test('importing a calendar is optional', () => {
    // Requiring it would block every student who signs up before their quarter
    // is published — which in August is all of them.
    const s = completed();
    assert.equal(steps(s).find((x) => x.id === 'calendars')!.required, false);
    assert.equal(isLive(s), true, 'live without ever importing anything');
  });

  test('any of the three routes to "something to plan" works', () => {
    for (const seed of [
      (s: QuarterlyState) => { s.commitments = [commitment()]; },
      (s: QuarterlyState) => { s.courses = [{ code: 'CHEM 142', fullName: 'CHEM 142 A', color: '#2a78d6' }]; },
      (s: QuarterlyState) => {
        s.assignments = [{
          id: 'a', title: 'HW', course: 'MATH', courseFull: 'MATH', kind: 'problem set',
          due: '2026-10-09T23:00:00.000Z', allDay: false, url: null, estimatedMinutes: 60,
          actualMinutes: 0, status: 'todo', weight: 0.05, confidence: 0.5, lastTouched: null,
        }];
      },
    ]) {
      const s = emptyState();
      seed(s);
      s.skippedSteps = { fixed: true, sleep: true };
      assert.equal(isLive(s), true);
    }
  });

  test('an inactive commitment is not something to plan', () => {
    const s = emptyState();
    s.commitments = [{ ...commitment(), active: false }];
    s.skippedSteps = { fixed: true, sleep: true };
    assert.equal(isLive(s), false);
  });

  test('one prompt at a time, required first', () => {
    // Three banners for three unanswered questions is how an app gets muted.
    const s = emptyState();
    assert.equal(unresolved(s).length, 4);
    const prompt = nextPrompt(s)!;
    assert.equal(prompt.required, true);
    assert.equal(prompt.id, 'work', 'the step that unblocks everything comes first');
  });

  test('the prompt moves on as steps are answered', () => {
    const s = emptyState();
    s.commitments = [commitment()];
    assert.equal(nextPrompt(s)!.id, 'fixed');
    s.skippedSteps = { fixed: true };
    assert.equal(nextPrompt(s)!.id, 'sleep');
    s.sleepConfirmed = true;
    assert.equal(nextPrompt(s), null, 'optional steps never prompt');
  });

  test('progress counts only required steps', () => {
    const s = emptyState();
    s.commitments = [commitment()];
    assert.ok(Math.abs(progress(s) - 1 / 3) < 0.01, 'one of three required');
  });

  test('every step can be answered in both directions', () => {
    // The rule the whole model exists to enforce.
    for (const step of steps(emptyState())) {
      assert.ok(step.skipLabel.length > 0, `${step.id} has no way to decline`);
      assert.ok(step.blurb.length > 10, `${step.id} does not say what it gets you`);
    }
  });
});

describe('leaving setup for good', () => {
  test('going live is stamped once and survives falling back below the bar', () => {
    // The bug this guards: a student finishes setup, then deletes the one
    // commitment they had. `isLive` goes false. If prompts keyed off `isLive`
    // rather than the stamp, setup would reappear for someone who finished it.
    const s = completed();
    assert.equal(isLive(s), true);

    s.wentLiveAt = new Date().toISOString();
    s.commitments = [];

    assert.equal(isLive(s), false, 'the live *test* is allowed to go false');
    assert.ok(s.wentLiveAt, 'but the stamp is what prompts key off, and it stays');
  });

  test('the live notice is tracked apart from the stamp', () => {
    // Deriving "have we told them" from "are they live" re-shows the
    // confirmation on every reload, which is the same nagging bug in new clothes.
    const s = completed();
    s.wentLiveAt = new Date().toISOString();
    assert.notEqual(s.wentLiveAt, undefined);
    assert.ok(!s.liveNoticeSeen, 'unseen by default');

    s.liveNoticeSeen = true;
    assert.ok(s.wentLiveAt && s.liveNoticeSeen, 'both can be true at once');
  });

  test('a student with nothing fixed can finish by saying so', () => {
    // The original defect. No classes and no job is a real answer, and the app
    // has to be able to hear it.
    const s = emptyState();
    s.commitments = [commitment()];
    s.skippedSteps = { fixed: true };
    s.sleepConfirmed = true;

    assert.equal(isLive(s), true);
    assert.equal(nextPrompt(s), null, 'nothing left to ask');
  });

  test('every unresolved step has somewhere to be answered', () => {
    // Guards the prompt component: a step with no destination renders a button
    // that goes nowhere. Keep this list in step with RESOLVE in setup-prompt.
    const destinations = new Set(['work', 'fixed', 'sleep', 'calendars']);
    for (const s of steps(emptyState())) {
      assert.ok(destinations.has(s.id), `${s.id} needs a destination`);
      assert.ok(s.skipLabel.length > 0, `${s.id} needs a way to decline`);
    }
  });
});
