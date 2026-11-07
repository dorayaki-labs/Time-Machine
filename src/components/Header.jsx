import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import MobileNavigation from './MobileNavigation.jsx';
import CustomizeButton from './CustomizeButton.jsx';
import AccountMenu from './AccountMenu.jsx';
import { NAV_ITEMS } from './navItems.js';
import { useSearchOverlay } from '@/hooks/SearchContext.jsx';
import { LOGO } from '@/config.js';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openSearch } = useSearchOverlay();
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);
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
          <img src={LOGO} alt="Time Machine" width="170" height="46" />
        </Link>

        <nav className="primary-nav" aria-label="Primary">
          {/* Statistics and the contribution log stay out of the desktop bar
              (they are in the account menu and the footer): eleven items do
              not fit on one row without pushing into the buttons. */}
          <ul>
            {NAV_ITEMS.filter((item) => item.to !== '/stats' && item.to !== '/log').map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `primary-nav__link${isActive ? ' is-active' : ''}`}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <AccountMenu />
          <CustomizeButton />
          <Link to="/log" className="icon-btn log-btn" aria-label="Contribution log" title="Contribution log"><Icon name="archive" size={19} /></Link>
          <button type="button" className="icon-btn search-btn" onClick={openSearch} aria-label="Search the archive" aria-keyshortcuts="Control+K /">
            <Icon name="search" size={20} />
            <kbd className="search-btn__kbd" aria-hidden="true">/</kbd>
          </button>
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-nav">
            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>
      <MobileNavigation open={menuOpen} onNavigate={() => setMenuOpen(false)} />
    </header>
  );
}
