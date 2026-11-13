// The statistics page's chart primitives: an animated SVG donut and an
// animated horizontal bar chart. Hand-rolled on purpose — the project has no
// charting dependency, the site's design system (CSS variables, dark themes,
// reduced-motion) stays in control, and both charts are fully theme-aware
// because every colour is a theme token.
//
// Animation model: both charts mount at "empty" and grow to their values on
// the next frame via a CSS transition, so the motion is a declarative
// transition (GPU-friendly, interruptible) rather than JS-driven frames.
// prefers-reduced-motion and the studio's "no motion" setting both switch
// the transitions off (see the CSS).

import { useEffect, useState } from 'react';

/** Run `fn` on the next animation frame — used to trigger enter transitions
 *  after the first paint. The flag is a per-effect local (not a ref) so the
 *  StrictMode double-mount resets it correctly. */
function useEnterTransition() {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let alive = true;
    const raf = requestAnimationFrame(() => { if (alive) setEntered(true); });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  return entered;
}

/**
 * Donut chart. `slices`: [{ label, value, color }]; zero-value slices are
 * dropped; an all-zero set renders an honest empty state, never a fake pie.
 * `center`: big label inside the ring. `unit` rides along in tooltips.
 */
export function DonutChart({ slices = [], center = null, unit = '', size = 180, thickness = 22 }) {
  const entered = useEnterTransition();
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  if (!total) {
    return <p className="chart-empty muted small">Nothing to chart yet — this data is not documented.</p>;
  }

  let offset = 0;
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={data.map((s) => `${s.label}: ${s.value}${unit}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          className="donut__track" strokeWidth={thickness} />
        {data.map((slice) => {
          const fraction = slice.value / total;
          const dash = fraction * circumference;
          const dashOffset = entered ? offset : circumference;
          offset += dash;
          return (
            <circle
              key={slice.label}
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              className="donut__slice"
              style={{ stroke: slice.color }}
              strokeWidth={thickness}
              strokeDasharray={`${entered ? dash : 0} ${circumference - (entered ? dash : 0)}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${slice.label}: ${slice.value}${unit} (${Math.round(fraction * 100)}%)`}</title>
            </circle>
          );
        })}
      </svg>
      {center ? (
        <span className="donut__center">
          <strong className="donut__value">{center.value}</strong>
          <span className="donut__label">{center.label}</span>
        </span>
      ) : null}
      <ul className="donut__legend">
        {data.map((slice) => (
          <li key={slice.label}>
            <span className="donut__swatch" style={{ background: slice.color }} aria-hidden="true" />
            <span className="donut__legend-label">{slice.label}</span>
            <span className="donut__legend-value mono">{slice.value}{unit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Horizontal bar chart. `bars`: [{ label, value, href? }] — bars with an href
 * render as links. Bars animate from zero width on mount. Ticks and exact
 * values are printed on every bar, so colour is never the only carrier of the
 * data (and the numbers survive greyscale/print).
 */
export function BarChart({ bars = [], unit = '', max, highlight = 0 }) {
  const entered = useEnterTransition();
  const data = bars.filter((b) => b.value >= 0);
  const top = Math.max(max ?? 0, ...data.map((b) => b.value), 1);

  if (!data.length) {
    return <p className="chart-empty muted small">Nothing to chart yet — this data is not documented.</p>;
  }

  return (
    <ul className="barchart">
      {data.map((bar, i) => {
        const pct = Math.max(2, Math.round((bar.value / top) * 100));
        const width = entered ? `${pct}%` : '0%';
        const body = (
          <>
            <span className="barchart__label">{bar.label}</span>
            <span className="barchart__track" aria-hidden="true">
              <span className={`barchart__fill${i < highlight ? ' is-highlight' : ''}`} style={{ width }} />
            </span>
            <span className="barchart__value mono">{bar.value}{unit}</span>
          </>
        );
        return (
          <li key={bar.id ?? bar.label} className="barchart__row">
            {bar.href
              ? <a className="barchart__link" href={bar.href} title={`${bar.label}: ${bar.value}${unit}`}>{body}</a>
              : <span className="barchart__link" title={`${bar.label}: ${bar.value}${unit}`}>{body}</span>}
          </li>
        );
      })}
    </ul>
  );
}
