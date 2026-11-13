// Unit tests for the pure logic behind profiles, notifications data and the
// statistics page. Run: node scripts/test-profile-stats.mjs
// These cover the pieces that are pure functions; the Supabase-backed flows
// (RLS, notification generation) are verified in DEPLOYMENT.md checklists.

import { tallyContributions, activityByDay, activityLevel, monthGrid, monthAnchor, monthsAway, dayKey } from '../src/lib/profileStats.js';
import { archiveCategoryStats, entriesByYear, segmentsHistogram, characterLoadHistogram, usageRanking, characterCombos, communityStats, monthlyActivity } from '../src/lib/statsCharts.js';
import { attributionFor } from '../src/lib/attribution.js';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failed += 1;
};

// ---------- profileStats ----------
{
  const rows = [
    { status: 'accepted', created_at: '2026-02-01T10:00:00Z' },
    { status: 'accepted', created_at: '2026-02-01T18:00:00Z' },
    { status: 'pending', created_at: '2026-02-02T10:00:00Z' },
    { status: 'declined', created_at: '2026-03-05T10:00:00Z' },
    { status: 'deleted', created_at: '2026-03-05T11:00:00Z' },
    { status: 'accepted', created_at: null }, // unknown timestamp: skipped, not zeroed
  ];
  const tally = tallyContributions(rows);
  check('tally: submitted counts every row (6)', tally.submitted === 6, JSON.stringify(tally));
  check('tally: accepted/pending/declined/deleted split (3/1/1/1 — null-dated row still counts)',
    tally.accepted === 3 && tally.pending === 1 && tally.declined === 1 && tally.deleted === 1);

  const activity = activityByDay(rows);
  check('activityByDay: same-day submissions bucket together (2)',
    activity.get('2026-02-01') === 2, JSON.stringify([...activity]));
  check('activityByDay: null created_at skipped', activity.size === 3);

  check('activityLevel: 0 stays 0', activityLevel(0, 5) === 0);
  check('activityLevel: max is 4', activityLevel(5, 5) === 4);
  check('activityLevel: tiny-but-active is at least 1', activityLevel(1, 100) === 1);
  check('activityLevel: just over half is 3', activityLevel(51, 100) === 3);
  check('activityLevel: exactly half stays 2', activityLevel(50, 100) === 2);
  check('activityLevel: quarter-ish is 2', activityLevel(30, 100) === 2);

  const today = new Date(2026, 1, 20); // Feb 20 2026
  const feb = monthAnchor(0, today);
  const weeks = monthGrid(feb, activityByDay(rows), today);
  check('monthGrid: February 2026 starts on a Sunday (1st leads 6 pads)', weeks[0].filter((c) => !c).length === 6);
  check('monthGrid: 28 days present', weeks.flat().filter((c) => c?.inMonth).length === 28);
  check('monthGrid: no future cells marked past today', weeks.flat().every((c) => !c || !c.future || c.date > today));
  check('monthGrid: rows padded to full weeks', weeks.every((w) => w.length === 7));
  const lvl = weeks.flat().find((c) => c?.key === '2026-02-01')?.level;
  check('monthGrid: busiest day of month reaches level 4', lvl === 4, `got ${lvl}`);

  check('monthsAway: current month is 0', monthsAway(monthAnchor(0, today), today) === 0);
  check('monthsAway: 3 back is -3', monthsAway(monthAnchor(-3, today), today) === -3);
  check('dayKey: local formatting pads month/day', dayKey(new Date(2026, 2, 5)) === '2026-03-05');
}

// ---------- statsCharts ----------
{
  const entries = [
    { kind: 'episode', status: 'complete', availability: 'available', characters: ['a', 'b', 'a'], gadgets: ['x'], release: { date: '2005-04-22' }, segments: [{}, {}] },
    { kind: 'episode', status: 'partial', availability: 'unavailable', characters: ['a'], gadgets: [], release: { date: '2005-04-29' }, segments: [{}] },
    { kind: 'movie', status: 'complete', availability: 'available', characters: ['a', 'b'], gadgets: ['x', 'y'], release: { date: '2007-03-10' } },
    { kind: 'episode', status: 'metadata-incomplete', characters: [], gadgets: [], release: {} },
  ];
  const stats = archiveCategoryStats(entries);
  check('archive stats: totals (4 entries, 3 episodes, 1 movie)',
    stats.total === 4 && stats.episodes === 3 && stats.movies === 1);
  check('archive stats: statuses (2 complete, 1 partial, 1 incomplete)',
    stats.complete === 2 && stats.partial === 1 && stats.incomplete === 1);
  check('archive stats: with sources (2)', stats.withSources === 2);

  const years = entriesByYear(entries);
  check('entriesByYear: 2005 and 2007 only, missing date skipped',
    years.length === 2 && years[0].label === '2005' && years[0].value === 2 && years[1].value === 1);

  const segs = segmentsHistogram(entries);
  check('segmentsHistogram: movies excluded, 1-seg and 2-seg buckets',
    segs.some((s) => s.label === '1 segment' && s.value === 1) && segs.some((s) => s.label === '2 segments' && s.value === 1)
    && segs.length === 2, JSON.stringify(segs));

  const load = characterLoadHistogram(entries);
  check('characterLoadHistogram: dedupes repeated refs (["a","b","a"] = 2 characters)',
    load.find((l) => l.label === '2 characters')?.value === 2, JSON.stringify(load));
  check('characterLoadHistogram: exactly one entry with 1 distinct character',
    load.find((l) => l.label === '1 character')?.value === 1, JSON.stringify(load));
  check('characterLoadHistogram: zero-character entries absent, not zeroed',
    !load.some((l) => l.label.startsWith('0')), JSON.stringify(load));

  const people = [
    { id: 'a', name: { en: 'A' } },
    { id: 'b', name: { en: 'B' } },
    { id: 'zzz', name: { en: 'Never Used' } },
  ];
  const ranked = usageRanking(entries, people, 'characters');
  check('usageRanking: dedupes refs within an entry (a=3 not 4), sorts desc',
    ranked[0]?.id === 'a' && ranked[0]?.value === 3 && ranked[1]?.id === 'b' && ranked[1]?.value === 2,
    JSON.stringify(ranked));
  check('usageRanking: never-referenced records are absent, not zero',
    !ranked.some((r) => r.id === 'zzz'));

  const gadgets = usageRanking(entries, [{ id: 'x', name: { en: 'X' } }, { id: 'y', name: { en: 'Y' } }], 'gadgets');
  check('usageRanking: gadgets field used for the gadgets refKey',
    gadgets.length === 2 && gadgets[0]?.id === 'x' && gadgets[0]?.value === 2, JSON.stringify(gadgets));

  const combos = characterCombos(entries, people);
  check('characterCombos: a+b pair counted once per entry (2)',
    combos.length === 1 && combos[0].value === 2, JSON.stringify(combos));

  const logRows = [
    { status: 'accepted', entry_series: 'anime-2005', contributor_username: 'piesimp', contributor_name: 'Piesimp', submitted_at: '2026-02-01T10:00:00Z' },
    { status: 'accepted', entry_series: 'anime-2005', contributor_username: 'piesimp', contributor_name: 'Piesimp', submitted_at: '2026-02-10T10:00:00Z' },
    { status: 'pending', entry_series: null, contributor_username: 'newbie', contributor_name: 'Newbie', submitted_at: '2026-02-15T10:00:00Z' },
    { status: 'declined', entry_series: 'movies', contributor_username: 'newbie', contributor_name: 'Newbie', submitted_at: '2026-01-05T10:00:00Z' },
  ];
  const community = communityStats(logRows);
  check('communityStats: statuses (4 submitted, 2 accepted, 1 pending, 1 declined)',
    community.byStatus.submitted === 4 && community.byStatus.accepted === 2
    && community.byStatus.pending === 1 && community.byStatus.declined === 1);
  check('communityStats: bySeries counts null-series rows out',
    community.bySeries.find((s) => s.series === 'anime-2005')?.count === 2);
  check('communityStats: top contributor ranks by ACCEPTED only (piesimp 2 > newbie 0)',
    community.topContributors[0]?.username === 'piesimp' && community.topContributors[0]?.value === 2
    && !community.topContributors.some((c) => c.username === 'newbie'));

  const today = new Date(2026, 2, 15); // March 2026
  const monthly = monthlyActivity(logRows, { months: 3, today });
  check('monthlyActivity: 3 buckets oldest first',
    monthly.length === 3 && monthly[0].label !== monthly[2].label);
  check('monthlyActivity: Feb 2026 has 3, Jan 2026 has 1, Mar 2026 has 0',
    monthly[1].value === 3 && monthly[0].value === 1 && monthly[2].value === 0, JSON.stringify(monthly));
}

// ---------- attribution ----------
{
  const logRows = [
    { entry_id: 'e1', status: 'accepted', submitted_at: '2026-01-01T00:00:00Z', reviewed_at: '2026-01-02T00:00:00Z', contributor_name: 'Ann', contributor_avatar: 'a', contributor_username: 'ann', reviewer_name: 'Checker', reviewer_avatar: 'c' },
    { entry_id: 'e1', status: 'accepted', submitted_at: '2026-02-01T00:00:00Z', reviewed_at: '2026-02-02T00:00:00Z', contributor_name: 'Bob', contributor_avatar: 'b', contributor_username: 'bob', reviewer_name: 'Checker', reviewer_avatar: 'c' },
    { entry_id: 'e1', status: 'declined', submitted_at: '2026-03-01T00:00:00Z', contributor_name: 'Eve', reviewer_name: 'Checker' }, // declined: not attribution
    { entry_id: 'other', status: 'accepted', submitted_at: '2026-04-01T00:00:00Z', reviewed_at: '2026-04-02T00:00:00Z', contributor_name: 'Zed', reviewer_name: 'Checker' },
  ];
  const editRows = [
    { entity_id: 'e1', action: 'archive.direct_edit', created_at: '2025-12-01T00:00:00Z', editor_name: 'Staff', editor_username: 'staff', editor_avatar: 's' },
    { entity_id: 'e1', action: 'archive.entry_deleted', created_at: '2026-05-01T00:00:00Z', editor_name: 'Ghost', editor_username: 'ghost' }, // not a direct edit
  ];

  const facts = attributionFor('e1', logRows, editRows);
  check('attribution: originally = earliest act (staff direct edit, Dec 2025)',
    facts.originally.name === 'Staff', JSON.stringify(facts.originally));
  check('attribution: last updated = newest accepted contribution (Bob)',
    facts.lastBy.name === 'Bob', JSON.stringify(facts.lastBy));
  check('attribution: verified by reviewer of newest accepted contribution',
    facts.verifiedBy?.name === 'Checker');
  check('attribution: declined submissions never count', !attributionFor('e1', [logRows[2]], []));
  check('attribution: unknown entry renders nothing (null)', attributionFor('nope', logRows, editRows) === null);
  const editsOnly = attributionFor('e1', [], editRows);
  check('attribution: direct edits alone carry attribution; entry_deleted is not an update',
    editsOnly?.originally?.name === 'Staff' && editsOnly.lastBy === null, JSON.stringify(editsOnly));

  const single = attributionFor('e1', [logRows[0]], []);
  check('attribution: one act, once — last-updated not duplicated',
    single.originally.name === 'Ann' && single.lastBy === null && single.verifiedBy?.name === 'Checker',
    JSON.stringify(single));
}

console.log(failed ? `\n${failed} check(s) FAILED.` : '\nALL PROFILE + STATS CHECKS PASS');
process.exit(failed ? 1 : 0);
