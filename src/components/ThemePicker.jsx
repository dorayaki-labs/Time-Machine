// Theme selector: a compact dropdown in the header with a colour swatch per
// theme. Works on desktop and mobile (tap outside or Escape closes it), and
// respects prefers-reduced-motion for its transition.

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import useTheme, { THEMES } from '@/hooks/useTheme.js';

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-btn theme-picker__button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}. Change theme`}
        title="Theme"
      >
        <Icon name="palette" size={19} />
        <span className="theme-picker__swatch" style={{ background: current.swatch[0] }} aria-hidden="true">
          <span style={{ background: current.swatch[1] }} />
        </span>
      </button>
      {open ? (
        <ul className="theme-picker__menu" role="listbox" aria-label="Theme">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={t.id === theme}
                className={`theme-picker__option${t.id === theme ? ' is-active' : ''}`}
                onClick={() => { setTheme(t.id); setOpen(false); }}
              >
                <span className="theme-picker__swatch" style={{ background: t.swatch[0] }} aria-hidden="true">
                  <span style={{ background: t.swatch[1] }} />
                </span>
                <span>{t.label}</span>
                {t.id === theme ? <Icon name="check" size={15} className="theme-picker__check" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
