// Header theme picker. The palette button opens a dropdown with every
// built-in theme, every theme the user saved in the Customisation Studio,
// and a Customise entry into the studio itself. Switching applies the theme
// immediately and persists (localStorage 'tm-theme' via useTheme) — no
// second theme system: this is the same applyBuiltin/applyCustom the studio
// uses, wrapped in a menu.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import useTheme from '@/hooks/useTheme.jsx';
import { BASE_THEMES } from '@/lib/themeSchema.js';

function Swatch({ theme }) {
  const base = BASE_THEMES.find((t) => t.id === theme.baseTheme) ?? BASE_THEMES[0];
  const bg = theme.settings?.colors?.bg || base.swatch[0];
  const accent = theme.settings?.colors?.accent || base.swatch[1];
  return (
    <span className="theme-menu__swatch" aria-hidden="true">
      <span style={{ background: bg }} />
      <span style={{ background: accent }} />
    </span>
  );
}

function ThemeItem({ label, meta, active, onClick }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active}
      className={`theme-menu__item${active ? ' is-active' : ''}`} onClick={onClick}>
      <Swatch theme={meta} />
      <span className="theme-menu__label">{label}</span>
      {active ? <span className="chip chip--mono">Active</span> : null}
    </button>
  );
}

export default function CustomizeButton() {
  const { activeTheme, activeId, customThemes, applyBuiltin, applyCustom } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const base = BASE_THEMES.find((t) => t.id === activeTheme?.baseTheme) ?? BASE_THEMES[0];
  const colors = activeTheme?.settings?.colors ?? {};
  const bg = colors.bg || base.swatch[0];
  const accent = colors.accent || base.swatch[1];

  return (
    <div className="theme-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn customize-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Themes: switch the look of Time Machine (${open ? 'close' : 'open'} the theme menu)`}
        title="Themes"
      >
        <Icon name="palette" size={19} />
        <span className="customize-btn__swatch" style={{ background: bg }} aria-hidden="true">
          <span style={{ background: accent }} />
        </span>
      </button>

      {open ? (
        <div className="theme-menu__panel" role="menu" aria-label="Theme picker">
          <p className="theme-menu__head">Built-in themes</p>
          {BASE_THEMES.map((t) => (
            <ThemeItem key={t.id} label={t.label} meta={t}
              active={activeId === t.id} onClick={() => { applyBuiltin(t.id); setOpen(false); }} />
          ))}

          {customThemes.length ? (
            <>
              <p className="theme-menu__head">Your themes</p>
              {customThemes.map((t) => (
                <ThemeItem key={t.id} label={t.name} meta={t}
                  active={activeId === t.id} onClick={() => { applyCustom(t.id); setOpen(false); }} />
              ))}
            </>
          ) : null}

          <div className="theme-menu__foot">
            <Link to="/customize" role="menuitem" className="btn btn--ghost btn--sm"
              onClick={() => setOpen(false)}>
              <Icon name="palette" size={14} /> Customise…
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
