// Unified app settings: behaviour and layout preferences that are NOT part
// of a visual theme (the Customisation Studio owns the looks; this owns the
// "how does the site behave" side — top bar layout, optional buttons,
// popups). Kept deliberately tiny: one schema, one storage key, one context.

import { NAV_ITEMS } from '@/components/navItems.js';

export const APP_SETTINGS_KEY = 'tm.app.settings.v1';

/** The shipped order of the nav routes (Settings' "Reset layout" target). */
export const NAV_DEFAULT_ORDER = NAV_ITEMS.map((item) => item.to);

/**
 * Every setting, its default and a one-line description for the Settings
 * page. `navOrder`/`navHidden` are arrays of route paths (e.g. '/movies');
 * everything else is a boolean.
 */
export const APP_SETTINGS = {
  // --- top bar layout ---
  navOrder: {
    label: 'Top bar order',
    description: 'Which button comes first. Applies to the desktop bar and the mobile menu.',
    type: 'nav-order',
    default: NAV_DEFAULT_ORDER,
  },
  navHidden: {
    label: 'Hidden top bar buttons',
    description: 'Buttons you have turned off. Turn them back on here.',
    type: 'nav-hidden',
    default: [],
  },
  showSearchButton: {
    label: 'Search button',
    description: 'The magnifier in the top bar (the / shortcut always works).',
    type: 'toggle',
    default: true,
  },
  showCustomizeButton: {
    label: 'Customise button',
    description: 'The palette button that opens the Customisation Studio.',
    type: 'toggle',
    default: true,
  },
  showLogButton: {
    label: 'Contribution log button',
    description: 'The archive icon linking to the public contribution log.',
    type: 'toggle',
    default: true,
  },
  showSettingsButton: {
    label: 'Settings button',
    description: 'The gear button that opens this page.',
    type: 'toggle',
    default: true,
  },
  showDiscordButton: {
    label: 'Discord button',
    description: 'The Discord button linking to the community server.',
    type: 'toggle',
    default: true,
  },
  // --- behaviour ---
  showSoonBadges: {
    label: '"Coming soon" badges',
    description: 'The little "soon" chip on menu items that are on their way.',
    type: 'toggle',
    default: true,
  },
  discordPopup: {
    label: 'Discord invite popup',
    description: 'The occasional "Join our Discord" popup. "Don\'t show again" turns this off — turn it back on here.',
    type: 'toggle',
    default: true,
  },
};

export const defaultAppSettings = () => Object.fromEntries(
  Object.entries(APP_SETTINGS).map(([key, def]) => [key, def.default]),
);

/** Reads and validates the stored settings; anything missing or of the wrong
 *  shape falls back to its default (so a corrupted entry can never break the
 *  header), and nav entries that no longer exist are dropped while brand-new
 *  destinations are appended in their default position. */
export function loadAppSettings() {
  const defaults = defaultAppSettings();
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) ?? 'null');
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== 'object') return defaults;

  const settings = { ...defaults };
  for (const key of Object.keys(APP_SETTINGS)) {
    const value = stored[key];
    const def = APP_SETTINGS[key];
    if (def.type === 'nav-order' && Array.isArray(value)) {
      const known = new Set(NAV_ITEMS.map((i) => i.to));
      const order = value.filter((p) => known.has(p));
      for (const p of NAV_DEFAULT_ORDER) if (!order.includes(p)) order.push(p);
      settings.navOrder = order;
    } else if (def.type === 'nav-hidden' && Array.isArray(value)) {
      const known = new Set(NAV_ITEMS.map((i) => i.to));
      settings.navHidden = value.filter((p) => known.has(p));
    } else if (typeof def.default === 'boolean') {
      if (typeof value === 'boolean') settings[key] = value;
    }
  }
  return settings;
}

export function saveAppSettings(settings) {
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private browsing / storage full: settings simply do not persist. */
  }
}

/** The nav items, in the user's order, each flagged with its visibility. */
export function orderedNavItems(settings) {
  const byPath = new Map(NAV_ITEMS.map((item) => [item.to, item]));
  const hidden = new Set(settings.navHidden ?? []);
  return settings.navOrder
    .map((path) => byPath.get(path))
    .filter(Boolean)
    .map((item) => ({ ...item, hidden: hidden.has(item.to) }));
}
