// Detail view for one contribution, shown as a large (optionally fullscreen)
// modal from the public log, My Contributions and the per-page activity
// boxes. Public visitors see metadata only; the author and staff also see
// the submitted answers and — for record edits — a field-level before/after
// diff of exactly what changed.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { deepDiff, fmtChangeValue } from '@/lib/diff.js';
import { entryPath, fmtTime, contributionTypeLabel } from '@/lib/activity.js';
import { commitUrl } from '@/lib/catalog.js';
import { STATUS_LABELS } from '@/lib/stats.js';

export function ChangesTable({ changes, emptyText = 'No field-level changes recorded.' }) {
  if (!changes?.length) return <p className="muted small">{emptyText}</p>;
  return (
    <div className="table-wrap">
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
    </div>
  );
}

/**
 * `row` is a normalised view of a contribution or a public edit event:
 * { kind: 'submission'|'edit', at, title, number?, type?, status?,
 *   entryId?, contributor?, reviewer?, submittedAt?, reviewedAt?,
 *   reviewReason?, commitSha?, payload?, payloadEdited?, proposedPatch?,
 *   action? (edits) }
 */
export default function ContributionModal({ row, onClose, fullscreen = true, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const path = entryPath(row.entryId);
  const commit = commitUrl(row.commitSha);
  const payload = row.payloadEdited ?? row.payload ?? null;
  const diff = row.proposedPatch?.record && row.proposedPatch?.baseRecord
    ? deepDiff(row.proposedPatch.baseRecord, row.proposedPatch.record)
    : payload?.record && payload?.baseRecord
      ? deepDiff(payload.baseRecord, payload.record)
      : null;

  return (
    <div className="modal-overlay modal-overlay--fullscreen" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal--wide${fullscreen ? ' modal--tall' : ''}`} role="dialog" aria-modal="true" aria-label={`Contribution ${row.number ? `#${row.number}` : row.title}`}>
        <div className="modal__head">
          <h3>
            {row.kind === 'edit' ? <Icon name={row.action?.includes('deleted') ? 'trash' : 'edit'} size={17} /> : <Icon name="archive" size={17} />}
            {' '}{row.number ? <>#{row.number} · </> : null}{row.title}
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={19} /></button>
        </div>
        <div className="modal__body">
          <dl className="submission__fields contribution-modal__fields">
            {row.kind === 'submission' ? <div className="row"><dt>Type</dt><dd>{contributionTypeLabel(row.type)}</dd></div> : null}
            {row.kind === 'edit' ? <div className="row"><dt>Action</dt><dd>{String(row.action ?? '').replace(/[._]/g, ' ')}</dd></div> : null}
            {row.status ? <div className="row"><dt>Status</dt><dd>{STATUS_LABELS[row.status] ?? row.status}</dd></div> : null}
            {row.contributor ? (
              <div className="row"><dt>Contributor</dt><dd className="contribution-modal__who"><Avatar name={row.contributor.name} url={row.contributor.avatar} size={24} /> {row.contributor.name}</dd></div>
            ) : null}
            {row.reviewer ? (
              <div className="row"><dt>{row.status === 'accepted' ? 'Accepted by' : 'Reviewed by'}</dt><dd className="contribution-modal__who"><Avatar name={row.reviewer.name} url={row.reviewer.avatar} size={24} /> {row.reviewer.name}</dd></div>
            ) : null}
            {row.entryId ? (
              <div className="row"><dt>Entry</dt><dd>{path ? <Link className="mono" to={path}>{row.entryId} →</Link> : <span className="mono">{row.entryId}</span>}</dd></div>
            ) : null}
            {row.submittedAt ? <div className="row"><dt>Submitted</dt><dd>{fmtTime(row.submittedAt)}</dd></div> : null}
            {row.reviewedAt ? <div className="row"><dt>Reviewed</dt><dd>{fmtTime(row.reviewedAt)}</dd></div> : null}
            {row.at && !row.submittedAt ? <div className="row"><dt>When</dt><dd>{fmtTime(row.at)}</dd></div> : null}
            {row.commitSha ? (
              <div className="row"><dt>Archive commit</dt><dd className="mono">{commit ? <a href={commit} target="_blank" rel="noreferrer noopener">{String(row.commitSha).slice(0, 7)}</a> : String(row.commitSha).slice(0, 7)}</dd></div>
            ) : null}
            {row.note ? <div className="row"><dt>Note</dt><dd>{row.note}</dd></div> : null}
            {row.reviewReason ? <div className="row"><dt>Reviewer note</dt><dd>{row.reviewReason}</dd></div> : null}
          </dl>

          {diff ? (
            <>
              <h4 className="section-heading">Changes made</h4>
              <ChangesTable changes={diff} />
            </>
          ) : row.kind === 'submission' ? (
            <p className="muted small">The submitted answers are visible to the contributor and to staff only.</p>
          ) : null}

          {payload && Object.keys(payload).length ? (
            <details className="contribution-modal__payload">
              <summary>View submitted answers (JSON)</summary>
              <pre className="submission-result__json" tabIndex={0}>{JSON.stringify(payload, null, 2)}</pre>
            </details>
          ) : null}

          {children}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/** Normalisers: turn a public-log / own-contribution / edit row into the view model above. */
export const submissionView = (sub) => ({
  kind: 'submission',
  number: sub.number,
  title: sub.title,
  type: sub.type,
  status: sub.status,
  entryId: sub.entry_id,
  contributor: sub.contributor_name || sub.profiles?.display_name
    ? { name: sub.contributor_name ?? sub.profiles?.display_name, avatar: sub.contributor_avatar ?? sub.profiles?.avatar_url }
    : null,
  reviewer: sub.reviewer_name || sub.reviewer_profile?.display_name
    ? { name: sub.reviewer_name ?? sub.reviewer_profile?.display_name, avatar: sub.reviewer_avatar ?? sub.reviewer_profile?.avatar_url }
    : null,
  submittedAt: sub.submitted_at ?? sub.created_at,
  reviewedAt: sub.reviewed_at,
  reviewReason: sub.review_reason,
  commitSha: sub.commit_sha,
  payload: sub.payload,
  payloadEdited: sub.payload_edited,
  proposedPatch: sub.proposed_patch,
});

export const editView = (edit) => ({
  kind: 'edit',
  title: `${edit.entity_type} ${edit.entity_id}`,
  action: edit.action,
  entryId: edit.entity_id,
  contributor: edit.editor_name ? { name: edit.editor_name, avatar: edit.editor_avatar } : null,
  at: edit.created_at,
  commitSha: edit.commit_sha,
});
