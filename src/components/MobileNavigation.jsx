import { NavLink } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { NAV_ITEMS } from './navItems.js';

export default function MobileNavigation({ open, onNavigate }) {
  return (
    <nav id="mobile-nav" className={`mobile-nav${open ? ' is-open' : ''}`} aria-label="Mobile" hidden={!open}>
      <ul>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `mobile-nav__link${isActive ? ' is-active' : ''}`}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mobile-nav__foot">
        <ThemeToggle />
      </div>
    </nav>
  );
}
