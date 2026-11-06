import { useId, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * Generic filter UI. `fields` is an array of:
 *   { type: 'select', name, label, options: [{ value, label }], allLabel }
 *   { type: 'range', label, minName, maxName, placeholderMin, placeholderMax }
 *   { type: 'text', name, label, placeholder }
 * On small screens the panel collapses behind a button.
 */
export default function FilterPanel({ fields, values, onChange, onReset, title = 'Filters' }) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const activeCount = fields.reduce((n, f) => {
    if (f.type === 'range') return n + (values[f.minName] || values[f.maxName] ? 1 : 0);
    return n + (values[f.name] ? 1 : 0);
  }, 0);

  return (
    <div className={`filter-panel glass${open ? ' is-open' : ''}`}>
      <button type="button" className="filter-panel__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${baseId}-body`}>
        <Icon name="filter" size={18} />
        <span>{title}</span>
        {activeCount ? <span className="filter-panel__count">{activeCount}</span> : null}
        <Icon name="chevronDown" size={18} className="filter-panel__chev" />
      </button>
      <div className="filter-panel__body" id={`${baseId}-body`} aria-hidden={!open}>
        <div className="filter-panel__inner">
        <div className="filter-panel__divider" aria-hidden="true" />
        <div className="filter-panel__grid">
          {fields.map((f) => {
            if (f.type === 'range') {
              return (
                <fieldset className="field field--range" key={f.label}>
                  <legend>{f.label}</legend>
                  <div className="field__pair">
                    <input type="number" min="0" inputMode="numeric" aria-label={`${f.label}, from`} placeholder={f.placeholderMin ?? 'From'} value={values[f.minName] ?? ''} onChange={(e) => onChange({ [f.minName]: e.target.value })} />
                    <span aria-hidden="true">–</span>
                    <input type="number" min="0" inputMode="numeric" aria-label={`${f.label}, to`} placeholder={f.placeholderMax ?? 'To'} value={values[f.maxName] ?? ''} onChange={(e) => onChange({ [f.maxName]: e.target.value })} />
                  </div>
                </fieldset>
              );
            }
            const id = `${baseId}-${f.name}`;
            return (
              <div className="field" key={f.name}>
                <label htmlFor={id}>{f.label}</label>
                {f.type === 'text' ? (
                  <input id={id} type="text" value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => onChange({ [f.name]: e.target.value })} />
                ) : (
                  <div className="select-wrap">
                    <select id={id} value={values[f.name] ?? ''} onChange={(e) => onChange({ [f.name]: e.target.value })}>
                      <option value="">{f.allLabel ?? 'Any'}</option>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Icon name="chevronDown" size={16} className="select-wrap__chev" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="filter-panel__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset} disabled={!activeCount}>Clear filters</button>
        </div>
        </div>
      </div>
    </div>
  );
}
