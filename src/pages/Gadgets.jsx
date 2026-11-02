import { useMemo } from 'react';
import PageContainer from '@/components/PageContainer.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import FilterPanel from '@/components/FilterPanel.jsx';
import GadgetCard from '@/components/GadgetCard.jsx';
import Pagination from '@/components/Pagination.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import useQueryState from '@/hooks/useQueryState.js';
import { getGadgets, getEntries, displayTitle, SERIES_IDS } from '@/lib/catalog.js';
import { filterPeople, paginate } from '@/lib/filters.js';

const DEFAULTS = { q: '', series: '', movie: '', page: '1' };

export default function Gadgets() {
  useDocumentTitle('Gadgets');
  const [values, update, reset] = useQueryState(DEFAULTS);
  const all = getGadgets();
  const filtered = useMemo(() => filterPeople(all, 'gadget', values), [all, values]);
  const page = paginate(filtered, values.page);

  const fields = [
    { type: 'select', name: 'series', label: 'Associated anime', allLabel: 'Any', options: SERIES_IDS.map((id) => ({ value: id, label: `Anime (${id.slice(-4)})` })) },
    { type: 'select', name: 'movie', label: 'Associated movie', allLabel: 'Any movie', options: getEntries('movies').map((m) => ({ value: m.id, label: displayTitle(m) })) },
  ];

  return (
    <PageContainer className="directory">
      <header className="page-head">
        <p className="eyebrow">Directory</p>
        <h1>Gadgets</h1>
        <p className="page-head__lead">Doraemon's inventions from the four-dimensional pocket. Where and when each one appears is worked out from the episode and movie records.</p>
      </header>
      <div className="catalog-controls catalog-controls--single">
        <SearchBar value={values.q} onChange={(q) => update({ q })} label="Search gadgets" placeholder="Search by name, Japanese name, or alias" />
      </div>
      <FilterPanel fields={fields} values={values} onChange={update} onReset={() => reset()} />
      <p className="results-count" aria-live="polite">{page.total} {page.total === 1 ? 'gadget' : 'gadgets'}</p>
      {page.total === 0 ? (
        <EmptyState icon="gadget" title="No gadgets match" message="Try a different name or remove a filter." action={<button type="button" className="btn btn--ghost" onClick={() => reset()}>Clear search and filters</button>} />
      ) : (
        <div className="grid grid--people">{page.items.map((g) => <GadgetCard key={g.id} gadget={g} />)}</div>
      )}
      <Pagination page={page.page} pageCount={page.pageCount} onChange={(p) => update({ page: p })} />
    </PageContainer>
  );
}
