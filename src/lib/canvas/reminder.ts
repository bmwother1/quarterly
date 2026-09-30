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
