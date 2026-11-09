// POST /functions/v1/reconcile-sync — recovery for partially completed
// operations (admin / owner only).
//
// Two jobs, both idempotent:
//   1. Retry contributions with sync_state='failed': re-apply their patch.
//      If the data now equals the proposal ("nothing to change") the archive
//      commit had already landed — finalize it. Otherwise commit, then mark
//      the contribution accepted with sync_state='recovered'.
//   2. Flush the notification outbox (stale pending rows).
//
// The GitHub commit message embeds the contribution number, so the commit
// history is itself a recovery record: `git log --grep "accept contribution
// #N"` shows whether an accepted contribution's archive change ever landed.

import { json, preflight, checkOrigin } from '../cors.js';
import { authenticate } from '../auth.js';
import { isAdmin } from '../rbac.js';
import { applyArchivePatch } from '../patch.js';
import { flushOutbox } from '../discord.js';

export async function handleReconcile(req, { db, authApi, env, webhooks, github }) {
  const pre = preflight(req, env);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const origin = checkOrigin(req, env);
  if (!origin.ok) return origin.response;

  const auth = await authenticate({ authApi, db }, req);
  if (auth.error) return json({ error: auth.error.message }, auth.error.code);
  const { profile } = auth;

  if (!isAdmin(profile.role)) return json({ error: 'This area is for admins and the owner.' }, 403);

  const results = { retried: 0, recovered: 0, still_failing: 0, notifications_flushed: true };

  if (github?.token) {
    const failed = await db.listFailedSyncs();
    results.retried = failed.length;
    for (const contribution of failed) {
      try {
        const patch = contribution.proposed_patch;
        if (!patch) { results.still_failing++; continue; }
        const applied = await applyArchivePatch(github, patch);
        let commitSha = contribution.commit_sha;

        if (applied.error) {
          // "nothing to change" = a previous commit already applied this patch.
          if (!contribution.commit_sha) { results.still_failing++; continue; }
        } else {
          const message = `archive: accept contribution #${contribution.number} (${applied.entity.type} ${applied.entity.id})\n\nRecovered by ${profile.display_name}.`;
          commitSha = await github.commit(applied.files, message);
        }

        await db.updateContribution(contribution.id, {
          status: 'accepted',
          reviewer_id: contribution.reviewer_id ?? profile.id,
          reviewed_at: contribution.reviewed_at ?? new Date().toISOString(),
          commit_sha: commitSha,
          sync_state: 'recovered',
          sync_error: null,
        });
        await db.insertAudit({
          contribution_id: contribution.id, contribution_number: contribution.number,
          action: 'archive.sync_recovered', actor_id: profile.id, actor_display_name: profile.display_name,
          entity_type: patch.entityType, entity_id: patch.entityId,
          commit_sha: commitSha, review_notes: 'Recovered by reconcile-sync.',
        });
        results.recovered++;
      } catch (err) {
        await db.updateContribution(contribution.id, { sync_error: String(err.message).slice(0, 1000) });
        results.still_failing++;
      }
    }
  }

  await flushOutbox(db, webhooks, { limit: 10 });
  return json({ ok: true, ...results });
}
