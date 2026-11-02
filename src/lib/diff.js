// Client-side mirror of the backend deep-diff: same semantics, used to
// preview "exactly what changed" before staff confirm an edit.

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function formatValue(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.length ? JSON.parse(JSON.stringify(v)) : [];
  if (isPlainObject(v)) return JSON.parse(JSON.stringify(v));
  return v;
}

function walk(before, after, path, out) {
  if (JSON.stringify(formatValue(before)) === JSON.stringify(formatValue(after))) return;
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) walk(before?.[key], after?.[key], path ? `${path}.${key}` : key, out);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
      const eq = JSON.stringify(formatValue(before[i])) === JSON.stringify(formatValue(after[i]));
      if (!eq) {
        if (isPlainObject(before[i]) && isPlainObject(after[i])) walk(before[i], after[i], `${path}.${i}`, out);
        else out.push({ field: `${path}.${i}`, before: formatValue(before[i]), after: formatValue(after[i]) });
      }
    }
    return;
  }
  out.push({ field: path || '(root)', before: formatValue(before), after: formatValue(after) });
}

export function deepDiff(before, after) {
  const out = [];
  walk(before, after, '', out);
  return out;
}

export const fmtChangeValue = (v, max = 120) => {
  const s = v === null || v === undefined ? 'null' : typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
