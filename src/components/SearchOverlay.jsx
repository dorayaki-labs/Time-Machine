import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useSearchOverlay } from '@/hooks/SearchContext.jsx';
import { search } from '@/lib/search.js';

const SUGGESTIONS = ['Episode 1', 'movie 1', 'ep 12', 'Gadget 1', 'Character 2'];

export default function SearchOverlay() {
  const { open, closeSearch } = useSearchOverlay();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const openerRef = useRef(null);
  const navigate = useNavigate();

  const results = useMemo(() => search(query, { perGroup: 4 }), [query]);
  const flat = useMemo(() => results.groups.flatMap((g) => g.items), [results]);

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);
  // start fresh every time the overlay is reopened
  useEffect(() => { if (!open) setQuery(''); }, [open]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  if (!open) return null;

  const go = (url) => {
    closeSearch();
    setQuery('');
    navigate(url);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (flat.length) setActive((i) => (i + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) go(flat[active].url);
      else if (query.trim()) go(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  let index = -1;
  return (
    <div className="search-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeSearch()}>
      <div className="search-dialog glass" role="dialog" aria-modal="true" aria-label="Search the archive" onKeyDown={onKeyDown}>
        <div className="search-dialog__input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="search-results"
            aria-activedescendant={flat[active] ? `sr-${flat[active].key}` : undefined}
            aria-label="Search episodes, movies, characters, and gadgets"
            placeholder="Search episodes, movies, characters, gadgets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" className="icon-btn icon-btn--sm" onClick={closeSearch} aria-label="Close search"><Icon name="close" size={18} /></button>
        </div>

        <div className="search-dialog__results" id="search-results" role="listbox" ref={listRef}>
          {!query.trim() ? (
            <div className="search-hint">
              <p>Search by English or Japanese title, alias, episode number, or movie number. Japanese titles lead for episodes that have no verified English title yet.</p>
              <div className="search-hint__chips">
                {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip chip--button" onClick={() => { setQuery(s); inputRef.current?.focus(); }}>{s}</button>)}
              </div>
            </div>
          ) : results.total === 0 ? (
            <div className="search-hint">
              <p className="search-hint__title">Nothing found for “{query.trim()}”</p>
              <p>Try a different spelling, a character name, or an episode number. If it is missing from the archive, you can <Link to="/contribute" onClick={closeSearch}>help add it</Link>.</p>
            </div>
          ) : (
            results.groups.map((g) => (
              <div className="search-group" role="group" aria-label={g.label} key={g.id}>
                <h3 className="search-group__title">{g.label} <span>{g.count}</span></h3>
                {g.items.map((item) => {
                  index += 1;
                  const i = index;
                  return (
                    <div
                      key={item.key}
                      id={`sr-${item.key}`}
                      role="option"
                      aria-selected={i === active}
                      className={`search-result${i === active ? ' is-active' : ''}`}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(item.url)}
                    >
                      <span className="search-result__title">{item.title}</span>
                      <span className="search-result__sub" lang={/[^\x00-\x7F]/.test(item.subtitle) ? 'ja' : undefined}>{item.subtitle}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="search-dialog__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
          {query.trim() ? <Link to={`/search?q=${encodeURIComponent(query.trim())}`} onClick={closeSearch} className="search-dialog__all">See all results</Link> : null}
        </div>
      </div>
    </div>
  );
}
