import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import DiscordMark, { DISCORD_INVITE_URL } from './DiscordMark.jsx';
import { useAppSettings } from '@/hooks/useAppSettings.jsx';

const NEVER_KEY = 'tm.discord.never';
const SHOWN_KEY = 'tm.discord.shown';

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
        <span className="discord-popup__logo"><DiscordMark size={46} /></span>
        <h2 className="discord-popup__title" id="discord-popup-title">Join Our Discord!</h2>
        <p className="discord-popup__text">
          To know about all the new updates and everything — sneak peeks, calls for help and
          the people building the archive.
        </p>
        <a className="discord-popup__join" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
          <DiscordMark size={19} /> Join the server
        </a>
        <button type="button" className="discord-popup__never" onClick={neverAgain}>
          Don&rsquo;t show again
        </button>
      </div>
    </div>
  );
}
