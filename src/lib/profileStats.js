// Pure computations behind the profile experience: contribution tallies and
// the GitHub-style activity calendar. No fetching, no React — everything
// here is unit-testable (scripts/test-profile-stats.mjs) and shared by the
// private profile (/account) and the public profile pages, so both always
// agree on what the numbers mean.
//
// ACTIVITY RULE (one definition, used everywhere):
//   A day's activity = the number of contributions the account SUBMITTED
//   that day (created_at), regardless of current status. The calendar shows
//   work done, not outcomes — accepted/declined/deleted are visible in the
//   tallies instead. Entries with a missing created_at are ignored, never
//   bucketed into a fake "today" (unknown is not zero, and it is not now).

/** Tally contribution rows by status. Missing/unknown statuses are ignored. */
export function tallyContributions(rows) {
  const tally = { submitted: 0, accepted: 0, pending: 0, declined: 0, deleted: 0 };
  for (const row of rows ?? []) {
    tally.submitted += 1;
    if (tally[row.status] !== undefined) tally[row.status] += 1;
  }
  return tally;
}

/** 'YYYY-MM-DD' for a Date, in LOCAL time (the calendar is local-first). */
export const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Group contribution rows into per-day counts. Accepts either rows with a
 * `created_at`/`submitted_at` timestamp (own + public history shapes) or
 * pre-counted { date, count } pairs. Invalid/missing timestamps are skipped.
 */
export function activityByDay(rows) {
  const counts = new Map();
  for (const row of rows ?? []) {
    if (typeof row?.date === 'string' && Number.isFinite(row.count)) {
      counts.set(row.date, (counts.get(row.date) ?? 0) + row.count);
      continue;
    }
    const at = row?.created_at ?? row?.submitted_at ?? null;
    if (!at) continue;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Intensity level (0..4) for one day's count, given the month's maximum.
 * GitHub-style quartiles: 0 stays 0 (no activity), otherwise the count is
 * scaled against the busiest day of the visible month — an empty-but-active
 * month still shows its busiest day at full intensity.
 */
export function activityLevel(count, maxInMonth) {
  if (!count || count <= 0) return 0;
  if (!maxInMonth || maxInMonth <= 0) return 1;
  if (count >= maxInMonth) return 4;
  const ratio = count / maxInMonth;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/** First day (local midnight) of the month `offset` months from `today`. */
export function monthAnchor(offset = 0, today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

/** The number of months between two local months (a - b), for forward-limit math. */
export function monthsAway(month, today = new Date()) {
  return (month.getFullYear() - today.getFullYear()) * 12 + (month.getMonth() - today.getMonth());
}

/**
 * The grid for one calendar month: weeks of 7 days, Monday-first (GitHub
 * layout). Each cell: { key, date, inMonth, level, count } — out-of-month
 * cells carry inMonth: false and are rendered as blanks. `maxInMonth` comes
 * from activityByDay over the SAME month so levels are stable per view.
 */
export function monthGrid(month, activity, today = new Date()) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // Shift Sunday (0) to the end for a Monday-first week.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const keys = [...activity.keys()];
  const maxInMonth = keys.reduce((max, key) => {
    const d = new Date(`${key}T00:00:00`);
    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()
      ? Math.max(max, activity.get(key) ?? 0)
      : max;
  }, 0);

  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const key = dayKey(date);
    const count = activity.get(key) ?? 0;
    cells.push({
      key, date, inMonth: true,
      count,
      level: activityLevel(count, maxInMonth),
      future: date > today,
    });
  }
  // Pad the last week to a full 7 so the grid never has a ragged edge.
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
