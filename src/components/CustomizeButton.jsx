// Header entry to the Customization Studio. The little two-colour swatch
// shows the active theme; the button opens the full appearance editor.

import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import useTheme from '@/hooks/useTheme.jsx';
import { BASE_THEMES } from '@/lib/themeSchema.js';

export default function CustomizeButton() {
  const { activeTheme } = useTheme();
  const base = BASE_THEMES.find((t) => t.id === activeTheme?.baseTheme) ?? BASE_THEMES[0];
  const colors = activeTheme?.settings?.colors ?? {};
  const bg = colors.bg || base.swatch[0];
  const accent = colors.accent || base.swatch[1];

  return (
    <Link
      to="/customize"
      className="icon-btn customize-btn"
      aria-label="Customize the look of Time Machine"
      title="Customize"
    >
      <Icon name="palette" size={19} />
      <span className="customize-btn__swatch" style={{ background: bg }} aria-hidden="true">
        <span style={{ background: accent }} />
      </span>
    </Link>
  );
}
