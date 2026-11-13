// Narrow data-access layer over supabase-js. Handlers talk to the database
// ONLY through these functions so the logic stays testable and the surface
// small. `admin` is the service-role client (server side only).

export function makeDb(admin) {
  return {
    // ---- profiles ----------------------------------------------------------
    profileById: (id) =>
      admin.from('profiles').select('*').eq('id', id).maybeSingle().then((r) => r.data),

    profileByDiscordId: (discordId) =>
      admin.from('profiles').select('*').eq('discord_id', String(discordId)).maybeSingle().then((r) => r.data),

    setProfileRole: (id, role) =>
      admin.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', id),

    // ---- user management (owner panel) --------------------------------------
    /** Lists accounts with optional search / role / ban filters. */
    listProfiles: ({ q, role, banned, limit = 200 } = {}) => {
      let query = admin.from('profiles').select('*').order('created_at', { ascending: true }).limit(limit);
      if (role) query = query.eq('role', role);
      if (banned === true) query = query.eq('banned', true);
      if (banned === false) query = query.eq('banned', false);
      if (q) {
        const like = `%${String(q).replace(/[,()]/g, '')}%`;
        query = query.or(`display_name.ilike.${like},username.ilike.${like},discord_id.ilike.${like}`);
      }
      return query.then((r) => r.data ?? []);
    },

    /** Accepted/pending/total submission counts per account (contribution_counts view). */
    contributionCounts: () =>
      admin.from('contribution_counts').select('profile_id, total_submitted, accepted, pending')
        .then((r) => r.data ?? []),

    setBanState: (id, { banned, reason = null, bannedBy = null, liftedAt = null }) =>
      admin.from('profiles').update({
        banned,
        ban_reason: banned ? reason : null,
        banned_by: banned ? bannedBy : null,
        banned_at: banned ? new Date().toISOString() : null,
        ban_lifted_at: banned ? null : (liftedAt ?? new Date().toISOString()),
        updated_at: new Date().toISOString(),
      }).eq('id', id),

    // ---- config ------------------------------------------------------------
    configAll: () =>
      admin.from('app_config').select('key, value').then((r) =>
        Object.fromEntries((r.data ?? []).map((row) => [row.key, row.value]))),

    // ---- contributions -----------------------------------------------------
    contributionById: (id) =>
      admin.from('contributions').select('*').eq('id', id).maybeSingle().then((r) => r.data),

    contributionByNumber: (number) =>
      admin.from('contributions').select('*').eq('number', Number(number)).maybeSingle().then((r) => r.data),

    insertContribution: (row) =>
      admin.from('contributions').insert(row).select('id, number, created_at').single().then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.data;
      }),

    updateContribution: (id, patch) =>
      admin.from('contributions').update(patch).eq('id', id),

    latestSubmission: (contributorId) =>
      admin.from('contributions').select('created_at').eq('contributor_id', contributorId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle().then((r) => r.data),

    pendingCount: (contributorId) =>
      admin.from('contributions').select('id', { count: 'exact', head: true })
        .eq('contributor_id', contributorId).eq('status', 'pending').then((r) => r.count ?? 0),

    countSince: (contributorId, sinceIso) =>
      admin.from('contributions').select('id', { count: 'exact', head: true })
        .eq('contributor_id', contributorId).gte('created_at', sinceIso).then((r) => r.count ?? 0),

    listFailedSyncs: () =>
      admin.from('contributions').select('*').eq('sync_state', 'failed')
        .order('created_at', { ascending: true }).limit(20).then((r) => r.data ?? []),

    findDuplicate: (contributorId, type, entryId, title, sinceIso) =>
      admin.from('contributions').select('id, number')
        .eq('contributor_id', contributorId).eq('type', type)
        .eq('title', title).gte('created_at', sinceIso)
        .or(entryId ? `entry_id.eq.${entryId},entry_id.is.null` : 'entry_id.is.null')
        .limit(1).maybeSingle().then((r) => r.data),

    // ---- history + audit ---------------------------------------------------
    insertStatusHistory: (row) => admin.from('contributions').insert(row),
    insertAudit: (row) => admin.from('audit_logs').insert(row),

    // ---- in-app notifications (migration 0004; see _shared/notifications.js) -
    /** Idempotent insert: a duplicate dedup_key is ignored, never an error. */
    insertUserNotification: (row) =>
      admin.from('notifications').upsert(row, { onConflict: 'dedup_key', ignoreDuplicates: true }),


    // ---- notification outbox ------------------------------------------------
    insert: (table, row) => admin.from(table).insert(row),

    outboxByKey: (eventKey) =>
      admin.from('notification_outbox').select('*').eq('event_key', eventKey).maybeSingle()
        .then((r) => r.data),

    staleOutbox: (limit) =>
      admin.from('notification_outbox').select('*')
        .eq('status', 'pending')
        .lt('attempts', 5)
        .lt('created_at', new Date(Date.now() - 30_000).toISOString())
        .order('created_at', { ascending: true }).limit(limit)
        .then((r) => r.data ?? []),

    markOutbox: async (id, status, lastError = null) => {
      const row = await admin.from('notification_outbox').select('attempts').eq('id', id)
        .maybeSingle().then((r) => r.data);
      return admin.from('notification_outbox')
        .update({
          status,
          last_error: lastError,
          attempts: (row?.attempts ?? 0) + 1,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
        })
        .eq('id', id);
    },
  };
}
