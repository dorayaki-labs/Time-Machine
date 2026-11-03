// The staff area: moderation queue, archive editor, audit log and (for
// admins/owner) role management. The UI hides what the caller's role cannot
// do, but every rule is enforced again server-side — this page is
// convenience, not security.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Icon from '@/components/Icon.jsx';
import StatusChip from '@/components/StatusChip.jsx';
import { useAuth, isStaff, isAdmin, isOwner } from '@/hooks/useAuth.jsx';
import { fetchSubmissions, fetchAuditLog, STATUS_LABELS } from '@/lib/stats.js';
import { reviewContribution, directEditArchive, manageRole, reconcileSync } from '@/lib/staffApi.js';
import { deepDiff, fmtChangeValue } from '@/lib/diff.js';
import { getEntry, getRawEntry, getCharacter, getCharacters, getGadget, getGadgets, getSeries, getAllEntries } from '@/lib/catalog.js';
import { CONTRIBUTION_CATEGORIES } from '@/lib/contributionForms.js';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const entryLink = (entryId) => {
  if (!entryId) return null;
  if (entryId.startsWith('movie-')) return `/movies/${entryId}`;
  if (entryId.startsWith('anime-1973-')) return `/historical/1973/${entryId}`;
  if (entryId.startsWith('anime-1979-')) return `/anime/1979/${entryId}`;
  if (entryId.startsWith('anime-2005-')) return `/anime/2005/${entryId}`;
  if (entryId.startsWith('char-')) return `/characters/${entryId}`;
  if (entryId.startsWith('gadget-')) return `/gadgets/${entryId}`;
  return null;
};

const categoryLabel = (type) => CONTRIBUTION_CATEGORIES.find((c) => c.id === type)?.label ?? type;

function ChangesTable({ changes }) {
  if (!changes?.length) return <p className="muted small">No field-level changes recorded.</p>;
  return (
    <table className="changes-table">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>
        {changes.map((c, i) => (
          <tr key={i}>
            <td className="mono">{c.field}</td>
            <td className="mono">{fmtChangeValue(c.before)}</td>
            <td className="mono">{fmtChangeValue(c.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Archive editor (also used to build the patch when accepting a contribution)
// ---------------------------------------------------------------------------

const ENTITY_OPTIONS = [
  { value: 'episode', label: 'Episode' },
  { value: 'movie', label: 'Movie' },
  { value: 'character', label: 'Character' },
  { value: 'gadget', label: 'Gadget' },
];

function findEntity(entityType, entityId) {
  // The editor MUST edit the raw record file, not the merged catalogue entry:
  // the server compares the submitted baseRecord against the file on GitHub,
  // and any derived field (path, kind, forced arrays, normalized sources)
  // would make every edit fail with "changed since it was loaded".
  if (entityType === 'character') return getCharacters().find((c) => c.id === entityId) ?? null;
  if (entityType === 'gadget') return getGadgets().find((g) => g.id === entityId) ?? null;
  return getRawEntry(entityId);
}

function buildNewRecord(entityType, entityId) {
  if (entityType === 'character') {
    return { id: entityId, name: { en: '', ja: null }, aliases: [], description: null, category: 'main',
      image: { url: null, alt: null }, voiceActors: [], firstAppearance: { entryId: null, note: null }, references: [] };
  }
  if (entityType === 'gadget') {
    return { id: entityId, name: { en: '', ja: null }, aliases: [], description: null,
      image: { url: null, alt: null }, voiceActors: [], firstAppearance: { entryId: null, note: null }, howItWorks: null, references: [] };
  }
  const isMovie = entityType === 'movie';
  const number = isMovie ? Number(entityId.replace(/^movie-/, '')) : Number(entityId.split('-').pop());
  const seriesId = isMovie ? 'movies' : entityId.split('-').slice(0, 2).join('-');
  return {
    schemaVersion: 3, id: entityId, type: isMovie ? 'movie' : 'episode', seriesId, number,
    title: { en: '', ja: null }, alternateTitles: [], originalLanguage: 'ja',
    release: { date: null, precision: null, region: null }, summary: null,
    image: { url: null, alt: null }, screenshots: [], characters: [], gadgets: [], voiceActors: [],
    sources: [], references: [], ...(isMovie ? { durationMinutes: null, director: { en: null, ja: null } } : {}),
  };
}

/** One text field bound to a deep path of the draft record. */
function RecordField({ label, value, onChange, multiline, rows = 3, optional = true, placeholder }) {
  return (
    <div className="field">
      <label>{label}{optional ? <span className="field__opt"> (optional)</span> : <span className="field__req"> *</span>}</label>
      {multiline
        ? <textarea rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />
        : <input type="text" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value || null)} />}
    </div>
  );
}

function SourceRows({ sources, onChange }) {
  const update = (i, patch) => onChange(sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i) => onChange(sources.filter((_, j) => j !== i));
  const add = () => onChange([...sources, { type: 'direct', data: '', label: null, language: null, subtitles: 'none', quality: null, notes: null }]);
  return (
    <div className="field">
      <label>Viewing sources <span className="field__opt">(shown on the entry page; leave empty for none)</span></label>
      {sources.map((s, i) => (
        <div key={i} className="submission" style={{ padding: '0.8rem' }}>
          <div className="submission__fields">
            <div className="row"><dt>Type</dt><dd>
              <select value={s.type ?? ''} onChange={(e) => update(i, { type: e.target.value || null })}>
                <option value="">auto</option><option value="direct">direct</option>
                <option value="embed">embed</option><option value="youtube">youtube</option>
              </select>
            </dd></div>
            <div className="row"><dt>URL / iframe</dt><dd><input type="text" value={s.data ?? ''} onChange={(e) => update(i, { data: e.target.value })} /></dd></div>
            <div className="row"><dt>Label</dt><dd><input type="text" value={s.label ?? ''} onChange={(e) => update(i, { label: e.target.value || null })} /></dd></div>
            <div className="row"><dt>Audio language</dt><dd><input type="text" value={s.language ?? ''} onChange={(e) => update(i, { language: e.target.value || null })} /></dd></div>
            <div className="row"><dt>Subtitles</dt><dd>
              <select value={typeof s.subtitles === 'object' ? (s.subtitles.type ?? 'yes') : (s.subtitles ?? 'none')}
                onChange={(e) => update(i, { subtitles: e.target.value === 'none' ? 'none' : e.target.value === 'yes' ? true : e.target.value })}>
                <option value="none">none</option><option value="hard">hard sub</option>
                <option value="soft">soft sub</option><option value="yes">yes (unknown)</option>
              </select>
            </dd></div>
            <div className="row"><dt>Subtitle languages</dt><dd>
              <input type="text" value={Array.isArray(s.subtitles?.languages) ? s.subtitles.languages.join(', ') : ''}
                onChange={(e) => {
                  const langs = e.target.value ? e.target.value.split(',').map((x) => x.trim()).filter(Boolean) : [];
                  const base = typeof s.subtitles === 'object' && s.subtitles ? s.subtitles : { has: true, type: null, languages: [] };
                  update(i, { subtitles: { ...base, has: base.has ?? true, languages: langs } });
                }} />
            </dd></div>
            <div className="row"><dt>Quality</dt><dd><input type="text" value={s.quality ?? ''} onChange={(e) => update(i, { quality: e.target.value || null })} /></dd></div>
            <div className="row"><dt>Notes</dt><dd><input type="text" value={s.notes ?? ''} onChange={(e) => update(i, { notes: e.target.value || null })} /></dd></div>
          </div>
          <div className="btn-row"><button type="button" className="btn btn--ghost btn--danger" onClick={() => remove(i)}>Remove source</button></div>
        </div>
      ))}
      <div className="btn-row"><button type="button" className="btn btn--ghost" onClick={add}><Icon name="plus" size={15} /> Add a source</button></div>
    </div>
  );
}

function ArchiveEditor({ contribution, onApplied, onCancel }) {
  // When opened from a contribution: entityId/type preset and "commit" is the
  // accept action; otherwise it is a direct edit.
  const [entityType, setEntityType] = useState(contribution?.entityType ?? 'episode');
  const [entityId, setEntityId] = useState(contribution?.entityId ?? '');
  const [mode, setMode] = useState(contribution ? 'update' : 'update');
  const [base, setBase] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rawJson, setRawJson] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadEntity = (type, id) => {
    setError(null);
    const existing = findEntity(type, id);
    if (existing) {
      // Raw record file content — no derived fields to strip, so the committed
      // JSON matches the file schema and the server's baseRecord check passes.
      const raw = JSON.parse(JSON.stringify(existing));
      setBase(JSON.parse(JSON.stringify(raw))); setDraft(raw); setRawJson(JSON.stringify(raw, null, 2));
    } else {
      const fresh = buildNewRecord(type, id);
      setBase(null); setDraft(fresh); setRawJson(JSON.stringify(fresh, null, 2)); setMode('create');
    }
  };

  useEffect(() => {
    if (contribution?.entityId) loadEntity(contribution.entityType, contribution.entityId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (path, value) => setDraft((d) => {
    const next = structuredClone(d);
    const parts = path.split('.');
    let node = next;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ??= {};
    node[parts[parts.length - 1]] = value;
    return next;
  });

  const changes = useMemo(() => (base && draft ? deepDiff(base, draft) : []), [base, draft]);
  const canCommit = draft && entityId.trim();

  const commit = async () => {
    setBusy(true); setError(null);
    try {
      const record = showRaw ? JSON.parse(rawJson) : draft;
      const patch = { entityType, entityId: entityId.trim(), mode: base ? 'update' : 'create', record, ...(base ? { baseRecord: base } : {}) };
      if (contribution) {
        const res = await reviewContribution({
          action: 'accept', contributionId: contribution.id, proposedPatch: patch, reviewNotes: reviewNotes || null,
        });
        onApplied?.(res);
      } else {
        const res = await directEditArchive({ patch, reviewNotes: reviewNotes || null });
        onApplied?.(res);
      }
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="submission">
      <div className="submission__head">
        <h3 className="submission__title">{contribution ? `Apply to the archive & accept #${contribution.number}` : 'Archive editor'}</h3>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Close</button>
      </div>

      {!draft ? (
        <div className="filter-row">
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Entity type">
            {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="text" list="entity-ids" placeholder="e.g. anime-1979-0001, movie-0001, char-doraemon" value={entityId}
            onChange={(e) => setEntityId(e.target.value)} aria-label="Entity id" style={{ minWidth: '260px' }} />
          <datalist id="entity-ids">
            {entityType === 'character' || entityType === 'gadget'
              ? (entityType === 'character' ? getCharacters() : getGadgets()).map((r) => <option key={r.id} value={r.id} />)
              : getAllEntries().filter((e) => (entityType === 'movie') === (e.kind === 'movie')).map((e) => <option key={e.id} value={e.id} />)}
          </datalist>
          <button type="button" className="btn btn--primary" disabled={!entityId.trim()} onClick={() => loadEntity(entityType, entityId.trim())}>Load record</button>
        </div>
      ) : (
        <>
          <p className="submission__meta">
            Editing <strong className="mono">{entityType} {entityId}</strong>
            {base ? '' : ' (new record)'}
            <button type="button" className="btn btn--ghost" style={{ marginLeft: '0.8rem' }} onClick={() => { setDraft(null); setBase(null); }}>Choose another record</button>
          </p>

          <div className="btn-row" style={{ margin: '0.6rem 0' }}>
            <button type="button" className={`btn btn--ghost${showRaw ? ' is-active' : ''}`} onClick={() => { setShowRaw((v) => !v); setRawJson(JSON.stringify(draft, null, 2)); }}>
              {showRaw ? 'Structured editor' : 'Raw JSON editor'}
            </button>
          </div>

          {showRaw ? (
            <div className="field">
              <label>Raw JSON <span className="field__opt">(advanced — malformed JSON cannot be saved)</span></label>
              <textarea rows={18} className="mono" value={rawJson} onChange={(e) => { setRawJson(e.target.value); }} spellCheck={false} />
              <button type="button" className="btn btn--ghost" style={{ marginTop: '0.5rem' }} onClick={() => { try { setDraft(JSON.parse(rawJson)); setError(null); } catch (err) { setError(`Invalid JSON: ${err.message}`); } }}>Apply JSON to the draft</button>
            </div>
          ) : (
            <div className="contribution-form__grid">
              {(entityType === 'episode' || entityType === 'movie') ? (
                <>
                  <RecordField label="English title" value={draft.title?.en} onChange={(v) => setField('title.en', v ?? '')} optional={false} />
                  <RecordField label="Japanese title" value={draft.title?.ja} onChange={(v) => setField('title.ja', v)} />
                  <RecordField label="Release date" placeholder="YYYY, YYYY-MM or YYYY-MM-DD" value={draft.release?.date} onChange={(v) => setField('release.date', v)} />
                  <RecordField label="Summary" multiline value={draft.summary} onChange={(v) => setField('summary', v)} />
                  <RecordField label="Main image URL" value={draft.image?.url} onChange={(v) => setField('image.url', v)} />
                  <RecordField label="Image alt text" value={draft.image?.alt} onChange={(v) => setField('image.alt', v)} />
                  <RecordField label="Characters (ids, comma-separated)" value={(draft.characters ?? []).join(', ')} onChange={(v) => setField('characters', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])} />
                  <RecordField label="Gadgets (ids, comma-separated)" value={(draft.gadgets ?? []).join(', ')} onChange={(v) => setField('gadgets', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])} />
                  {entityType === 'movie' ? <RecordField label="Runtime (minutes)" value={draft.durationMinutes} onChange={(v) => setField('durationMinutes', v ? Number(v) : null)} /> : null}
                  {entityType === 'movie' ? <RecordField label="Director (English)" value={draft.director?.en} onChange={(v) => setField('director.en', v)} /> : null}
                  <div className="span-2"><SourceRows sources={draft.sources ?? []} onChange={(list) => setField('sources', list)} /></div>
                </>
              ) : (
                <>
                  <RecordField label="English name" value={draft.name?.en} onChange={(v) => setField('name.en', v ?? '')} optional={false} />
                  <RecordField label="Japanese name" value={draft.name?.ja} onChange={(v) => setField('name.ja', v)} />
                  <RecordField label="Aliases (comma-separated)" value={(draft.aliases ?? []).join(', ')} onChange={(v) => setField('aliases', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])} />
                  {entityType === 'character' ? <RecordField label="Category" placeholder="main / supporting / …" value={draft.category} onChange={(v) => setField('category', v)} /> : null}
                  {entityType === 'gadget' ? <RecordField label="How it works" multiline value={draft.howItWorks} onChange={(v) => setField('howItWorks', v)} /> : null}
                  <RecordField label="Description" multiline rows={5} value={draft.description} onChange={(v) => setField('description', v)} optional={false} />
                  <RecordField label="Image URL" value={draft.image?.url} onChange={(v) => setField('image.url', v)} />
                  <RecordField label="Image alt text" value={draft.image?.alt} onChange={(v) => setField('image.alt', v)} />
                  <RecordField label="First appearance (entry id or note)" value={draft.firstAppearance?.note ?? draft.firstAppearance?.entryId} onChange={(v) => setField('firstAppearance', { entryId: v && /^((anime-(1979|2005|1973)-\d{4})|movie-\d{4})$/.test(v) ? v : null, note: v && !/^((anime-(1979|2005|1973)-\d{4})|movie-\d{4})$/.test(v) ? v : null })} />
                </>
              )}
            </div>
          )}

          <h4 className="section-heading" style={{ marginTop: '1.4rem' }}>Preview of changes</h4>
          {base ? (changes.length ? <ChangesTable changes={changes} /> : <p className="muted small">No changes yet.</p>)
            : <p className="muted small">New record — the whole entry will be created.</p>}

          <div className="field" style={{ marginTop: '1rem' }}>
            <label>Review note <span className="field__opt">(optional, shown in the audit log and to the contributor)</span></label>
            <textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
          </div>

          {error ? <p className="notice notice--error" role="alert">{error}</p> : null}

          <div className="submission__actions">
            <button type="button" className="btn btn--primary" disabled={busy || !canCommit || (base && changes.length === 0)} onClick={commit}>
              {busy ? 'Working…' : base ? (contribution ? 'Accept & commit to the archive' : 'Commit direct edit') : 'Create the record'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission detail / review card
// ---------------------------------------------------------------------------

function SubmissionDetail({ row, onAcceptApplied, onRefresh, canReview, canDelete }) {
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const payload = row.payload_edited ?? row.payload ?? {};
  const link = entryLink(row.entry_id);

  const act = async (fn, done) => {
    setBusy(true); setError(null); setMessage(null);
    try { const res = await fn(); done?.(res); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <article className="submission" id={`submission-${row.number}`}>
      <div className="submission__head">
        <div>
          <h3 className="submission__title">#{row.number} · {row.title}</h3>
          <p className="submission__meta">
            {categoryLabel(row.type)} · by <strong>{row.profiles?.display_name ?? 'unknown'}</strong>
            {row.entry_id ? <> · <span className="mono">{row.entry_id}</span>{link ? <> <Link to={link}>view entry →</Link></> : null}</> : null}
            <br />submitted {fmtTime(row.created_at)}
          </p>
        </div>
        <StatusChip status={row.status} />
      </div>

      <dl className="submission__fields">
        {Object.entries(payload).map(([key, value]) => (
          <div className="row" key={key}>
            <dt>{key}</dt>
            <dd>{typeof value === 'string' && /^https?:\/\//.test(value)
              ? <a href={value} target="_blank" rel="noreferrer noopener">{value}</a>
              : typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd>
          </div>
        ))}
      </dl>

      {row.review_reason ? (
        <p className="notice" style={{ marginTop: 0 }}>
          <strong>Reviewer note:</strong> {row.review_reason}
        </p>
      ) : null}
      {row.sync_state === 'failed' ? (
        <p className="notice notice--warn">The archive update failed: {row.sync_error}. An admin can retry it from the Admin tab (reconcile).</p>
      ) : null}

      {message ? <p className="notice" role="status">{message}</p> : null}
      {error ? <p className="notice notice--error" role="alert">{error}</p> : null}

      {canReview && row.status === 'pending' ? (
        <>
          <div className="submission__actions">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => setEditorOpen((v) => !v)}>
              {editorOpen ? 'Close editor' : 'Open in archive editor…'}
            </button>
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setDeclineOpen((v) => !v)}>Decline…</button>
            {canDelete ? <button type="button" className="btn btn--ghost btn--danger" disabled={busy} onClick={() => setDeleteOpen((v) => !v)}>Delete…</button> : null}
          </div>

          {editorOpen ? (
            <div style={{ marginTop: '1rem' }}>
              <ArchiveEditor
                contribution={{
                  id: row.id, number: row.number, entityType: row.type === 'source' || row.type === 'images'
                    ? (row.entry_id?.startsWith('movie-') ? 'movie' : 'episode')
                    : row.entry_id?.startsWith('char-') ? 'character' : row.entry_id?.startsWith('gadget-') ? 'gadget' : 'episode',
                  entityId: row.entry_id,
                }}
                onApplied={(res) => { setEditorOpen(false); setMessage(`Accepted and committed${res?.commit_sha ? ` (commit ${String(res.commit_sha).slice(0, 7)})` : ''}.`); onAcceptApplied?.(); }}
                onCancel={() => setEditorOpen(false)}
              />
            </div>
          ) : null}

          {declineOpen ? (
            <div className="field" style={{ marginTop: '0.8rem' }}>
              <label>Reason for declining <span className="field__req"> *</span></label>
              <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The contributor will see this in their history." />
              <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn btn--primary" disabled={busy || !reason.trim()}
                  onClick={() => act(
                    () => reviewContribution({ action: 'decline', contributionId: row.id, reason: reason.trim() }),
                    () => { setDeclineOpen(false); setMessage('Declined. The contributor can see the reason in their history.'); onRefresh?.(); },
                  )}>Confirm decline</button>
                <button type="button" className="btn btn--ghost" onClick={() => setDeclineOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : null}

          {deleteOpen ? (
            <div className="field" style={{ marginTop: '0.8rem' }}>
              <label>Why is this being deleted? <span className="field__opt">(audit log only; the submission is kept for the contributor's private history)</span></label>
              <textarea rows={2} onChange={(e) => setReason(e.target.value)} value={reason} placeholder="spam / invalid / malicious…" />
              <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn btn--danger" disabled={busy}
                  onClick={() => act(
                    () => reviewContribution({ action: 'delete', contributionId: row.id, reason: reason.trim() || null }),
                    () => { setDeleteOpen(false); setMessage('Deleted. The action is recorded in the audit log.'); onRefresh?.(); },
                  )}>Delete submission</button>
                <button type="button" className="btn btn--ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Queue, audit and admin tabs
// ---------------------------------------------------------------------------

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'all', label: 'All' },
];

function QueueTab({ onRefresh }) {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const { profile } = useAuth();

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchSubmissions({ status, search, limit: 80 }));
    } catch (err) { setError(err.message); setRows([]); }
  }, [status, search]);

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load]);

  return (
    <>
      <div className="panel-tabs">
        {STATUS_TABS.map((tab) => (
          <button key={tab.id} type="button" className={status === tab.id ? 'is-active' : ''}
            onClick={() => setStatus(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="filter-row">
        <input type="search" placeholder="Search by name or entry id…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search submissions" />
      </div>
      {error ? <p className="notice notice--error">{error}</p> : null}
      {rows === null ? <LoadingState label="Loading submissions…" /> : rows.length === 0 ? (
        <EmptyState icon="archive" title="Nothing here">No submissions match this filter.</EmptyState>
      ) : rows.map((row) => (
        <SubmissionDetail key={row.id} row={row} canReview canDelete onRefresh={() => { load(); onRefresh?.(); }} />
      ))}
    </>
  );
}

function AuditTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchAuditLog({ limit: 120 })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);
  if (error) return <p className="notice notice--error">{error}</p>;
  if (rows === null) return <LoadingState label="Loading the audit log…" />;
  if (rows.length === 0) return <EmptyState icon="archive" title="No audit events yet">Actions will be recorded here as they happen.</EmptyState>;
  return (
    <div>
      {rows.map((row) => (
        <article key={row.id} className="submission">
          <div className="submission__head">
            <div>
              <h3 className="submission__title">{row.action.replace(/[._]/g, ' ')}</h3>
              <p className="submission__meta">
                {row.contribution_number ? <>contribution #{row.contribution_number} · </> : null}
                {row.actor_display_name ? <>by <strong>{row.actor_display_name}</strong> · </> : null}
                {row.target_display_name ? <>target <strong>{row.target_display_name}</strong> · </> : null}
                {row.entity_id ? <><span className="mono">{row.entity_id}</span> · </> : null}
                {fmtTime(row.created_at)}
                {row.commit_sha ? <> · commit <span className="mono">{String(row.commit_sha).slice(0, 7)}</span></> : null}
              </p>
            </div>
          </div>
          {row.review_notes ? <p className="notice" style={{ marginTop: 0 }}>{row.review_notes}</p> : null}
          <ChangesTable changes={row.changes} />
        </article>
      ))}
    </div>
  );
}

function AdminTab({ onRefresh }) {
  const [discordId, setDiscordId] = useState('');
  const [role, setRole] = useState('checker');
  const [action, setAction] = useState('grant');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reconcile, setReconcile] = useState(null);

  const submit = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await manageRole({ action, role, discordId: discordId.trim() });
      setResult(`${res.display_name} is now ${res.role === 'member' ? 'a regular member' : res.role}.`);
      setDiscordId('');
      onRefresh?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const runReconcile = async () => {
    setBusy(true); setError(null); setReconcile(null);
    try { setReconcile(await reconcileSync()); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h3 className="section-heading">Manage staff</h3>
      <p className="muted small" style={{ maxWidth: '64ch' }}>
        Enter the numeric Discord user ID (enable Developer Mode in Discord, right-click the user,
        “Copy User ID”). Only the owner can manage administrators; admins and the owner manage checkers.
      </p>
      <div className="filter-row">
        <input type="text" placeholder="Discord user ID (numbers only)" value={discordId} onChange={(e) => setDiscordId(e.target.value)} style={{ minWidth: '240px' }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="checker">checker</option>
          <option value="admin">admin</option>
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="grant">grant</option>
          <option value="revoke">revoke</option>
        </select>
        <button type="button" className="btn btn--primary" disabled={busy || !/^\d{5,25}$/.test(discordId.trim())} onClick={submit}>
          {busy ? 'Working…' : action === 'grant' ? `Grant ${role}` : `Revoke ${role}`}
        </button>
      </div>
      {result ? <p className="notice" role="status">{result}</p> : null}

      <h3 className="section-heading" style={{ marginTop: '2rem' }}>Recover failed archive updates</h3>
      <p className="muted small" style={{ maxWidth: '64ch' }}>
        If a contribution was accepted but the GitHub commit failed, it is marked sync failed and stays retryable.
        This re-applies those patches and finalizes them (idempotent — safe to run any time).
      </p>
      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={runReconcile}>Run reconcile</button>
      </div>
      {reconcile ? (
        <p className="notice" role="status">
          Retried {reconcile.retried} failed sync(s); recovered {reconcile.recovered};
          still failing {reconcile.still_failing}. Notifications flushed.
        </p>
      ) : null}
      {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Staff() {
  const { user, profile, ready, backendConfigured, signIn } = useAuth();
  const [tab, setTab] = useState('queue');
  const staff = isStaff(profile);
  const canSeeAdmin = isAdmin(profile);

  if (!backendConfigured) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>Moderation panel</h1></div>
        <EmptyState icon="archive" title="Backend not connected">
          <p>The moderation panel becomes available once the backend is configured.</p>
        </EmptyState>
      </PageContainer>
    );
  }
  if (!ready) return <PageContainer><LoadingState label="Loading…" /></PageContainer>;
  if (!user) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>Moderation panel</h1></div>
        <EmptyState icon="user" title="Staff sign-in required">
          <p>Sign in with Discord to continue.</p>
          <button type="button" className="btn btn--primary" onClick={signIn}>Sign in with Discord</button>
        </EmptyState>
      </PageContainer>
    );
  }
  if (!staff) {
    return (
      <PageContainer>
        <div className="page-opening"><h1>Moderation panel</h1></div>
        <EmptyState icon="archive" title="Checker access required">
          <p>Your account does not have a staff role. This area is for checkers, admins and the owner.</p>
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="page-opening">
        <p className="eyebrow">Staff area</p>
        <h1>Moderation panel</h1>
        <p className="page-opening__lead">
          Review community contributions, edit the archive directly, and keep an eye on the audit log.
          Your actions here are recorded and announced like every other change.
        </p>
      </div>

      <div className="panel-tabs">
        <button type="button" className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}>Queue</button>
        <button type="button" className={tab === 'editor' ? 'is-active' : ''} onClick={() => setTab('editor')}>Archive editor</button>
        <button type="button" className={tab === 'audit' ? 'is-active' : ''} onClick={() => setTab('audit')}>Audit log</button>
        {canSeeAdmin ? <button type="button" className={tab === 'admin' ? 'is-active' : ''} onClick={() => setTab('admin')}>Admin</button> : null}
      </div>

      {tab === 'queue' ? <QueueTab /> : null}
      {tab === 'editor' ? <ArchiveEditor onCancel={() => setTab('queue')} onApplied={() => setTab('audit')} /> : null}
      {tab === 'audit' ? <AuditTab /> : null}
      {tab === 'admin' && canSeeAdmin ? <AdminTab /> : null}
    </PageContainer>
  );
}
