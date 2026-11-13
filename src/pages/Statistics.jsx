// Public statistics — a data exploration of the archive and its community.
// Accessible to everyone, signed out included: archive numbers come from the
// loaded catalogue, community numbers from the public activity feed (one
// request feeds every community chart). A category selector (overall, each
// series, movies) re-scopes every number and chart at once.
//
// Honesty rules (see lib/statsCharts.js for the full list): the archive does
// not define an EXPECTED episode total, so no invented "X of 1,000" — the
// progress bar shows completeness WITHIN the documented set, labelled as
// such. Charts render nothing rather than fabricate (unknown ≠ zero), and
// an episode with multiple segments is still one documented episode.

import { useEffect, useMemo, useState } from 'react';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import Icon from '@/components/Icon.jsx';
import { DonutChart, BarChart } from '@/components/charts.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import useDocumentTitle from '@/hooks/useDocumentTitle.js';
import { getAllEntries, getEntries, getCharacters, getGadgets, SERIES, SERIES_IDS, HISTORICAL_IDS } from '@/lib/catalog.js';
import { fetchPublicLog } from '@/lib/stats.js';
import {
  archiveCategoryStats, entriesByYear, segmentsHistogram, characterLoadHistogram,
  usageRanking, characterCombos, communityStats, monthlyActivity,
} from '@/lib/statsCharts.js';

// Chart colours are theme tokens (custom themes stay legible); the series
// distribution uses accent mixes so one hue carries the whole donut.
const C = (p) => `color-mix(in srgb, var(--accent) ${p}%, var(--surface-2))`;
const SERIES_COLORS = {
  'anime-1979': C(100), 'anime-2005': C(72), movies: C(48), 'anime-1973': C(28),
};
const STATUS_SLICES = (stats) => [
  { label: 'Fully documented', value: stats.complete, color: 'var(--ok)' },
  { label: 'Partially documented', value: stats.partial, color: 'var(--warn)' },
  { label: 'Metadata incomplete', value: stats.incomplete, color: 'var(--text-3)' },
];
const SOURCE_SLICES = (stats) => [
  { label: 'With a playable source', value: stats.withSources, color: 'var(--ok)' },
  { label: 'No source yet', value: stats.total - stats.withSources, color: 'var(--text-3)' },
];

function ProgressPanel({ title, subtitle, stats, unit, contributions, contributionsKnown }) {
  const documented = stats.total;
  const pct = documented ? Math.round((stats.complete / documented) * 100) : 0;
  return (
    <section className="stats-progress" aria-label="Archive progress">
      <div className="stats-progress__main">
        <h2>{title}</h2>
        <p className="stats-progress__count">
          <strong className="stats-progress__number">{documented.toLocaleString()}</strong>
          {unit} documented
          {subtitle ? <span className="muted"> · {subtitle}</span> : null}
        </p>
        <div
          className="stats-progress__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={documented}
          aria-valuenow={stats.complete}
          aria-label={`${stats.complete} of ${documented} ${unit} fully documented`}
        >
          <span style={{ width: `${documented ? Math.max(1.5, pct) : 0}%` }} />
        </div>
        <p className="stats-progress__pct muted small">
          {stats.complete.toLocaleString()} of {documented.toLocaleString()} documented {unit} are
          fully documented ({pct}%) — completeness within the documented set. The archive defines no
          expected total, so no share of "every episode ever made" is claimed.
        </p>
      </div>
      <dl className="stats-progress__facts">
        <div><dt>Documented</dt><dd><strong>{documented.toLocaleString()}</strong></dd></div>
        <div><dt>Fully documented</dt><dd><strong>{stats.complete.toLocaleString()}</strong></dd></div>
        <div><dt>Partially documented</dt><dd><strong>{stats.partial.toLocaleString()}</strong></dd></div>
        <div><dt>Community contributions</dt>
          <dd><strong>{contributionsKnown ? contributions.toLocaleString() : '—'}</strong></dd></div>
      </dl>
    </section>
  );
}

function ChartCard({ title, note, aside, children }) {
  return (
    <section className="chart-card" aria-label={title}>
      <header className="chart-card__head">
        <h3>{title}</h3>
        {aside ? <span className="chart-card__aside muted small">{aside}</span> : null}
      </header>
      {children}
      {note ? <p className="chart-card__note muted small">{note}</p> : null}
    </section>
  );
}

export default function Statistics() {
  useDocumentTitle('Statistics');
  const { backendConfigured } = useAuth();
  const [category, setCategory] = useState('all');
  const [logRows, setLogRows] = useState(null);
  const [logError, setLogError] = useState(null);

  // One request feeds every community chart on the page.
  useEffect(() => {
    let active = true;
    if (!backendConfigured) return undefined;
    fetchPublicLog({ limit: 400 })
      .then((rows) => active && setLogRows(rows ?? []))
      .catch((err) => active && setLogError(err.message));
    return () => { active = false; };
  }, [backendConfigured]);

  const categories = [
    { id: 'all', label: 'Overall' },
    ...SERIES_IDS.map((id) => ({ id, label: `${SERIES[id].short} Series` })),
    ...HISTORICAL_IDS.map((id) => ({ id, label: `${SERIES[id].short} Series`, historical: true })),
  ];

  const entries = category === 'all' ? getAllEntries() : getEntries(category);
  const stats = useMemo(() => archiveCategoryStats(entries), [entries]);
  const meta = category === 'all' ? null : SERIES[category];
  const isMovies = category === 'movies';

  const unit = category === 'all' ? 'entries' : isMovies ? 'movies' : 'episodes';
  const title = category === 'all' ? 'The Archive' : `${meta.label} Archive`;
  const subtitle = category === 'all' ? 'every series, every movie' : meta.yearsCovered;

  const community = useMemo(() => (logRows ? communityStats(logRows) : null), [logRows]);
  const scopedContributions = useMemo(() => {
    if (!logRows) return null;
    if (category === 'all') return logRows.length;
    return logRows.filter((r) => r.entry_series === category).length;
  }, [logRows, category]);

  const characterRanking = useMemo(() => usageRanking(entries, getCharacters(), 'characters'), [entries]);
  const gadgetRanking = useMemo(() => usageRanking(entries, getGadgets(), 'gadgets'), [entries]);
  const yearBars = useMemo(() => entriesByYear(entries), [entries]);
  const segmentBars = useMemo(() => segmentsHistogram(entries), [entries]);
  const charLoadBars = useMemo(() => characterLoadHistogram(entries), [entries]);
  const combos = useMemo(() => characterCombos(entries, getCharacters()), [entries]);
  const monthly = useMemo(() => monthlyActivity(logRows ?? []), [logRows]);

  const distributionSlices = useMemo(() => SERIES_IDS.map((id) => ({
    label: SERIES[id].label,
    value: getEntries(id).length,
    color: SERIES_COLORS[id],
  })), []);
  const statusSlices = useMemo(() => STATUS_SLICES(stats), [stats]);
  const sourceSlices = useMemo(() => SOURCE_SLICES(stats), [stats]);
  const communitySlices = community ? [
    { label: 'Accepted', value: community.byStatus.accepted, color: 'var(--ok)' },
    { label: 'Pending', value: community.byStatus.pending, color: 'var(--warn)' },
    { label: 'Declined', value: community.byStatus.declined, color: 'var(--bad)' },
    { label: 'Deleted', value: community.byStatus.deleted, color: 'var(--text-3)' },
  ] : [];

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Community project</p>
        <h1>Statistics</h1>
        <p className="page-opening__lead">
          How far the archive reaches, who appears in it, and what the community has been
          doing — computed live from the records, never estimated.
        </p>
      </div>

      <div className="panel-tabs" role="tablist" aria-label="Statistics category">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.id}
            className={category === cat.id ? 'is-active' : ''}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
            {cat.historical ? <span className="muted small"> (historical)</span> : null}
          </button>
        ))}
      </div>

      <ProgressPanel
        title={title}
        subtitle={subtitle}
        stats={stats}
        unit={unit}
        contributions={scopedContributions ?? 0}
        contributionsKnown={scopedContributions !== null}
      />

      <h2 className="section-heading">The archive</h2>
      <div className="chart-grid">
        <ChartCard title="Documentation status" aside={`${stats.total.toLocaleString()} ${unit}`}>
          <DonutChart slices={statusSlices} unit="" center={{ value: `${Math.round((stats.complete / Math.max(1, stats.total)) * 100)}%`, label: 'fully documented' }} />
        </ChartCard>
        <ChartCard title="Playable sources" note="Entries with at least one viewing source submitted.">
          <DonutChart slices={sourceSlices} unit="" center={{ value: stats.withSources.toLocaleString(), label: 'with a source' }} />
        </ChartCard>
        {category === 'all' ? (
          <ChartCard title="Documented entries by series">
            <DonutChart slices={distributionSlices} unit="" center={{ value: stats.total.toLocaleString(), label: 'entries' }} />
          </ChartCard>
        ) : null}
        <ChartCard title="Entries by year" note="By the records' own release dates; entries without a date are left out, not counted as zero.">
          <BarChart bars={yearBars} />
        </ChartCard>
      </div>

      <h2 className="section-heading">Characters</h2>
      <div className="chart-grid">
        <ChartCard title="Most appearances" aside={`${characterRanking.length} of ${getCharacters().length} documented`}>
          <BarChart bars={characterRanking.slice(0, 8).map((r) => ({ id: r.id, label: r.name, value: r.value, href: `/characters/${r.id}` }))} />
        </ChartCard>
        {characterRanking.length > 3 ? (
          <ChartCard title="Fewest appearances" note="Among characters that appear at least once — no claim is made about characters with no recorded appearances.">
            <BarChart bars={[...characterRanking].reverse().slice(0, 5).map((r) => ({ id: r.id, label: r.name, value: r.value, href: `/characters/${r.id}` }))} />
          </ChartCard>
        ) : null}
        {combos.length ? (
          <ChartCard title="Most common pairings" note="How often two characters are documented in the same entry.">
            <BarChart bars={combos} />
          </ChartCard>
        ) : null}
        {!isMovies ? (
          <ChartCard title="Characters per entry" note="How many distinct characters each entry documents.">
            <BarChart bars={charLoadBars} />
          </ChartCard>
        ) : null}
      </div>

      <h2 className="section-heading">Gadgets</h2>
      <div className="chart-grid">
        <ChartCard title="Most used" aside={`${gadgetRanking.length} of ${getGadgets().length} documented`}>
          <BarChart bars={gadgetRanking.slice(0, 8).map((r) => ({ id: r.id, label: r.name, value: r.value, href: `/gadgets/${r.id}` }))} />
        </ChartCard>
        {gadgetRanking.length > 3 ? (
          <ChartCard title="Least used" note="Among gadgets that appear at least once.">
            <BarChart bars={[...gadgetRanking].reverse().slice(0, 5).map((r) => ({ id: r.id, label: r.name, value: r.value, href: `/gadgets/${r.id}` }))} />
          </ChartCard>
        ) : null}
        {!isMovies ? (
          <ChartCard title="Segments per episode" note="Episodes by how many segments they carry; movies have none by shape.">
            <BarChart bars={segmentBars} />
          </ChartCard>
        ) : null}
      </div>

      <h2 className="section-heading">Community</h2>
      {!backendConfigured ? (
        <p className="notice">The contribution backend is not connected yet, so community
          statistics are unavailable. The archive itself is fully functional.</p>
      ) : logError ? (
        <p className="notice notice--warn">Community statistics could not be loaded right now ({logError}).
          The archive itself is unaffected.</p>
      ) : community === null ? (
        <LoadingState label="Loading community statistics…" />
      ) : (
        <div className="chart-grid">
          <ChartCard title="Contribution outcomes" aside={`${community.byStatus.submitted.toLocaleString()} submitted`}>
            <DonutChart slices={communitySlices} unit="" center={{ value: community.byStatus.accepted.toLocaleString(), label: 'accepted' }} />
          </ChartCard>
          <ChartCard title="Most active contributors" note="Contributors by accepted, published contributions.">
            <BarChart bars={community.topContributors.map((r) => ({ id: r.username, label: r.name ?? r.username, value: r.value, href: `/${r.username}` }))} />
          </ChartCard>
          <ChartCard title="Contributions over time" note="Submissions per month, the last 12 months.">
            <BarChart bars={monthly} />
          </ChartCard>
          {category === 'all' ? (
            <ChartCard title="Contributions by series" note="Where the community's work landed, by the entry's series.">
              <BarChart bars={community.bySeries.map((row) => ({ id: row.series, label: SERIES[row.series]?.label ?? row.series, value: row.count }))} />
            </ChartCard>
          ) : null}
        </div>
      )}

      <p className="muted small stats-footnote">
        <Icon name="alert" size={13} /> Every number on this page is computed live from the archive
        records and the public activity feed — nothing is estimated, and where the archive is
        silent (no source, no appearance, no date) the charts stay silent too.
      </p>
    </PageContainer>
  );
}
