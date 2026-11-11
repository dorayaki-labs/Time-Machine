import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAppSettings } from '@/hooks/useAppSettings.jsx';
import { orderedNavItems } from '@/lib/appSettings.js';

/* The full navigation as a slide-down sheet under the header. Every
   destination (primary and secondary) appears here, grouped the way the
   desktop bar orders them; the Settings and Customize entries stay pinned
   at the foot. The same Settings that shape the desktop bar apply here:
   order, hidden buttons and the "coming soon" chips. */
export default function MobileNavigation({ open, onNavigate }) {
  const { settings } = useAppSettings();
  const items = orderedNavItems(settings).filter((item) => !item.hidden);
  return (
    <nav id="mobile-nav" className={`mobile-nav${open ? ' is-open' : ''}`} aria-label="Mobile" hidden={!open}>
      <ul>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `mobile-nav__link${isActive ? ' is-active' : ''}`}>
              <span>{item.label}</span>
              {item.soon && settings.showSoonBadges ? <span className="chip chip--mono mobile-nav__soon">Coming soon</span> : null}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mobile-nav__foot">
        <NavLink to="/settings" onClick={onNavigate} className="mobile-nav__customize">
          <Icon name="settings" size={16} /> Settings
        </NavLink>
        <NavLink to="/customize" onClick={onNavigate} className="mobile-nav__customize">
          <Icon name="palette" size={16} /> Customize
        </NavLink>
      </div>
    </nav>
  );
}
