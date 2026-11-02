import { getEntries, getAllEntries, getCharacters, getGadgets, getSeries } from './catalog.js';

const hasSource = (e) => e.availability === 'available';

export function getSeriesStats(seriesId) {
  const entries = getEntries(seriesId);
  return {
    total: entries.length,
    withSources: entries.filter(hasSource).length,
    // Status is computed per record (see lib/records.js), so this counts
    // entries where every metadata field is documented.
    complete: entries.filter((e) => e.status === 'complete').length,
    title: getSeries(seriesId).title,
  };
}

export function getArchiveStats() {
  const all = getAllEntries();
  return {
    episodes: all.filter((e) => e.kind === 'episode').length,
    movies: all.filter((e) => e.kind === 'movie').length,
    characters: getCharacters().length,
    gadgets: getGadgets().length,
    withSources: all.filter(hasSource).length,
  };
}

export { metadataChecklist } from './records.js';
