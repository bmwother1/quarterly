/**
 * Canvas items that are reminders, not work.
 *
 * Instructors post things like "Final Reminder to Complete Peer Feedback [Can't
 * Be Extended]" as assignments so they land on the calendar. They are not work:
 * the work is the peer feedback. Read as work, "Final" made one an exam, and
 * Brydon's first real week had eight study sessions for it, the top one billed
 * as "worth about 40% of your MGMT 305 grade".
 *
 * So a reminder gets no study time, no deadline flag, and a push notification
 * on the day instead, which is what the instructor meant by posting it.
 */
export function isReminder(title: string): boolean {
  return /\breminders?\b/i.test(title);
}

/**
 * A week planned before this rule, with the reminder's sessions taken out.
 *
 * The planner skips reminders, but only on a replan, and a student has no
 * reason to know they need one: Brydon's week kept eight "Final Reminder"
 * sessions after the fix shipped. So this runs wherever a stored week is read.
 * Planned sessions go; a session already answered stays, because it is history.
 * Returns the same object when there is nothing to do, so reading a clean week
 * costs no render.
 */
export function withoutReminderSessions<
  S extends {
    assignments: Array<{ id: string; title: string }>;
    blocks: Array<{ assignmentId: string | null; status: string }>;
    unscheduled: Array<{ assignmentId?: string | null }>;
  },
>(state: S): S {
  const ids = new Set(state.assignments.filter((a) => isReminder(a.title)).map((a) => a.id));
  if (ids.size === 0) return state;
  const stale = (id: string | null | undefined) => id != null && ids.has(id);
  const blocks = state.blocks.filter((b) => !(b.status === 'planned' && stale(b.assignmentId)));
  const unscheduled = state.unscheduled.filter((u) => !stale(u.assignmentId));
  if (blocks.length === state.blocks.length && unscheduled.length === state.unscheduled.length) return state;
  return { ...state, blocks, unscheduled };
}
