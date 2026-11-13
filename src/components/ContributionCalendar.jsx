// GitHub-style contribution calendar: one month at a time, Monday-first
// grid of activity squares. Month arrows page backwards freely and forwards
// only up to the current month (never into the future). Levels are theme
// accent mixes, so every theme — built-in or custom — renders correctly.
//
// What counts as activity is defined once in lib/profileStats.js:
// contributions SUBMITTED that day, regardless of outcome.

import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { monthAnchor, monthsAway, monthGrid, MONTH_LABELS, dayKey } from '@/lib/profileStats.js';

export default function ContributionCalendar({ activity, today = new Date(), className = '' }) {
  // Offset from the current month; never above 0 (never the future).
  const [offset, setOffset] = useState(0);
  const month = useMemo(() => monthAnchor(offset, today), [offset, today]);
  const weeks = useMemo(() => monthGrid(month, activity, today), [month, activity, today]);
  const label = `${MONTH_LABELS[month.getMonth()]} ${month.getFullYear()}`;
  const total = useMemo(() => {
    let sum = 0;
    for (const w of weeks) for (const c of w) if (c?.inMonth) sum += c.count;
    return sum;
  }, [weeks]);

  return (
    <div className={`contrib-calendar ${className}`}>
      <div className="contrib-calendar__head">
        <button type="button" className="icon-btn" aria-label="Previous month"
          onClick={() => setOffset((o) => o - 1)}>
          <Icon name="chevronLeft" size={17} />
        </button>
        <strong className="contrib-calendar__month" aria-live="polite">{label}</strong>
        <button type="button" className="icon-btn" aria-label="Next month" disabled={offset >= 0}
          title={offset >= 0 ? 'You are at the latest month' : undefined}
          onClick={() => setOffset((o) => Math.min(0, o + 1))}>
          <Icon name="chevronRight" size={17} />
        </button>
        <span className="contrib-calendar__total muted small">
          {total} {total === 1 ? 'contribution' : 'contributions'} this month
        </span>
      </div>
      <div className="contrib-calendar__grid" role="grid" aria-label={`Contribution activity for ${label}`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="contrib-calendar__weekday" aria-hidden="true">{d}</span>
        ))}
        {weeks.flat().map((cell, i) => (cell
          ? (
            <span
              key={cell.key}
              className={`contrib-calendar__cell${cell.future ? ' is-future' : ''}${cell.count ? ` is-l${cell.level}` : ''}`}
              role="gridcell"
              aria-label={cell.count
                ? `${cell.count} ${cell.count === 1 ? 'contribution' : 'contributions'} on ${cell.date.toLocaleDateString(undefined, { dateStyle: 'long' })}`
                : `No contributions on ${cell.date.toLocaleDateString(undefined, { dateStyle: 'long' })}`}
              title={cell.count
                ? `${cell.count} ${cell.count === 1 ? 'contribution' : 'contributions'} · ${cell.date.toLocaleDateString(undefined, { dateStyle: 'medium' })}`
                : undefined}
            />
          )
          : <span key={`pad-${i}`} className="contrib-calendar__cell is-pad" aria-hidden="true" />
        ))}
      </div>
      <div className="contrib-calendar__legend muted small" aria-hidden="true">
        <span>Less</span>
        <span className="contrib-calendar__cell" />
        <span className="contrib-calendar__cell is-l1" />
        <span className="contrib-calendar__cell is-l2" />
        <span className="contrib-calendar__cell is-l3" />
        <span className="contrib-calendar__cell is-l4" />
        <span>More</span>
      </div>
    </div>
  );
}

export { dayKey };
