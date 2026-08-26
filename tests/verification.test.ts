import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CODE_LENGTH, MAX_ATTEMPTS, RESEND_COOLDOWN_S,
  classifyFailure, cooldownRemaining, freshVerifyState, isComplete, messageFor,
  normaliseCode, recordFailure, resetAfterResend,
} from '../src/lib/verification.ts';

describe('reading the code a student typed', () => {
  test('strips whatever came along with it', () => {
    // A code pasted out of a mail app routinely arrives with a trailing space,
    // a newline, or the words around it.
    assert.equal(normaliseCode('483 921'), '483921');
    assert.equal(normaliseCode(' 483921\n'), '483921');
    assert.equal(normaliseCode('code: 483921'), '483921');
    assert.equal(normaliseCode('483-921'), '483921');
  });

  test('never sends more than six digits', () => {
    assert.equal(normaliseCode('4839219999'), '483921');
    assert.equal(normaliseCode('483921').length, CODE_LENGTH);
  });

  test('an incomplete code is not submittable', () => {
    assert.equal(isComplete('4839'), false);
    assert.equal(isComplete(''), false);
    assert.equal(isComplete('483921'), true);
    assert.equal(isComplete('483 921'), true, 'spacing is not the student\'s problem');
  });
});

describe('telling a wrong code from an old one', () => {
  test('expiry and a wrong code are different failures', () => {
    // They need opposite advice. One says get a new code, the other says check
    // the one you have. Showing "invalid token" for both is how a student
    // concludes the app is broken.
    assert.equal(classifyFailure('Token has expired or is invalid'), 'expired');
    assert.equal(classifyFailure('Invalid token'), 'wrong');
    assert.equal(classifyFailure('Email rate limit exceeded'), 'rate-limited');
  });

  test('an unrecognised error is passed through, not dressed up', () => {
    // Inventing a friendly explanation for an error nobody has seen is how a
    // real failure gets hidden behind reassuring copy.
    assert.equal(classifyFailure('upstream connect error'), 'unknown');
    const state = freshVerifyState();
    assert.equal(
      messageFor('unknown', state, 'upstream connect error'),
      'upstream connect error',
    );
  });

  test('expiry says get a new one, and does not say the code was wrong', () => {
    const msg = messageFor('expired', freshVerifyState(), 'Token has expired');
    assert.match(msg, /expired/i);
    assert.doesNotMatch(msg, /isn't right/i);
  });
});

describe('running out of attempts', () => {
  test('three wrong tries exhausts it', () => {
    let s = freshVerifyState();
    assert.equal(s.exhausted, false);
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      s = recordFailure(s);
      assert.equal(s.exhausted, false, `attempt ${i + 1} should not lock`);
    }
    s = recordFailure(s);
    assert.equal(s.exhausted, true);
    assert.equal(s.attempts, MAX_ATTEMPTS);
  });

  test('once exhausted the message stops counting down and says what to do', () => {
    let s = freshVerifyState();
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = recordFailure(s);
    const msg = messageFor('wrong', s, 'Invalid token');
    assert.match(msg, /new one/i);
    assert.doesNotMatch(msg, /tries left/i);
  });

  test('the last attempt is phrased as the last one', () => {
    let s = freshVerifyState();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) s = recordFailure(s);
    assert.match(messageFor('wrong', s, 'Invalid token'), /one more try/i);
  });

  test('a fresh code clears the count, because the old code is dead anyway', () => {
    let s = freshVerifyState();
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = recordFailure(s);
    assert.equal(s.exhausted, true);

    const after = resetAfterResend();
    assert.equal(after.exhausted, false);
    assert.equal(after.attempts, 0);
  });

  test('exhaustion beats every other message', () => {
    // Whatever the server said, the useful instruction once locked out is the
    // same, and burying it under an expiry notice would strand the student.
    let s = freshVerifyState();
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = recordFailure(s);
    for (const f of ['wrong', 'expired', 'rate-limited', 'unknown'] as const) {
      assert.match(messageFor(f, s, 'anything'), /new one/i);
    }
  });
});

describe('the resend cooldown', () => {
  test('nothing sent yet means no waiting', () => {
    assert.equal(cooldownRemaining(null, Date.now()), 0);
  });

  test('a double tap is stopped', () => {
    const now = 1_000_000;
    assert.equal(cooldownRemaining(now, now), RESEND_COOLDOWN_S);
    assert.equal(cooldownRemaining(now, now + 500), RESEND_COOLDOWN_S);
  });

  test('it counts down and then clears', () => {
    const sent = 1_000_000;
    assert.equal(cooldownRemaining(sent, sent + 10_000), RESEND_COOLDOWN_S - 10);
    assert.equal(cooldownRemaining(sent, sent + RESEND_COOLDOWN_S * 1000), 0);
  });

  test('never goes negative, however long they waited', () => {
    const sent = 1_000_000;
    assert.equal(cooldownRemaining(sent, sent + 86_400_000), 0);
  });

  test('a clock that jumped backwards does not lock them out forever', () => {
    // Device clocks move. Returning a huge number here would disable the resend
    // button until the student closed the app.
    const sent = 1_000_000;
    const remaining = cooldownRemaining(sent, sent - 60_000);
    assert.ok(remaining <= RESEND_COOLDOWN_S, `got ${remaining}`);
  });
});
