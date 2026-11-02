import { useMemo } from 'react';
import PageContainer from '@/components/PageContainer.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterPanel from '@/components/FilterPanel.jsx';
import CharacterCard from '@/components/CharacterCard.jsx';
import Pagination from '@/components/Pagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useQueryState from '@/hooks/useQueryState.js';
import { getCharacters, getCategories, getEntries, displayTitle } from '@/lib/catalog.js';
import { filterPeople, paginate } from '@/lib/filters.js';

const DEFAULTS = { q: '', category: '', series: '', movie: '', page: '1' };

export default function Characters() {
  useDocumentTitle('Characters');
  const [values, update, reset] = useQueryState(DEFAULTS);
  const all = getCharacters();
  const filtered = useMemo(() => filterPeople(all, 'character', values), [all, values]);
  const page = paginate(filtered, values.page);

  const fields = [
    { type: 'select', name: 'category', label: 'Category', allLabel: 'Any category', options: getCategories().characterCategories.map((c) => ({ value: c.id, label: c.label })) },
    { type: 'select', name: 'series', label: 'Archive appearances', allLabel: 'Any', options: [
      { value: 'anime-1979', label: 'Anime (1979)' }, { value: 'anime-2005', label: 'Anime (2005)' },
      { value: 'anime-1973', label: 'Anime (1973)' }, { value: 'movies', label: 'Movies' }] },
    { type: 'select', name: 'movie', label: 'Movie appearances', allLabel: 'Any movie', options: getEntries('movies').map((m) => ({ value: m.id, label: displayTitle(m) })) },
  ];

  return (
    <PageContainer className="directory">
      <header className="page-head">
        <p className="eyebrow">Directory</p>
        <h1>Characters</h1>
        <p className="page-head__lead">The people, robots, and relatives of Doraemon’s world. Every appearance on a character’s page is generated from the archive’s catalogues.</p>
      </header>
      <div className="catalog-controls catalog-controls--single">
        <SearchBar value={values.q} onChange={(q) => update({ q })} label="Search characters" placeholder="Search by name, Japanese name, or alias" />
      </div>
      <FilterPanel fields={fields} values={values} onChange={update} onReset={() => reset()} />
      <p className="results-count" aria-live="polite">{page.total} {page.total === 1 ? 'character' : 'characters'}</p>
      {page.total === 0 ? (
        <EmptyState icon="user" title="No characters match" message="Try a different name or remove a filter." action={<button type="button" className="btn btn--ghost" onClick={() => reset()}>Clear search and filters</button>} />
      ) : (
        <div className="grid grid--people">{page.items.map((c) => <CharacterCard key={c.id} character={c} />)}</div>
      )}
      <Pagination page={page.page} pageCount={page.pageCount} onChange={(p) => update({ page: p })} />
    </PageContainer>
  );
}
