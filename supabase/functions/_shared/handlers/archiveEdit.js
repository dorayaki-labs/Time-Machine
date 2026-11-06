// POST /functions/v1/archive-edit — a signed-in member edits an archive
// record directly (structured editor or raw JSON) and the result is sent to
// the review queue as a contribution carrying a ready-to-apply proposed
// patch. A checker then accepts it in one click — the exact record the
// member wrote is validated and committed; no re-typing by hand.
//
// Only EXISTING entries can be proposed this way: creating or deleting
// archive files stays with the staff editor (owner-only create/delete).
// Nothing is written to the repository from this endpoint — the commit
// still happens only through review accept.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { ENTITY_TYPES, applyArchivePatch } from '../patch.js';
import { loadConfig } from '../formSpec.js';
import { notify, flushOutbox } from '../discord.js';

const ID_PATTERNS = {
  episode: /^anime-(1979|2005|1973)-\d{4}$/,
  movie: /^movie-\d{4}$/,
  character: /^char-[a-z0-9-]{1,50}$/,
  gadget: /^gadget-[a-z0-9-]{1,50}$/,
};

const SERIES_FOR = { episode: (id) => id.split('-').slice(0, 2).join('-'), movie: () => 'movies' };

export async function handleArchiveEdit(req, { db, authApi, env, webhookUrl, github }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile } = auth;

  const { body, error: bodyError } = await readJson(req);
  if (bodyError) return json({ error: bodyError }, 400);
  const { entityType, entityId, record, baseRecord, note } = body ?? {};

  if (!ENTITY_TYPES.includes(entityType)) {
    return json({ error: `entityType must be one of ${ENTITY_TYPES.join(', ')}.` }, 400);
  }
  const id = String(entityId ?? '').trim();
  if (!ID_PATTERNS[entityType].test(id)) {
    return json({ error: `"${entityId}" is not a valid ${entityType} id.` }, 400);
  }
  if (typeof note !== 'string' || !note.trim()) {
    return json({ error: 'A short note explaining what you changed and why is required.' }, 400);
  }
  if (note.length > 2000) {
    return json({ error: 'The note is too long (2000 characters max).' }, 400);
  }

  // Validate + freshness-check the proposal against the CURRENT repository
  // state WITHOUT committing: applyArchivePatch fetches the file, compares
  // baseRecord (optimistic concurrency) and runs full schema validation.
  // mode is forced to 'update' — proposing new entries or deletions is not
  // part of the member flow.
  const proposedPatch = {
    entityType, entityId: id, mode: 'update',
    record: record ?? null,
    ...(baseRecord !== undefined ? { baseRecord } : {}),
  };
  // The proposal is validated against the CURRENT repository state without
  // committing. If the caller's baseRecord is stale (any commit lands between
  // the page load and this submit — including the visitor's own accepted
  // edit minutes ago), retry against the live file: the proposed record is
  // complete and validated either way, and the stored baseRecord below is
  // the REAL current file, so the review queue always shows a true diff.
  let applied = await applyArchivePatch(github, proposedPatch).catch((err) => ({ error: err.message }));
  if (applied.error && /changed since it was loaded/.test(applied.error)) {
    applied = await applyArchivePatch(github, proposedPatch, { allowStale: true }).catch((err) => ({ error: err.message }));
  }
  if (applied.error) return json({ error: applied.error }, 422);

  // Same spam guards as regular submissions (pending cap + daily cap), but
  // no cooldown or duplicate-window: fixing a typo you just noticed in your
  // own proposal should never be blocked.
  const cfg = await loadConfig(db);
  const pending = await db.pendingCount(profile.id);
  if (pending >= cfg.max_pending_per_user) {
    return json({ error: `You already have ${pending} submission(s) awaiting review. Please wait for them to be handled first.` }, 429);
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const todayCount = await db.countSince(profile.id, dayAgo);
  if (todayCount >= cfg.max_submissions_per_day) {
    return json({ error: 'Daily submission limit reached — please try again tomorrow.' }, 429);
  }

  const label = applied.changes.length ? `edit (${applied.changes.length} change${applied.changes.length === 1 ? '' : 's'})` : 'edit';
  const title = `${entityType} ${id} — ${label}`.slice(0, 200);

  // Store the record exactly as it will be committed: `references` is no
  // longer part of the schema and is stripped server-side on every commit
  // path, so it is stripped here too before anything is stored.
  const cleanRecord = { ...record };
  delete cleanRecord.references;

  const inserted = await db.insertContribution({
    contributor_id: profile.id,
    type: 'archive-edit',
    title,
    entry_id: id,
    entry_series: SERIES_FOR[entityType]?.(id) ?? null,
    // The full edited record plus the file it was ACTUALLY applied against
    // (the live repository state, not the possibly-stale copy the editor
    // loaded), so the queue can show a real before/after diff. The stored
    // patch omits baseRecord: accepting re-applies against whatever the
    // repository looks like then, without a wedge-prone freshness check.
    payload: { record: cleanRecord, baseRecord: applied.current ?? baseRecord ?? null, note: note.trim() },
    proposed_patch: { entityType, entityId: id, mode: 'update', record: cleanRecord },
    status: 'pending',
  });

  await db.insertStatusHistory({
    contribution_id: inserted.id, from_status: null, to_status: 'pending', actor_id: profile.id,
  });
  await db.insertAudit({
    contribution_id: inserted.id, contribution_number: inserted.number,
    action: 'contribution.submitted', actor_id: profile.id, actor_display_name: profile.display_name,
    entity_id: id, review_notes: note.trim(),
  });
  await notify(db, webhookUrl, `contribution.${inserted.id}.submitted`, 'submitted', {
    number: inserted.number, title, type: 'archive-edit',
    contributor: profile.display_name,
    entry: id,
    notes: note.trim(),
  });
  await flushOutbox(db, webhookUrl);
  return json({ ok: true, number: inserted.number, changes: applied.changes.length });
}
