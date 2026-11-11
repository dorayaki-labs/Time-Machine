const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  arrowRight: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  arrowLeft: <><path d="M19 12H5m5-5-5 5 5 5" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  chevronLeft: <><path d="m15 6-6 6 6 6" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  alert: <><path d="M12 8v5m0 3.5v.01" /><circle cx="12" cy="12" r="9" /></>,
  play: <><path d="M8 5.5v13l11-6.5-11-6.5Z" /></>,
  film: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5v14M16 5v14M4 10h4M16 10h4M4 14h4M16 14h4" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  gadget: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4" /></>,
  moon: <><path d="M20 13.2A8 8 0 1 1 10.8 4 6.6 6.6 0 0 0 20 13.2Z" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  download: <><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></>,
  edit: <><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" /><path d="m13.5 7.5 3 3" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-.9-.7-1.4-.7-2.2 0-1 .8-1.8 2-1.8H17a4.5 4.5 0 0 0 4.5-4.5C21.5 6 17.2 3 12 3Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="15.5" cy="8" r="1" /></>,
  stats: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  shield: <><path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.3 7 9.8 4.1-1.5 7-5.5 7-9.8V5.8L12 3Z" /></>,
  logout: <><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M4 12h11m-4-4 4 4-4 4" /></>,
  settings: <><path d="M4 7h8M16 7h4M4 17h4M12 17h8" /><circle cx="14" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.9 9.9a3 3 0 1 0 4.2 4.2" /><path d="M6.3 6.8C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.35 3.8-.9M10.6 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.7 17.7 0 0 1-2.7 3.5" /></>,
  arrowUp: <><path d="M12 19V5m-5 5 5-5 5 5" /></>,
  arrowDown: <><path d="M12 5v14m-5-5 5 5 5-5" /></>,
};

export default function Icon({ name, size = 20, className = '', title }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name] ?? null}
    </svg>
  );
}
