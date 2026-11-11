// Primary navigation. `primary` items show in the desktop bar; everything
// (including the secondary destinations) appears in the mobile menu. The
// desktop bar filters by `primary` instead of hardcoding exclusions, so
// adding a destination here is the only change a new section needs.
export const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true, primary: true },
  { to: '/anime/1979', label: 'Anime (1979)', primary: true },
  { to: '/anime/2005', label: 'Anime (2005)', primary: true },
  { to: '/movies', label: 'Movies', primary: true },
  { to: '/manga', label: 'Manga', soon: true, primary: true },
  { to: '/characters', label: 'Characters', primary: true },
  { to: '/gadgets', label: 'Gadgets', primary: true },
  { to: '/historical/1973', label: '1973 Archive', primary: true },
  { to: '/about', label: 'About', primary: true },
  { to: '/credits', label: 'Credits', primary: true },
  { to: '/contribute', label: 'Contribute', primary: true },
  { to: '/stats', label: 'Statistics' },
  { to: '/log', label: 'Contribution log' },
];
