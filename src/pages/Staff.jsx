// The staff area: moderation queue, archive editor, audit log and (for
// admins/owner) role management. The UI hides what the caller's role cannot
// do, but every rule is enforced again server-side — this page is
// convenience, not security.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/PageContainer.jsx';
import LoadingState from '@/components/LoadingState.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import Icon from '@/components/Icon.jsx';
import Avatar from '@/components/Avatar.jsx';
import StatusChip from '@/components/StatusChip.jsx';
import { useAuth, isStaff, isAdmin, isOwner } from '@/hooks/useAuth.jsx';
import { fetchSubmissions, fetchAuditLog, STATUS_LABELS } from '@/lib/stats.js';
import { reviewContribution, directEditArchive, manageRole, reconcileSync } from '@/lib/staffApi.js';
import { deepDiff, fmtChangeValue } from '@/lib/diff.js';
import { getCharacters, getGadgets, getAllEntries, reloadCatalog } from '@/lib/catalog.js';
import { CONTRIBUTION_CATEGORIES } from '@/lib/contributionForms.js';
import RecordEditor, { findEntity, buildNewRecord } from '@/components/RecordEditor.jsx';

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

const categoryLabel = (type) => {
  if (type === 'archive-edit') return 'Direct record edit';
  return CONTRIBUTION_CATEGORIES.find((c) => c.id === type)?.label ?? type;
};

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


function ArchiveEditor({ contribution, preset, onApplied, onCancel }) {
  // When opened from a contribution: entityId/type preset and "commit" is the
  // accept action; otherwise it is a direct edit. Deep links from detail
  // pages arrive through `preset` and load their record immediately.
  const { profile } = useAuth();
  // Creating or deleting archive files rewrites the repository structure —
  // owner only. Everyone else can propose edits (review) or make direct
  // edits to existing records.
  const isOwnerUser = isOwner(profile);
  const canDeleteEntry = isOwnerUser;
  const [entityType, setEntityType] = useState(contribution?.entityType ?? preset?.entityType ?? 'episode');
  const [entityId, setEntityId] = useState(contribution?.entityId ?? preset?.entityId ?? '');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [base, setBase] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rawJson, setRawJson] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadEntity = (type, id) => {
    setError(null);
    setDeleting(false);
    setConfirmText('');
    const existing = findEntity(type, id);
    if (existing) {
      // Raw record file content — no derived fields to strip, so the committed
      // JSON matches the file schema and the server's baseRecord check passes.
      const raw = JSON.parse(JSON.stringify(existing));
      setBase(JSON.parse(JSON.stringify(raw))); setDraft(raw); setRawJson(JSON.stringify(raw, null, 2));
    } else if (isOwnerUser) {
      const fresh = buildNewRecord(type, id);
      setBase(null); setDraft(fresh); setRawJson(JSON.stringify(fresh, null, 2));
    } else {
      setError(`"${id}" was not found in the archive. Creating new entries is owner-only — if you meant to propose a new entry, use the contribution forms instead.`);
    }
  };

  useEffect(() => {
    // Adjusting an archive-edit: open the member's proposed record (with the
    // version it was based on) so their exact changes are the starting point.
    if (contribution?.presetRecord) {
      setBase(contribution.presetBase ? JSON.parse(JSON.stringify(contribution.presetBase)) : null);
      setDraft(JSON.parse(JSON.stringify(contribution.presetRecord)));
      setRawJson(JSON.stringify(contribution.presetRecord, null, 2));
      return;
    }
    if (contribution?.entityId) loadEntity(contribution.entityType, contribution.entityId);
    else if (preset?.entityId) loadEntity(preset.entityType, preset.entityId);
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
      if (deleting) {
        // Deleting an archive entry — admin/owner only, confirmed by typing
        // the entry id. The server enforces the role again.
        const patch = { entityType, entityId: entityId.trim(), mode: 'delete', ...(base ? { baseRecord: base } : {}) };
        const res = await directEditArchive({ patch, reviewNotes: reviewNotes || null });
        onApplied?.(res);
        return;
      }
      const record = showRaw ? JSON.parse(rawJson) : draft;
      const mode = base ? 'update' : 'create';
      if (mode === 'create' && !isOwnerUser) {
        setError('Only the owner can create new archive entries. Use the contribution forms to propose one.');
        return;
      }
      const patch = { entityType, entityId: entityId.trim(), mode, record, ...(base ? { baseRecord: base } : {}) };
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
            {deleting ? 'Deleting' : 'Editing'} <strong className="mono">{entityType} {entityId}</strong>
            {base || deleting ? '' : ' (new record — owner only)'}
            <button type="button" className="btn btn--ghost" style={{ marginLeft: '0.8rem' }} onClick={() => { setDraft(null); setBase(null); setDeleting(false); }}>Choose another record</button>
          </p>

          {deleting ? (
            <div className="notice notice--warn" style={{ maxWidth: '70ch' }}>
              <p style={{ marginTop: 0 }}>
                <strong>This removes {entityType} {entityId} from the archive</strong> — the record
                file (and its index listing, if any) is deleted from the repository and the entry
                disappears from the site. The audit log keeps a record of the deletion.
              </p>
              <div className="field">
                <label>Type <span className="mono">{entityId}</span> to confirm</label>
                <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={entityId} />
              </div>
              {base ? <p className="muted small">A snapshot of the record is kept in this editor until you close it — if the deletion was a mistake, re-create the entry from it.</p> : null}
            </div>
          ) : (
            <>
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
                <RecordEditor entityType={entityType} draft={draft} setField={setField} />
              )}

              <h4 className="section-heading" style={{ marginTop: '1.4rem' }}>Preview of changes</h4>
              {base ? (changes.length ? <ChangesTable changes={changes} /> : <p className="muted small">No changes yet.</p>)
                : <p className="muted small">New record — the whole entry will be created.</p>}
            </>
          )}

          <div className="field" style={{ marginTop: '1rem' }}>
            <label>Review note <span className="field__opt">(optional, shown in the audit log and to the contributor)</span></label>
            <textarea rows={2} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
          </div>

          {error ? <p className="notice notice--error" role="alert">{error}</p> : null}

          <div className="submission__actions">
            {deleting ? (
              <button type="button" className="btn btn--danger" disabled={busy || confirmText.trim() !== entityId.trim()} onClick={commit}>
                {busy ? 'Working…' : `Delete ${entityId} permanently`}
              </button>
            ) : (
              <button type="button" className="btn btn--primary" disabled={busy || !canCommit || (base && changes.length === 0)} onClick={commit}>
                {busy ? 'Working…' : base ? (contribution ? 'Accept & commit to the archive' : 'Commit direct edit') : 'Create the record'}
              </button>
            )}
            {canDeleteEntry && base && !deleting && !contribution ? (
              <button type="button" className="btn btn--ghost btn--danger" disabled={busy} onClick={() => { setDeleting(true); setConfirmText(''); }}>
                <Icon name="trash" size={15} /> Delete this entry…
              </button>
            ) : null}
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
  const isArchiveEdit = row.type === 'archive-edit';
  // The member's proposal already contains the exact final record; the
  // checker can accept it as-is (one click, no re-typing) or open it in the
  // editor to adjust first. Accept runs with the stored proposed patch.
  const proposedChanges = isArchiveEdit && payload.record && payload.baseRecord
    ? deepDiff(payload.baseRecord, payload.record) : [];

  const act = async (fn, done) => {
    setBusy(true); setError(null); setMessage(null);
    try { const res = await fn(); done?.(res); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <article className="submission" id={`submission-${row.number}`}>
      <div className="submission__head">
        <div className="submission__who">
          <Avatar name={row.profiles?.display_name} url={row.profiles?.avatar_url} size={34} />
          <div>
            <h3 className="submission__title">#{row.number} · {row.title}</h3>
            <p className="submission__meta">
              {categoryLabel(row.type)} · by <strong>{row.profiles?.display_name ?? 'unknown'}</strong>
              {row.entry_id ? <> · <span className="mono">{row.entry_id}</span>{link ? <> <Link to={link}>view entry →</Link></> : null}</> : null}
              <br />submitted {fmtTime(row.created_at)}
            </p>
          </div>
        </div>
        <StatusChip status={row.status} />
      </div>

      {isArchiveEdit ? (
        <>
          {payload.note ? <p className="notice" style={{ marginTop: 0 }}><strong>Contributor note:</strong> {payload.note}</p> : null}
          <h4 className="section-heading">Proposed changes</h4>
          <ChangesTable changes={proposedChanges} />
        </>
      ) : (
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
      )}

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
            {isArchiveEdit ? (
              <button type="button" className="btn btn--primary" disabled={busy || !row.proposed_patch}
                title="Applies the member's exact record to the repository and accepts the contribution"
                onClick={() => act(
                  () => reviewContribution({ action: 'accept', contributionId: row.id }),
                  (res) => { setMessage(`Accepted and committed${res?.commit_sha ? ` (commit ${String(res.commit_sha).slice(0, 7)})` : ''}.`); onAcceptApplied?.(); },
                )}>
                {busy ? 'Working…' : 'Accept — apply these changes'}
              </button>
            ) : null}
            <button type="button" className={`btn ${isArchiveEdit ? 'btn--ghost' : 'btn--primary'}`} disabled={busy} onClick={() => setEditorOpen((v) => !v)}>
              {editorOpen ? 'Close editor' : isArchiveEdit ? 'Adjust in editor…' : 'Open in archive editor…'}
            </button>
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setDeclineOpen((v) => !v)}>Decline…</button>
            {canDelete ? <button type="button" className="btn btn--ghost btn--danger" disabled={busy} onClick={() => setDeleteOpen((v) => !v)}>Delete…</button> : null}
          </div>

          {editorOpen ? (
            <div style={{ marginTop: '1rem' }}>
              <ArchiveEditor
                contribution={{
                  id: row.id, number: row.number,
                  entityType: isArchiveEdit
                    ? (row.entry_id?.startsWith('char-') ? 'character' : row.entry_id?.startsWith('gadget-') ? 'gadget' : row.entry_id?.startsWith('movie-') ? 'movie' : 'episode')
                    : row.type === 'source' || row.type === 'images'
                      ? (row.entry_id?.startsWith('movie-') ? 'movie' : 'episode')
                      : row.entry_id?.startsWith('char-') ? 'character' : row.entry_id?.startsWith('gadget-') ? 'gadget' : 'episode',
                  entityId: row.entry_id,
                  presetRecord: isArchiveEdit ? payload.record : null,
                  presetBase: isArchiveEdit ? payload.baseRecord : null,
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
        <SubmissionDetail
          key={row.id}
          row={row}
          canReview
          canDelete
          onAcceptApplied={() => { load(); onRefresh?.(); }}
          onRefresh={() => { load(); onRefresh?.(); }}
        />
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
  const { profile } = useAuth();
  const owner = isOwner(profile);
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
        “Copy User ID”). {owner
          ? 'As the owner you can manage both checkers and administrators.'
          : 'Admins manage checkers; only the owner can manage administrators.'}
      </p>
      <div className="filter-row">
        <input type="text" placeholder="Discord user ID (numbers only)" value={discordId} onChange={(e) => setDiscordId(e.target.value)} style={{ minWidth: '240px' }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="checker">checker</option>
          {owner ? <option value="admin">admin</option> : null}
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
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const [tab, setTabState] = useState(
    ['queue', 'editor', 'audit', 'admin'].includes(tabParam) ? tabParam : 'queue',
  );
  // Detail pages deep-link into a preloaded editor: /staff?tab=editor&entityType=…&entityId=…
  const editorPreset = params.get('entityType') && params.get('entityId')
    ? { entityType: params.get('entityType'), entityId: params.get('entityId') }
    : null;
  const staff = isStaff(profile);
  const canSeeAdmin = isAdmin(profile);

  const setTab = (next) => {
    setTabState(next);
    const nextParams = {};
    if (next !== 'queue') nextParams.tab = next;
    setParams(nextParams, { replace: true });
  };

  const afterArchiveChange = () => {
    // The archive JSON changed in the repository — reload it so every page,
    // this one included, shows the new data without a manual refresh.
    reloadCatalog().catch(() => { /* the next full load retries */ });
  };

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

      {tab === 'queue' ? <QueueTab onRefresh={afterArchiveChange} /> : null}
      {tab === 'editor' ? (
        <ArchiveEditor
          preset={editorPreset}
          onCancel={() => setTab('queue')}
          onApplied={() => { afterArchiveChange(); setTab('audit'); }}
        />
      ) : null}
      {tab === 'audit' ? <AuditTab /> : null}
      {tab === 'admin' && canSeeAdmin ? <AdminTab /> : null}
    </PageContainer>
  );
}
