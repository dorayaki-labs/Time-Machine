const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Accepts YYYY, YYYY-MM or YYYY-MM-DD. Returns { year, month, day } or null. */
export function parseDate(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : null;
  const day = m[3] ? Number(m[3]) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null && (day < 1 || day > 31)) return null;
  return { year, month, day };
}

export function releaseYear(release) {
  const p = parseDate(release?.date);
  return p ? p.year : null;
}

/** Sort key that keeps unknown dates last. Missing parts sort as the start of the period. */
export function releaseSortKey(release) {
  const p = parseDate(release?.date);
  if (!p) return Number.POSITIVE_INFINITY;
  return p.year * 10000 + (p.month ?? 0) * 100 + (p.day ?? 0);
}

export function formatRelease(release, fallback = 'Date unknown') {
  const p = parseDate(release?.date);
  if (!p) return fallback;
  if (p.month === null) return String(p.year);
  if (p.day === null) return `${MONTHS[p.month - 1]} ${p.year}`;
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

export function formatTimestamp(value) {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRuntime(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Runtime unknown';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m} min`;
}
