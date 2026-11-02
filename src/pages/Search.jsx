import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { search } from '@/lib/search.js';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [query, setQuery] = useState(initial);
  useEffect(() => setQuery(params.get('q') ?? ''), [params]);
  useDocumentTitle(initial ? `Search: ${initial}` : 'Search');

  const results = useMemo(() => search(query, { perGroup: 100 }), [query]);
  const onChange = (value) => {
    setQuery(value);
    setParams(value ? { q: value } : {}, { replace: true });
  };

  return (
    <PageContainer className="directory" narrow>
      <header className="page-head">
        <p className="eyebrow">Search</p>
        <h1>Search the archive</h1>
        <p className="page-head__lead">Episodes, movies, characters, and gadgets, by English or Japanese title, alias, or number.</p>
      </header>
      <SearchBar value={query} onChange={onChange} label="Search the archive" placeholder="Try “Episode 1”, “movie 3”, or “ep 12”" className="searchbar--large" />
      <div className="search-page-results" aria-live="polite">
        {!query.trim() ? (
          <EmptyState icon="search" title="Start typing to search" message="You can search across every catalogue at once." />
        ) : results.total === 0 ? (
          <EmptyState icon="search" title={`Nothing found for “${query.trim()}”`} message="Check the spelling, try a character name, or search by number. If it is missing, you can help add it." action={<Link to="/contribute" className="btn btn--ghost">Contribute to the archive</Link>} />
        ) : (
          results.groups.map((g) => (
            <section key={g.id} className="search-page-group" aria-label={g.label}>
              <h2>{g.label} <span className="muted">{g.count}</span></h2>
              <ul>
                {g.items.map((item) => (
                  <li key={item.key}>
                    <Link to={item.url} className="search-page-item">
                      <span className="search-page-item__title">{item.title}</span>
                      <span className="search-page-item__sub" lang={/[^\x00-\x7F]/.test(item.subtitle) ? 'ja' : undefined}>{item.subtitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </PageContainer>
  );
}
