import { useId, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * A detail section with its own expand/collapse control (the summary and the
 * synopsis collapse independently of each other). The open/close animation is
 * the CSS grid-rows trick — 0fr ⇄ 1fr — so it works for content of any height
 * without JavaScript measuring, and `prefers-reduced-motion` disables it.
 * Collapsed panels are also hidden from assistive technology.
 */
export default function Collapsible({ title, meta, defaultOpen = true, children, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section className={`collapsible${open ? ' is-open' : ''} ${className}`.trim()}>
      <h2 className="collapsible__heading">
        <button
          type="button"
          className="collapsible__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="collapsible__title">{title}</span>
          {meta ? <span className="collapsible__meta">{meta}</span> : null}
          <span className="collapsible__chevron" aria-hidden="true"><Icon name="chevronDown" size={17} /></span>
        </button>
      </h2>
      <div className="collapsible__panel" id={panelId} aria-hidden={!open}>
        <div className="collapsible__content">{children}</div>
      </div>
    </section>
  );
}
