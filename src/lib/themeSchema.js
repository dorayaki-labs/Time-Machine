// Theme schema: the contract between the Customization Studio, the theme
// storage and the document. Everything a theme can customize is declared
// here once — its bounds, its CSS variable, and how it is validated — so the
// editor, the exporter and the importer can never disagree about what a
// theme is.
//
// A theme is: a built-in base (one of the :root[data-theme] palettes in
// variables.css) + a partial `settings` object that overrides individual
// tokens. Anything the settings leave out simply keeps the base value, so a
// theme can be as small as "the light theme, but with a green accent".

export const SCHEMA_VERSION = 1;
export const THEME_FORMAT = 'time-machine-theme';

// ---------------------------------------------------------------------------
// Built-in bases (ids must match the :root[data-theme] blocks and THEMES in
// useTheme.js)
// ---------------------------------------------------------------------------

export const BASE_THEMES = [
  { id: 'light', label: 'Classic Light', dark: false, swatch: ['#f4f1ea', '#2b5d8f'] },
  { id: 'dark', label: 'Classic Dark', dark: true, swatch: ['#151a22', '#8fb8e3'] },
  { id: 'midnight', label: 'Midnight', dark: true, swatch: ['#0d1220', '#7aa5e8'] },
  { id: 'sakura', label: 'Sakura', dark: false, swatch: ['#faf3f4', '#c25574'] },
  { id: 'ocean', label: 'Ocean', dark: true, swatch: ['#071824', '#4cc9d9'] },
  { id: 'forest', label: 'Forest', dark: true, swatch: ['#10160f', '#93c78e'] },
  { id: 'amethyst', label: 'Amethyst', dark: true, swatch: ['#14101d', '#b79aec'] },
  { id: 'glass', label: 'GlassMorphism', dark: true, swatch: ['#0b1420', '#6cc6e8'] },
];

export const isBaseThemeId = (id) => BASE_THEMES.some((t) => t.id === id);

// ---------------------------------------------------------------------------
// Color tokens. `softOf` marks the accent: --accent-soft/--accent-line are
// derived from it with color-mix when the accent is overridden, so tinted
// chips and focus rings follow the user's accent automatically.
// ---------------------------------------------------------------------------

export const COLOR_GROUPS = [
  {
    id: 'base', label: 'Backgrounds & surfaces',
    colors: [
      { key: 'bg', label: 'Page background', css: '--bg' },
      { key: 'bg2', label: 'Recessed background', css: '--bg-2' },
      { key: 'surface', label: 'Surface', css: '--surface' },
      { key: 'surface2', label: 'Raised surface', css: '--surface-2' },
      { key: 'surface3', label: 'Highest surface', css: '--surface-3' },
      { key: 'border', label: 'Border', css: '--border' },
      { key: 'borderStrong', label: 'Strong border', css: '--border-strong' },
    ],
  },
  {
    id: 'text', label: 'Text',
    colors: [
      { key: 'text', label: 'Text', css: '--text' },
      { key: 'text2', label: 'Secondary text', css: '--text-2' },
      { key: 'text3', label: 'Faint text', css: '--text-3' },
    ],
  },
  {
    id: 'accent', label: 'Accent',
    colors: [
      { key: 'accent', label: 'Accent', css: '--accent', softOf: 'accent' },
      { key: 'accentHover', label: 'Accent hover', css: '--accent-hover' },
      { key: 'onAccent', label: 'Text on accent', css: '--on-accent' },
    ],
  },
  {
    id: 'status', label: 'Status colours',
    colors: [
      { key: 'ok', label: 'Success / available', css: '--ok' },
      { key: 'warn', label: 'Warning / partial', css: '--warn' },
      { key: 'bad', label: 'Error / lost', css: '--bad' },
      { key: 'review', label: 'Review', css: '--review' },
    ],
  },
];

export const COLOR_KEYS = Object.fromEntries(
  COLOR_GROUPS.flatMap((g) => g.colors.map((c) => [c.key, c])),
);

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const isValidColor = (value) => typeof value === 'string' && HEX_RE.test(value.trim());

// ---------------------------------------------------------------------------
// Font stacks. All four ship with the site already — no font downloads are
// ever triggered by switching families.
// ---------------------------------------------------------------------------

export const FONT_OPTIONS = [
  { value: 'grotesk', label: 'Space Grotesk', stack: "'Space Grotesk', 'Noto Sans JP', system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { value: 'system', label: 'System UI', stack: "system-ui, -apple-system, 'Segoe UI', 'Space Grotesk', 'Noto Sans JP', sans-serif" },
  { value: 'noto', label: 'Noto Sans (rounded)', stack: "'Noto Sans JP', 'Space Grotesk', system-ui, sans-serif" },
  { value: 'serif', label: 'Serif', stack: "Georgia, 'Times New Roman', 'Noto Sans JP', serif" },
];

const fontStack = (value) => FONT_OPTIONS.find((f) => f.value === value)?.stack;

// ---------------------------------------------------------------------------
// Enum options
// ---------------------------------------------------------------------------

export const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact', multiplier: 0.88 },
  { value: 'comfortable', label: 'Comfortable', multiplier: 1 },
  { value: 'spacious', label: 'Spacious', multiplier: 1.14 },
];

export const SHADOW_OPTIONS = [
  { value: 'soft', label: 'Soft (default)' },
  { value: 'none', label: 'None' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
];

export const GLASS_OPTIONS = [
  { value: 'balanced', label: 'Balanced (default)' },
  { value: 'none', label: 'Solid' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'prominent', label: 'Prominent' },
];

export const MOTION_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'none', label: 'None' },
];

// ---------------------------------------------------------------------------
// The settings schema. `apply` converts a value into the CSS custom
// properties / data attributes the document understands. Bounds are enforced
// here, in one place, for both the editor and the importer.
// ---------------------------------------------------------------------------

const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export const SETTINGS_SCHEMA = {
  typography: {
    label: 'Typography',
    fields: {
      fontFamily: {
        label: 'Font family', type: 'enum', options: FONT_OPTIONS, default: 'grotesk',
        apply: (v, vars) => { vars['--font'] = fontStack(v) ?? fontStack('grotesk'); },
      },
      baseSize: {
        label: 'Base text size', type: 'range', min: 15, max: 18, step: 0.5, default: 16, unit: 'px',
        apply: (v, vars) => { vars['--fs-base'] = `${num(v, 15, 18, 16)}px`; },
      },
    },
  },
  layout: {
    label: 'Layout',
    fields: {
      density: {
        label: 'Spacing density', type: 'enum', options: DENSITY_OPTIONS, default: 'comfortable',
        apply: (v, vars) => {
          const m = DENSITY_OPTIONS.find((d) => d.value === v)?.multiplier ?? 1;
          vars['--density'] = String(m);
        },
      },
      contentWidth: {
        label: 'Content width', type: 'range', min: 1040, max: 1440, step: 20, default: 1200, unit: 'px',
        apply: (v, vars) => { vars['--max'] = `${num(v, 1040, 1440, 1200)}px`; },
      },
    },
  },
  surfaces: {
    label: 'Surfaces',
    fields: {
      radius: {
        label: 'Corner radius', type: 'range', min: 4, max: 22, step: 1, default: 12, unit: 'px',
        apply: (v, vars) => {
          const r = num(v, 4, 22, 12);
          vars['--r-sm'] = `${Math.max(2, Math.round(r * 0.66))}px`;
          vars['--r-md'] = `${r}px`;
          vars['--r-lg'] = `${Math.round(r * 1.5)}px`;
        },
      },
      shadow: {
        label: 'Shadows', type: 'enum', options: SHADOW_OPTIONS, default: 'soft',
        apply: (v, vars) => {
          const shadows = {
            none: { soft: '0 0 0 rgba(0,0,0,0)', card: '0 0 0 rgba(0,0,0,0)' },
            soft: { soft: '0 10px 34px rgba(0,0,0,0.14)', card: '0 5px 18px rgba(0,0,0,0.09)' },
            medium: { soft: '0 14px 44px rgba(0,0,0,0.2)', card: '0 8px 24px rgba(0,0,0,0.13)' },
            strong: { soft: '0 18px 56px rgba(0,0,0,0.3)', card: '0 12px 30px rgba(0,0,0,0.2)' },
          }[v] ?? {};
          Object.assign(vars, {
            '--shadow-soft': shadows.soft,
            '--shadow-card': shadows.card,
          });
        },
      },
      glass: {
        label: 'Glass effect', type: 'enum', options: GLASS_OPTIONS, default: 'balanced',
        apply: (v, vars) => {
          const blur = { none: 0, subtle: 5, balanced: 10, prominent: 18 }[v] ?? 10;
          vars['--glass-blur'] = `${blur}px`;
          // Solid mode swaps the translucent scrims for readable opaque ones.
          vars['--overlay-tint'] = blur === 0 ? 'rgba(0, 0, 0, 0.5)' : 'color-mix(in srgb, var(--bg) 55%, rgba(0, 0, 0, 0.45))';
          vars['--search-tint'] = blur === 0 ? 'var(--bg)' : 'color-mix(in srgb, var(--bg) 72%, transparent)';
        },
      },
      grain: {
        label: 'Paper grain background', type: 'toggle', default: true,
        apply: (v, _vars, attrs) => { attrs['data-grain'] = v ? 'on' : 'off'; },
      },
    },
  },
  catalogue: {
    label: 'Catalogue cards',
    fields: {
      cardSize: {
        label: 'Card size', type: 'range', min: 170, max: 300, step: 10, default: 230, unit: 'px',
        help: 'How wide the smallest episode or movie card is allowed to be.',
        apply: (v, vars) => { vars['--card-min'] = `${num(v, 170, 300, 230)}px`; },
      },
      showDescriptions: {
        label: 'Card descriptions', type: 'toggle', default: true,
        apply: (v, _vars, attrs) => { attrs['data-cards-desc'] = v ? 'on' : 'off'; },
      },
      hoverLift: {
        label: 'Hover lift on cards', type: 'toggle', default: true,
        apply: (v, _vars, attrs) => { attrs['data-hover-lift'] = v ? 'on' : 'off'; },
      },
    },
  },
  motion: {
    label: 'Motion',
    fields: {
      level: {
        label: 'Animation level', type: 'enum', options: MOTION_OPTIONS, default: 'standard',
        help: 'Your system’s reduced-motion setting always wins over this.',
        apply: (v, _vars, attrs) => { attrs['data-motion'] = v; },
      },
    },
  },
  accessibility: {
    label: 'Accessibility',
    fields: {
      underlineLinks: {
        label: 'Always underline links', type: 'toggle', default: false,
        apply: (v, _vars, attrs) => { attrs['data-underline-links'] = v ? 'on' : 'off'; },
      },
      strongFocus: {
        label: 'Stronger focus outlines', type: 'toggle', default: false,
        apply: (v, _vars, attrs) => { attrs['data-strong-focus'] = v ? 'on' : 'off'; },
      },
    },
  },
};

// Colors are handled separately (they are a flat map, not grouped fields).
export const EMPTY_SETTINGS = () => {
  const settings = { colors: {} };
  for (const group of Object.values(SETTINGS_SCHEMA)) {
    for (const key of Object.keys(group.fields)) settings[key] = {};
  }
  return settings;
};

export const defaultSetting = (groupKey, fieldKey) => SETTINGS_SCHEMA[groupKey]?.fields[fieldKey]?.default;

/** Which CSS variable a color override lands on. */
export const colorVar = (key) => COLOR_KEYS[key]?.css;

/** All colour keys that carry a --var (for iterating a theme). */
export const COLOR_VAR_ENTRIES = Object.entries(COLOR_KEYS).map(([key, def]) => [key, def.css, def.softOf]);

// ---------------------------------------------------------------------------
// Turning a theme into document state
// ---------------------------------------------------------------------------

/**
 * Computes the inline CSS custom properties and data attributes for a theme.
 * Returns { vars: Record<string,string>, attrs: Record<string,string> }.
 * Only values actually present in `settings` are produced; the base theme
 * block in variables.css supplies everything else.
 */
export function themeToStyle({ settings }) {
  const vars = {};
  const attrs = {};

  for (const [key, value] of Object.entries(settings.colors ?? {})) {
    const def = COLOR_KEYS[key];
    if (def && isValidColor(value)) vars[def.css] = value.trim();
  }
  const accent = settings.colors?.accent;
  if (isValidColor(accent)) {
    vars['--accent-soft'] = `color-mix(in srgb, ${accent.trim()} 10%, transparent)`;
    vars['--accent-line'] = `color-mix(in srgb, ${accent.trim()} 40%, transparent)`;
  }

  for (const [groupKey, group] of Object.entries(SETTINGS_SCHEMA)) {
    for (const [fieldKey, field] of Object.entries(group.fields)) {
      const value = settings[groupKey]?.[fieldKey];
      if (value === undefined || value === null) continue;
      field.apply(value, vars, attrs);
    }
  }
  return { vars, attrs };
}

// ---------------------------------------------------------------------------
// Validation (import + save). Unknown keys are dropped, out-of-range numbers
// are clamped, bad colours are rejected — a hostile or hand-edited file can
// never inject CSS or code, because only values from the schema above ever
// reach the document.
// ---------------------------------------------------------------------------

export function validateSettings(input, { collect = null } = {}) {
  const clean = { colors: {} };
  let dropped = collect?.dropped ?? 0;

  for (const [key, value] of Object.entries(input?.colors ?? {})) {
    if (COLOR_KEYS[key] && isValidColor(value)) clean.colors[key] = value.trim();
    else dropped += 1;
  }

  for (const [groupKey, group] of Object.entries(SETTINGS_SCHEMA)) {
    clean[groupKey] = {};
    const raw = input?.[groupKey] ?? {};
    for (const [fieldKey, field] of Object.entries(group.fields)) {
      const value = raw[fieldKey];
      if (value === undefined || value === null || value === '') continue;
      if (field.type === 'enum') {
        if (field.options.some((o) => o.value === value)) clean[groupKey][fieldKey] = value;
        else dropped += 1;
      } else if (field.type === 'range') {
        clean[groupKey][fieldKey] = num(value, field.min, field.max, field.default);
      } else if (field.type === 'toggle') {
        clean[groupKey][fieldKey] = Boolean(value);
      }
    }
    for (const key of Object.keys(raw)) {
      if (!(key in group.fields)) dropped += 1;
    }
  }
  for (const key of Object.keys(input?.colors ?? {})) {
    if (!COLOR_KEYS[key]) dropped += 1;
  }

  if (collect) collect.dropped = dropped;
  return clean;
}

const cleanName = (value, fallback) => {
  const name = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60);
  return name || fallback;
};

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme';

/**
 * Validates a whole imported theme file. Returns
 * { ok, theme, dropped } — theme is a ready-to-save custom theme object.
 * Never throws: every problem is reported through the result.
 */
export function parseThemeFile(json) {
  const result = { ok: false, theme: null, dropped: 0, error: null, version: null };

  let data;
  try {
    data = JSON.parse(json);
  } catch {
    result.error = 'That file is not valid JSON.';
    return result;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    result.error = 'That file does not contain a theme object.';
    return result;
  }
  if (data.format !== THEME_FORMAT) {
    result.error = 'That file is not a Time Machine theme (missing "format": "time-machine-theme").';
    return result;
  }
  result.version = data.schemaVersion;
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) {
    result.error = 'The theme file has no valid schema version.';
    return result;
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    result.error = `That theme was made for a newer version of Time Machine (schema ${data.schemaVersion}; this site understands ${SCHEMA_VERSION}).`;
    return result;
  }

  const base = isBaseThemeId(data.baseTheme) ? data.baseTheme
    : (BASE_THEMES.find((t) => t.dark === false).id);
  const baseDroppedBase = isBaseThemeId(data.baseTheme) ? 0 : 1;

  const collect = { dropped: baseDroppedBase };
  const settings = validateSettings(data.settings, { collect });

  result.theme = {
    id: `custom:${crypto.randomUUID?.() ?? `f${Date.now()}${Math.random().toString(36).slice(2, 8)}`}`,
    name: cleanName(data.name, 'Imported theme'),
    description: cleanName(data.description, ''),
    baseTheme: base,
    settings,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  result.dropped = collect.dropped;
  result.ok = true;
  return result;
}

/** Serialises a custom theme into the portable JSON file format. */
export function serializeTheme(theme) {
  return JSON.stringify({
    format: THEME_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    name: theme.name,
    description: theme.description || '',
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
    baseTheme: theme.baseTheme,
    settings: theme.settings,
  }, null, 2);
}

export const themeFileName = (theme) => `${slugify(theme.name)}.json`;

// ---------------------------------------------------------------------------
// Contrast (WCAG 2.x relative luminance) for the editor's warnings
// ---------------------------------------------------------------------------

function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  if (!isValidColor(a) || !isValidColor(b)) return null;
  const l1 = luminance(a.trim());
  const l2 = luminance(b.trim());
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads the effective (override-aware) value of a CSS variable. */
export function effectiveVar(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || null;
}
