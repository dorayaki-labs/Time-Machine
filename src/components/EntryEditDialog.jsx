// "Edit & send for review" — the member-facing record editor shown as a
// dialog on every archive detail page. Loads the raw record file, lets the
// user edit it (structured or raw JSON), shows exactly what will change, and
// submits it as an `archive-edit` contribution: the patch is applied to the
// repository only once a checker accepts it. Nothing here bypasses review.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import RecordEditor, { findEntity } from './RecordEditor.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { deepDiff, fmtChangeValue } from '@/lib/diff.js';
import { submitArchiveEdit } from '@/lib/staffApi.js';
import { entityTypeFor } from './EntryActions.jsx';

function ChangesTable({ changes }) {
  if (!changes.length) return <p className="muted small">Nothing has been changed yet.</p>;
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

export default function EntryEditDialog({ entry, onClose }) {
  const { user, profile, ready, backendConfigured, signIn } = useAuth();
  const entityType = entityTypeFor(entry);
  const [draft, setDraft] = useState(null);
  const [base, setBase] = useState(null);
  const [rawJson, setRawJson] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // Raw record file — the server compares it against GitHub for freshness.
    const raw = findEntity(entityType, entry.id);
    if (raw) {
      setBase(JSON.parse(JSON.stringify(raw)));
      setDraft(JSON.parse(JSON.stringify(raw)));
      setRawJson(JSON.stringify(raw, null, 2));
    }
  }, [entityType, entry.id]);

  const setField = (path, value) => setDraft((d) => {
    const next = structuredClone(d);
    const parts = path.split('.');
    let node = next;
    for (let i = 0; i < parts.length - 1; i += 1) node = node[parts[i]] ??= {};
    node[parts[parts.length - 1]] = value;
    return next;
  });

  const changes = useMemo(() => (base && draft ? deepDiff(base, draft) : []), [base, draft]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const record = showRaw ? JSON.parse(rawJson) : draft;
      const res = await submitArchiveEdit({
        entityType,
        entityId: entry.id,
        record,
        baseRecord: base,
        note: note.trim() || null,
      });
      setDone(res);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  // ---- gate: the backend must be configured for edits to go anywhere ----
  if (!backendConfigured) {
    return (
      <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="entry-edit-title">
          <div className="modal__head">
            <h3 id="entry-edit-title">Edit & send for review</h3>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={19} /></button>
          </div>
          <div className="modal__body"><p className="notice">The contribution backend is not connected, so direct edits cannot be sent.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="entry-edit-title">
        <div className="modal__head">
          <h3 id="entry-edit-title">Edit <span className="mono">{entry.id}</span> & send for review</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={19} /></button>
        </div>

        {done ? (
          <div className="modal__body">
            <div className="submission-result" role="status">
              <span className="submission-result__icon"><Icon name="check" size={24} /></span>
              <h4>Sent for review as #{done.number}</h4>
              <p>
                A checker sees your exact changes and can accept them in one click — the moment they
                do, the record updates in the repository and appears here without a redeploy.
                Track it in <Link to="/account">My contributions</Link>.
              </p>
              <div className="btn-row"><button type="button" className="btn btn--primary" onClick={onClose}>Done</button></div>
            </div>
          </div>
        ) : !ready ? (
          <div className="modal__body"><p className="muted small">Checking your session…</p></div>
        ) : !user ? (
          <div className="modal__body">
            <div className="submission-result submission-result--gate" role="note">
              <span className="submission-result__icon"><Icon name="user" size={24} /></span>
              <h4>Sign in to edit the archive</h4>
              <p>Edits are tied to a Discord account so we can credit you and follow up. Browsing stays open to everyone — editing needs an account.</p>
              <div className="btn-row"><button type="button" className="btn btn--primary" onClick={signIn}><Icon name="user" size={16} /> Sign in with Discord</button></div>
            </div>
          </div>
        ) : !draft ? (
          <div className="modal__body"><p className="notice notice--warn">This record could not be loaded for editing — refresh the page and try again.</p></div>
        ) : (
          <>
            <div className="modal__body">
              <p className="submission__meta" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Avatar name={profile?.display_name} url={profile?.avatar_url} size={26} />
                You are proposing a change to the public record. Nothing is published until a checker accepts it.
              </p>

              <div className="btn-row" style={{ margin: '0.6rem 0' }}>
                <button type="button" className={`btn btn--ghost${showRaw ? ' is-active' : ''}`}
                  onClick={() => { setShowRaw((v) => !v); setRawJson(JSON.stringify(draft, null, 2)); }}>
                  {showRaw ? 'Structured editor' : 'Raw JSON editor'}
                </button>
              </div>

              {showRaw ? (
                <div className="field">
                  <label>Raw JSON <span className="field__opt">(advanced — malformed JSON cannot be submitted)</span></label>
                  <textarea rows={16} className="mono" value={rawJson} spellCheck={false}
                    onChange={(e) => setRawJson(e.target.value)}
                    onBlur={() => { try { setDraft(JSON.parse(rawJson)); setError(null); } catch (err) { setError(`Invalid JSON: ${err.message}`); } }} />
                </div>
              ) : (
                <RecordEditor entityType={entityType} draft={draft} setField={setField} />
              )}

              <h4 className="section-heading" style={{ marginTop: '1.2rem' }}>Your changes</h4>
              <ChangesTable changes={changes} />

              <div className="field" style={{ marginTop: '1rem' }}>
                <label htmlFor="entry-edit-note">What did you change and why? <span className="field__req" aria-hidden="true"> *</span></label>
                <textarea id="entry-edit-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. corrected the broadcast date per the official episode list" required />
                <p className="field__help">A short source or reason helps the checker accept your edit in one click.</p>
              </div>

              {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--primary" disabled={busy || changes.length === 0 || !note.trim()}
                title={!note.trim() ? 'Describe what you changed and why first' : undefined} onClick={submit}>
                {busy ? 'Sending…' : 'Send for review'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
