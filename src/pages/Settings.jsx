// The unified settings page: behaviour and layout preferences that are not
// part of a visual theme (the Customisation Studio owns the looks; this owns
// the "how does the site behave" side). The star is the top bar editor —
// reorder and hide the navigation buttons — plus the optional header buttons
// and the popup preferences. Everything applies live and persists locally.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import Icon from '@/components/Icon.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { ToggleControl } from '@/components/studio/Controls.jsx';
import { useAppSettings } from '@/hooks/useAppSettings.jsx';
import { APP_SETTINGS, orderedNavItems, NAV_DEFAULT_ORDER } from '@/lib/appSettings.js';

/** One row of the top bar editor: label, route, position arrows, visibility. */
function NavEditorRow({ item, index, count, onMove, onToggleVisibility }) {
  return (
    <li className={`nav-editor__row${item.hidden ? ' is-hidden' : ''}`}>
      <span className="nav-editor__order mono">{String(index + 1).padStart(2, '0')}</span>
      <span className="nav-editor__label">
        {item.label}
        {item.soon ? <span className="chip chip--mono nav-editor__soon">soon</span> : null}
        {item.primary ? null : <span className="nav-editor__scope muted">menu only</span>}
      </span>
      <span className="nav-editor__path mono">{item.to}</span>
      <span className="nav-editor__actions">
        <button type="button" className="icon-btn" aria-label={`Move ${item.label} up`} disabled={index === 0}
          onClick={() => onMove(index, -1)}><Icon name="arrowUp" size={16} /></button>
        <button type="button" className="icon-btn" aria-label={`Move ${item.label} down`} disabled={index === count - 1}
          onClick={() => onMove(index, 1)}><Icon name="arrowDown" size={16} /></button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onToggleVisibility(item.to)}
          aria-pressed={item.hidden ? 'false' : 'true'}>
          <Icon name={item.hidden ? 'eyeOff' : 'eye'} size={14} /> {item.hidden ? 'Hidden' : 'Shown'}
        </button>
      </span>
    </li>
  );
}

export default function Settings() {
  useDocumentTitle('Settings');
  const { settings, update, resetAll } = useAppSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const nav = orderedNavItems(settings);

  const move = (index, dir) => {
    const order = [...settings.navOrder];
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    update('navOrder', order);
  };

  const toggleVisibility = (path) => {
    const hidden = new Set(settings.navHidden);
    if (hidden.has(path)) hidden.delete(path); else hidden.add(path);
    update('navHidden', [...hidden]);
  };

  const resetsBarOrder = JSON.stringify(settings.navOrder) !== JSON.stringify(NAV_DEFAULT_ORDER)
    || settings.navHidden.length > 0;

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Time Machine</p>
        <h1>Settings</h1>
        <p className="page-opening__lead">
          How the archive behaves for you: the top bar, its buttons and the occasional popup.
          Everything applies immediately and is saved in this browser. For colours, fonts and
          card looks, visit the <Link to="/customize">Customisation Studio</Link>.
        </p>
      </div>

      {/* ------------------------------------------------ top bar layout */}
      <section className="detail-section settings-section" aria-labelledby="settings-nav-title">
        <header className="detail-section__head">
          <h2 id="settings-nav-title"><Icon name="menu" size={15} /> Top bar layout</h2>
          {resetsBarOrder ? (
            <button type="button" className="btn btn--ghost btn--sm"
              onClick={() => { update('navOrder', NAV_DEFAULT_ORDER); update('navHidden', []); }}>
              <Icon name="close" size={13} /> Reset layout
            </button>
          ) : null}
        </header>
        <p className="muted settings-section__hint">
          Choose which button comes first, and turn off the ones you never use. Hidden buttons
          disappear from the desktop bar <em>and</em> the mobile menu — the page itself stays
          reachable by link. “Menu only” items never show in the desktop bar by design.
        </p>
        <ul className="nav-editor">
          {nav.map((item, i) => (
            <NavEditorRow
              key={item.to}
              item={item}
              index={i}
              count={nav.length}
              onMove={move}
              onToggleVisibility={toggleVisibility}
            />
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ header buttons */}
      <section className="detail-section settings-section" aria-labelledby="settings-buttons-title">
        <header className="detail-section__head">
          <h2 id="settings-buttons-title"><Icon name="settings" size={15} /> Top bar buttons</h2>
        </header>
        <div className="settings-controls">
          {['showSearchButton', 'showCustomizeButton', 'showLogButton', 'showSettingsButton', 'showSoonBadges'].map((key) => (
            <ToggleControl
              key={key}
              label={APP_SETTINGS[key].label}
              help={APP_SETTINGS[key].description}
              value={settings[key]}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ community */}
      <section className="detail-section settings-section" aria-labelledby="settings-community-title">
        <header className="detail-section__head">
          <h2 id="settings-community-title"><Icon name="archive" size={15} /> Community &amp; popups</h2>
        </header>
        <div className="settings-controls">
          <ToggleControl
            label={APP_SETTINGS.discordPopup.label}
            help={APP_SETTINGS.discordPopup.description}
            value={settings.discordPopup}
            onChange={(v) => update('discordPopup', v)}
          />
        </div>
      </section>

      {/* ------------------------------------------------ danger zone */}
      <section className="detail-section settings-section settings-section--danger" aria-labelledby="settings-reset-title">
        <header className="detail-section__head">
          <h2 id="settings-reset-title"><Icon name="alert" size={15} /> Reset</h2>
        </header>
        <p className="muted settings-section__hint">
          Puts every setting on this page back to how the archive ships. Your themes
          (Customisation Studio) and account are not touched.
        </p>
        {confirmReset ? (
          <div className="btn-row" role="alertdialog" aria-label="Confirm reset">
            <span className="mono small">Reset all settings?</span>
            <button type="button" className="btn btn--danger"
              onClick={() => { resetAll(); setConfirmReset(false); }}>Yes, reset everything</button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={15} /> Reset all settings
          </button>
        )}
      </section>
    </PageContainer>
  );
}
