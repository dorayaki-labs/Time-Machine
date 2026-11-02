import { useMemo, useRef } from 'react';
import useQueryState from '@/hooks/useQueryState.js';
import SearchBar from './SearchBar.jsx';
import FilterPanel from './FilterPanel.jsx';
import Pagination from './Pagination.jsx';
import EmptyState from './EmptyState.jsx';
import EpisodeCard from './EpisodeCard.jsx';
import MovieCard from './MovieCard.jsx';
import PageContainer from './PageContainer.jsx';
import { getSeries, getCharacter, getCategories, languageName, PRESERVATION_STATUSES } from '@/lib/catalog.js';
import { getSeriesStats } from '@/lib/statistics.js';
import { filterEntries, sortEntries, paginate, availableYears, availableLanguages, EPISODE_SORTS, MOVIE_SORTS } from '@/lib/filters.js';

const DEFAULTS = { q: '', sort: 'number-asc', numMin: '', numMax: '', year: '', language: '', availability: '', character: '', preservation: '', page: '1' };

/** Shared catalogue page for Anime (1979), Anime (2005), Movies and the historical 1973 section. */
export default function CatalogBrowser({ seriesId, before = null }) {
  const series = getSeries(seriesId);
  const isMovie = series.kind === 'movie';
  const noun = isMovie ? 'movies' : 'episodes';
  const stats = getSeriesStats(seriesId);
  const [values, update, reset] = useQueryState(DEFAULTS);
  const resultsRef = useRef(null);

  const options = useMemo(() => {
    const entries = series.entries;
    const { years, hasUnknown } = availableYears(entries);
    return {
      years: [...years.map((y) => ({ value: String(y), label: String(y) })), ...(hasUnknown ? [{ value: 'unknown', label: 'Unknown' }] : [])],
      languages: availableLanguages(entries).map((c) => ({ value: c, label: languageName(c) })),
      characters: [...new Set(entries.flatMap((e) => e.characters))].map(getCharacter).filter(Boolean)
        .map((c) => ({ value: c.id, label: c.name.en })).sort((a, b) => a.label.localeCompare(b.label)),
      hasPreservation: entries.some((e) => e.preservation),
    };
  }, [series]);

  const fields = [
    { type: 'range', label: isMovie ? 'Movie number' : 'Episode number', minName: 'numMin', maxName: 'numMax' },
    { type: 'select', name: 'year', label: 'Release year', options: options.years, allLabel: 'Any year' },
    { type: 'select', name: 'language', label: 'Language', options: options.languages, allLabel: 'Any language' },
    { type: 'select', name: 'availability', label: 'Availability', options: getCategories().sourceStatuses.map((s) => ({ value: s.id, label: s.label })), allLabel: 'Any availability' },
    { type: 'select', name: 'character', label: 'Character', options: options.characters, allLabel: 'Any character' },
    ...(options.hasPreservation
      ? [{ type: 'select', name: 'preservation', label: 'Preservation', options: PRESERVATION_STATUSES.map((s) => ({ value: s.id, label: s.label })), allLabel: 'Any status' }]
      : []),
  ];

  const filtered = useMemo(() => sortEntries(filterEntries(series.entries, values), values.sort), [series, values]);
  const page = paginate(filtered, values.page);
  const first = page.total ? (page.page - 1) * 24 + 1 : 0;
  const goToPage = (p) => {
    update({ page: p });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const sorts = isMovie ? MOVIE_SORTS : EPISODE_SORTS;

  return (
    <PageContainer className="catalog">
      <header className="catalog-header">
        <div className="catalog-header__body">
          <p className="eyebrow">{isMovie ? 'Theatrical catalogue' : 'Television catalogue'}</p>
          <h1>{series.title}</h1>
          <p className="catalog-header__desc">{series.description}</p>
          <dl className="stat-row">
            <div><dt>Documented</dt><dd>{stats.total}</dd></div>
            <div><dt>With available sources</dt><dd>{stats.withSources}</dd></div>
            <div><dt>Metadata complete</dt><dd>{stats.complete}</dd></div>
            {series.yearsCovered ? <div><dt>Years covered</dt><dd>{series.yearsCovered}</dd></div> : null}
          </dl>
        </div>
      </header>

      {before}

      <div className="catalog-controls" ref={resultsRef}>
        <SearchBar value={values.q} onChange={(q) => update({ q })} label={`Search ${noun}`} placeholder={`Search ${noun} by title or number`} />
        <div className="field field--inline">
          <label htmlFor="sort-select">Sort by</label>
          <div className="select-wrap">
            <select id="sort-select" value={values.sort} onChange={(e) => update({ sort: e.target.value })}>
              {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <svg className="select-wrap__chev icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>
      </div>

      <FilterPanel fields={fields} values={values} onChange={update} onReset={() => reset()} />

      <p className="results-count" aria-live="polite">
        {page.total ? <>Showing {first}–{first + page.items.length - 1} of {page.total} {noun}</> : `No ${noun} match`}
      </p>

      {page.total === 0 ? (
        <EmptyState
          title={series.entries.length === 0 ? `No ${noun} documented yet` : `No ${noun} match these filters`}
          message={series.entries.length === 0 ? 'This catalogue is empty for now. Contributions are welcome.' : 'Try removing a filter or searching for something broader.'}
          action={series.entries.length === 0 ? null : <button type="button" className="btn btn--ghost" onClick={() => reset()}>Clear search and filters</button>}
        />
      ) : (
        <div className={`grid ${isMovie ? 'grid--movies' : 'grid--episodes'}`}>
          {page.items.map((e) => (isMovie ? <MovieCard key={e.id} entry={e} /> : <EpisodeCard key={e.id} entry={e} showPreservation={options.hasPreservation} />))}
        </div>
      )}
      <Pagination page={page.page} pageCount={page.pageCount} onChange={goToPage} />
    </PageContainer>
  );
}
