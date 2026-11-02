// Deep, field-level diff of two JSON values. Produces a flat list of
// [{ field, before, after }] with dot-paths into arrays ("sources.1.data").
// This is the ONLY source of change records — never a human description.

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function formatValue(v) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (Array.isArray(v)) return v.length ? JSON.parse(JSON.stringify(v)) : [];
  if (isPlainObject(v)) return JSON.parse(JSON.stringify(v));
  return v;
}

function walk(before, after, path, out) {
  if (JSON.stringify(formatValue(before)) === JSON.stringify(formatValue(after))) return;

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      walk(before?.[key], after?.[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length);
    let changed = false;
    for (let i = 0; i < len; i++) {
      const eq = JSON.stringify(formatValue(before[i])) === JSON.stringify(formatValue(after[i]));
      if (!eq) {
        changed = true;
        if (isPlainObject(before[i]) && isPlainObject(after[i])) {
          walk(before[i], after[i], `${path}.${i}`, out);
        } else {
          out.push({ field: `${path}.${i}`, before: formatValue(before[i]), after: formatValue(after[i]) });
        }
      }
    }
    if (!changed) out.push({ field: path, before: formatValue(before), after: formatValue(after) });
    return;
  }

  out.push({ field: path || '(root)', before: formatValue(before), after: formatValue(after) });
}

/** Returns [{ field, before, after }] for every difference between two values. */
export function deepDiff(before, after) {
  const out = [];
  walk(before, after, '', out);
  return out;
}

/** Compact "field: before → after" lines for Discord embeds and tables. */
export function summarizeChanges(changes, { maxFields = 12, maxLen = 180 } = {}) {
  const shown = changes.slice(0, maxFields);
  const fmt = (v) => {
    const s = v === null || v === undefined ? 'null' : typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  };
  const lines = shown.map((c) => `• ${c.field}: ${fmt(c.before)} → ${fmt(c.after)}`);
  if (changes.length > maxFields) lines.push(`• …and ${changes.length - maxFields} more field(s)`);
  return lines;
}
