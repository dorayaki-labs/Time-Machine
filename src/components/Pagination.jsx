import Icon from './Icon.jsx';

function pagesToShow(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1]);
  const list = [...set].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) out.push('gap-' + p);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="pagination__btn" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <Icon name="chevronLeft" size={18} />
      </button>
      {pagesToShow(page, pageCount).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="pagination__gap" aria-hidden="true">…</span>
        ) : (
          <button key={p} type="button" className={`pagination__btn${p === page ? ' is-current' : ''}`} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`}>
            {p}
          </button>
        ),
      )}
      <button type="button" className="pagination__btn" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
        <Icon name="chevronRight" size={18} />
      </button>
    </nav>
  );
}
