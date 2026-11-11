import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import MobileNavigation from './MobileNavigation.jsx';
import CustomizeButton from './CustomizeButton.jsx';
import AccountMenu from './AccountMenu.jsx';
import { useSearchOverlay } from '@/hooks/SearchContext.jsx';
import { useAppSettings } from '@/hooks/useAppSettings.jsx';
import { orderedNavItems } from '@/lib/appSettings.js';
import { LOGO } from '@/config.js';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSearch } = useSearchOverlay();
  const { settings } = useAppSettings();
  const location = useLocation();
  // The bar follows the user's layout settings: order, hidden buttons and
  // which of the optional icon buttons exist at all (Settings page).
  const barItems = orderedNavItems(settings).filter((item) => item.primary && !item.hidden);

  // Close the burger menu on navigation, and lock body scroll while it is
  // open — an open menu should never leave the page scrollable behind it.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="site-header__panel">
        <Link to="/" className="brand" aria-label="Time Machine — home">
          <img className="brand__img" src={LOGO} alt="Time Machine" width="170" height="46" />
        </Link>

        <nav className="primary-nav" aria-label="Primary">
          <ul>
            {barItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `primary-nav__link${isActive ? ' is-active' : ''}`}>
                  {item.label}
                  {item.soon && settings.showSoonBadges ? <span className="primary-nav__soon" aria-label="(coming soon)">soon</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <AccountMenu />
          {settings.showCustomizeButton ? <CustomizeButton /> : null}
          {settings.showLogButton ? (
            <Link to="/log" className="icon-btn log-btn" aria-label="Contribution log" title="Contribution log"><Icon name="archive" size={19} /></Link>
          ) : null}
          {settings.showSettingsButton ? (
            <Link to="/settings" className="icon-btn settings-btn" aria-label="Settings" title="Settings"><Icon name="settings" size={19} /></Link>
          ) : null}
          {settings.showSearchButton ? (
            <button type="button" className="icon-btn search-btn" onClick={openSearch} aria-label="Search the archive" aria-keyshortcuts="Control+K /">
              <Icon name="search" size={20} />
              <kbd className="search-btn__kbd" aria-hidden="true">/</kbd>
            </button>
          ) : null}
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-nav">
            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>
      <MobileNavigation open={menuOpen} onNavigate={() => setMenuOpen(false)} />
    </header>
  );
}
