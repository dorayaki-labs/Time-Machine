import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useAppSettings } from '@/hooks/useAppSettings.jsx';

export const DISCORD_INVITE_URL = 'https://dsc.gg/tmachine';

const NEVER_KEY = 'tm.discord.never';
const SHOWN_KEY = 'tm.discord.shown';

/** The Discord mark (the official logo silhouette, fill-based). */
function DiscordLogo({ size = 44 }) {
  return (
    <svg className="discord-popup__logo" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0821.0821 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

/**
 * The Discord invite popup. Shown at most once per browser session, on a
 * 50/50 coin flip, a moment after the site settles — and never again once
 * "Don't show again" is used (that choice lands in the Settings page, where
 * it can be turned back on). Purely promotional: Escape, the X, a click on
 * the backdrop and the Join button all dismiss it.
 */
export default function DiscordPopup() {
  const { settings } = useAppSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!settings.discordPopup) return undefined;
    let suppressed = false;
    try {
      suppressed = localStorage.getItem(NEVER_KEY) === '1'
        || sessionStorage.getItem(SHOWN_KEY) === '1';
    } catch {
      suppressed = true; // storage blocked: never risk annoying anyone
    }
    if (suppressed) return undefined;

    // The coin flip. Losing it also counts as this session's attempt — the
    // popup never retries in a loop. "Shown" is only written when the card
    // actually appears, so a cleaned-up timer (React StrictMode mounts
    // effects twice in dev) can never silently consume the one attempt.
    if (Math.random() >= 0.5) {
      try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* ignore */ }
      return undefined;
    }

    const timer = setTimeout(() => {
      try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* ignore */ }
      setOpen(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, []); // one decision per session, on mount — settings changes need no re-run

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const neverAgain = () => {
    try { localStorage.setItem(NEVER_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div className="discord-popup" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="discord-popup__card" role="dialog" aria-modal="true" aria-labelledby="discord-popup-title">
        <button type="button" className="icon-btn discord-popup__close" onClick={() => setOpen(false)} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        <DiscordLogo size={46} />
        <h2 className="discord-popup__title" id="discord-popup-title">Join Our Discord!</h2>
        <p className="discord-popup__text">
          To know about all the new updates and everything — sneak peeks, calls for help and
          the people building the archive.
        </p>
        <a className="discord-popup__join" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
          <DiscordLogo size={19} /> Join the server
        </a>
        <button type="button" className="discord-popup__never" onClick={neverAgain}>
          Don&rsquo;t show again
        </button>
      </div>
    </div>
  );
}
