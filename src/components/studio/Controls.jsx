// Control primitives for the Customization Studio. Every control is a real
// setting that drives the live document — there are no decorative controls.

import Icon from '../Icon.jsx';

export function ControlRow({ label, help, action, children }) {
  return (
    <div className="studio-control">
      <div className="studio-control__head">
        <span className="studio-control__label">{label}</span>
        {action}
      </div>
      {children}
      {help ? <p className="studio-control__help">{help}</p> : null}
    </div>
  );
}

/** Small "back to default" button shown next to a customized value. */
export function ResetButton({ onReset, label = 'Reset' }) {
  return (
    <button type="button" className="studio-reset" onClick={onReset} title={label}>
      <Icon name="arrowLeft" size={13} /> {label}
    </button>
  );
}

export function ColorControl({ label, value, fallback, onChange, onReset }) {
  const shown = value ?? '';
  const isHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(shown);
  return (
    <div className={`studio-color${value ? ' is-set' : ''}`}>
      <span className="studio-color__label">{label}</span>
      <span className="studio-color__value">
        <span className="studio-color__chip" style={{ background: shown || fallback }} aria-hidden="true" />
        <input
          type="text"
          value={shown}
          placeholder={fallback}
          spellCheck={false}
          aria-label={`${label} (hex colour)`}
          onChange={(e) => onChange(e.target.value.trim())}
          className={`mono${shown && !isHex ? ' has-error' : ''}`}
        />
        <label className="studio-color__pick" title="Pick a colour">
          <input
            type="color"
            value={isHex ? shown : fallback}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label} colour picker`}
          />
          <Icon name="palette" size={14} />
        </label>
        {value ? <button type="button" className="studio-reset" onClick={onReset} title="Reset to the theme default"><Icon name="arrowLeft" size={13} /></button> : null}
      </span>
      {shown && !isHex ? <p className="studio-control__help">Use a hex colour like #2b5d8f.</p> : null}
    </div>
  );
}

export function RangeControl({ label, value, fallback, min, max, step, unit, help, onChange, onReset }) {
  const isSet = value !== undefined && value !== null;
  return (
    <ControlRow label={label} help={help} action={isSet ? <ResetButton onReset={onReset} /> : null}>
      <div className="studio-range">
        <input
          type="range" min={min} max={max} step={step}
          value={isSet ? value : fallback}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="studio-range__readout mono">{isSet ? `${value}${unit ?? ''}` : `${fallback}${unit ?? ''} (default)`}</span>
      </div>
    </ControlRow>
  );
}

export function SegmentControl({ label, options, value, fallback, help, onChange, onReset }) {
  const current = value ?? fallback;
  return (
    <ControlRow label={label} help={help} action={value !== undefined && value !== null && value !== fallback ? <ResetButton onReset={onReset} /> : null}>
      <div className="studio-segment" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === current}
            className={o.value === current ? ' is-active' : ''}
            onClick={() => onChange(o.value)}
          >{o.label.replace(' (default)', '')}</button>
        ))}
      </div>
    </ControlRow>
  );
}

export function ToggleControl({ label, value, fallback = true, help, onChange, onReset }) {
  const on = value === undefined || value === null ? fallback : Boolean(value);
  return (
    <ControlRow
      label={label}
      help={help}
      action={value !== undefined && value !== null ? <ResetButton onReset={onReset} /> : null}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`studio-switch${on ? ' is-on' : ''}`}
        onClick={() => onChange(!on)}
      >
        <span className="studio-switch__knob" />
      </button>
    </ControlRow>
  );
}
