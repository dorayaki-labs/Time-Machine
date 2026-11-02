// POST /functions/v1/review — the moderation workflow.
//
//   { action: 'accept' | 'decline' | 'delete' | 'save-draft', contributionId | number, … }
//
// Accept is the critical path and the ONLY place a contribution can be marked
// accepted: the archive files are committed to GitHub first, and the database
// is updated afterwards. If the commit fails the contribution stays pending
// with sync_state='failed' and can be retried (see reconcile-sync). If the
// commit succeeds but the database write fails, the same retry finalizes it
// idempotently by re-committing nothing (the patch application detects the
// already-applied state) or by recording the commit.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate, readJson } from '../auth.js';
import { canReviewContribution, isStaff } from '../rbac.js';
import { applyArchivePatch } from '../patch.js';
import { summarizeChanges } from '../diff.js';
import { enqueue, flushOutbox } from '../discord.js';

async function loadContribution(db, body) {
  if (body.contributionId) return db.contributionById(body.contributionId);
  if (body.number) return db.contributionByNumber(body.number);
  return null;
}

async function recordStatusChange(db, { contribution, from, to, actor, reason }) {
  await db.insertStatusHistory({
    contribution_id: contribution.id, from_status: from, to_status: to,
    actor_id: actor.id, reason: reason ?? null,
  });
}

export async function handleReview(req, { db, authApi, env, webhookUrl, github }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile } = auth;

  if (!isStaff(profile.role)) {
    return json({ error: 'This area is for authorised staff.' }, 403);
  }

  const { body, error: bodyError } = await readJson(req);
  if (bodyError) return json({ error: bodyError }, 400);
  const { action } = body ?? {};
  const contribution = await loadContribution(db, body ?? {});
  if (!contribution) return json({ error: 'Contribution not found.' }, 404);

  if (!canReviewContribution(profile.role, profile.id, contribution)) {
    return json({ error: 'You cannot review your own submission.' }, 403);
  }

  // ---------------------------------------------------------------- accept
  if (action === 'accept') {
    if (contribution.status !== 'pending') {
      return json({ error: `Contribution #${contribution.number} is already ${contribution.status}.` }, 409);
    }
    const patch = body.proposedPatch ?? contribution.proposed_patch ?? null;
    const reviewNotes = typeof body.reviewNotes === 'string' ? body.reviewNotes.slice(0, 2000) : null;

    let commitSha = null;
    let changes = [];
    let entity = null;

    if (patch) {
      if (!github?.token) {
        return json({ error: 'The backend is not configured for archive updates (missing GITHUB_TOKEN).' }, 500);
      }
      // A previous attempt may have committed but failed to record it —
      // applying again is safe: identical data produces "nothing to change",
      // which we recognise and finalize instead of failing.
      const applied = await applyArchivePatch(github, patch).catch((err) => ({ error: err.message }));
      if (applied.error && !contribution.commit_sha) {
        await db.updateContribution(contribution.id, {
          sync_state: 'failed', sync_error: applied.error.slice(0, 1000),
        });
        return json({ error: `Archive update failed: ${applied.error}` }, 502);
      }

      if (!applied.error) {
        const message = `archive: accept contribution #${contribution.number} (${applied.entity.type} ${applied.entity.id})\n\nReviewed by ${profile.display_name}.`;
        commitSha = await github.commit(applied.files, message).catch(async (err) => {
          await db.updateContribution(contribution.id, {
            sync_state: 'failed', sync_error: String(err.message).slice(0, 1000),
          });
          return null;
        });
        if (!commitSha) return json({ error: 'The GitHub commit failed — the contribution stays pending and can be retried.' }, 502);
        changes = applied.changes;
        entity = applied.entity;
      } else {
        // "Nothing to change" on a retry: a previous commit already applied it.
        commitSha = contribution.commit_sha;
        changes = [];
        entity = { type: patch.entityType, id: patch.entityId, number: null };
      }
    }

    const updated = await db.updateContribution(contribution.id, {
      status: 'accepted',
      reviewer_id: profile.id,
      reviewed_at: new Date().toISOString(),
      review_reason: reviewNotes,
      proposed_patch: patch,
      commit_sha: commitSha,
      sync_state: commitSha ? 'committed' : 'not_required',
      sync_error: null,
    });
    if (updated?.error) return json({ error: `Archive updated but the database write failed: ${updated.error.message}. Run reconcile-sync from the moderation panel.` }, 500);

    await recordStatusChange(db, { contribution, from: 'pending', to: 'accepted', actor: profile, reason: reviewNotes });
    await db.insertAudit({
      contribution_id: contribution.id, contribution_number: contribution.number,
      action: 'contribution.accepted', actor_id: profile.id, actor_display_name: profile.display_name,
      target_user_id: contribution.contributor_id,
      entity_type: entity?.type ?? null, entity_id: entity?.id ?? contribution.entry_id,
      changes, review_notes: reviewNotes, commit_sha: commitSha,
    });
    await enqueue(db, `contribution.${contribution.id}.accepted`, 'accepted', {
      number: contribution.number, title: contribution.title,
      contributor: await displayName(db, contribution.contributor_id),
      reviewer: profile.display_name,
      entry: entity?.id ?? contribution.entry_id,
      changes: summarizeChanges(changes).join('\n') || 'no archive change',
      commit: commitSha ? commitSha.slice(0, 7) : null,
    });
    await flushOutbox(db, webhookUrl);
    return json({ ok: true, status: 'accepted', commit_sha: commitSha, changes });
  }

  // ---------------------------------------------------------------- decline
  if (action === 'decline') {
    if (contribution.status !== 'pending') {
      return json({ error: `Contribution #${contribution.number} is already ${contribution.status}.` }, 409);
    }
    const reason = String(body.reason ?? '').trim();
    if (!reason) return json({ error: 'A decline reason is required — the contributor sees it in their history.' }, 400);
    if (reason.length > 2000) return json({ error: 'Reason is longer than 2000 characters.' }, 400);

    await db.updateContribution(contribution.id, {
      status: 'declined', reviewer_id: profile.id,
      reviewed_at: new Date().toISOString(), review_reason: reason,
    });
    await recordStatusChange(db, { contribution, from: 'pending', to: 'declined', actor: profile, reason });
    await db.insertAudit({
      contribution_id: contribution.id, contribution_number: contribution.number,
      action: 'contribution.declined', actor_id: profile.id, actor_display_name: profile.display_name,
      target_user_id: contribution.contributor_id, entity_id: contribution.entry_id,
      review_notes: reason,
    });
    await enqueue(db, `contribution.${contribution.id}.declined`, 'declined', {
      number: contribution.number, title: contribution.title,
      contributor: await displayName(db, contribution.contributor_id),
      reviewer: profile.display_name, reason,
    });
    await flushOutbox(db, webhookUrl);
    return json({ ok: true, status: 'declined' });
  }

  // ---------------------------------------------------------------- delete
  if (action === 'delete') {
    if (contribution.status === 'deleted') return json({ error: 'Already deleted.' }, 409);
    const reason = String(body.reason ?? '').trim().slice(0, 2000) || null;
    await db.updateContribution(contribution.id, {
      status: 'deleted', reviewer_id: profile.id,
      reviewed_at: new Date().toISOString(), review_reason: reason,
    });
    await recordStatusChange(db, { contribution, from: contribution.status, to: 'deleted', actor: profile, reason });
    // The audit log keeps the submission's history: deletion is recorded, not erased.
    await db.insertAudit({
      contribution_id: contribution.id, contribution_number: contribution.number,
      action: 'contribution.deleted', actor_id: profile.id, actor_display_name: profile.display_name,
      target_user_id: contribution.contributor_id, entity_id: contribution.entry_id,
      review_notes: reason,
    });
    await enqueue(db, `contribution.${contribution.id}.deleted`, 'deleted', {
      number: contribution.number, title: contribution.title,
      contributor: await displayName(db, contribution.contributor_id),
      reviewer: profile.display_name, reason,
    });
    await flushOutbox(db, webhookUrl);
    return json({ ok: true, status: 'deleted' });
  }

  // ---------------------------------------------------------------- save draft
  if (action === 'save-draft') {
    if (contribution.status !== 'pending') {
      return json({ error: 'Only pending submissions can be edited.' }, 409);
    }
    const edited = {
      payload_edited: body.payloadEdited ?? contribution.payload_edited ?? null,
      proposed_patch: body.proposedPatch ?? contribution.proposed_patch ?? null,
    };
    await db.updateContribution(contribution.id, edited);
    await db.insertAudit({
      contribution_id: contribution.id, contribution_number: contribution.number,
      action: 'contribution.edited', actor_id: profile.id, actor_display_name: profile.display_name,
      entity_id: contribution.entry_id,
    });
    return json({ ok: true });
  }

  return json({ error: 'action must be accept, decline, delete or save-draft.' }, 400);
}

async function displayName(db, profileId) {
  const p = await db.profileById(profileId);
  return p?.display_name ?? 'unknown';
}
