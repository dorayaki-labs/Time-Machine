-- ============================================================================
-- Migration 0002 — public activity feed.
--
-- Replaces the accepted-only public_log with a complete public activity
-- view (submissions, approvals, declines, deletions) plus direct archive
-- edits, and exposes contributor/reviewer names and public Discord avatars
-- so the UI can show who did what.
--
-- Privacy notes (intentional, do not "fix"):
--   * Pending submissions ARE shown as "new submission" events — they are
--     community activity; their payload stays private.
--   * Decline/delete reasons, payloads and every other contribution field
--     are NOT exposed. Only archive-level metadata (number, title, type,
--     entry id, status) and public profile fields (display name, username,
--     avatar) leave the database.
--   * The views run as their owner (security_invoker = false), the same
--     pattern as public_stats, so anonymous visitors can read them without
--     opening the underlying tables through RLS.
-- Reversible: drop view public.public_edits, public.public_log; then restore
-- the 0001 definition of public_log (see migrations/0001_init.sql).
-- ============================================================================

drop view if exists public.public_log;

create view public.public_log
with (security_invoker = false) as
  select
    c.number,
    c.title,
    c.type,
    c.entry_id,
    c.entry_series,
    c.status,
    c.created_at  as submitted_at,
    c.reviewed_at,
    p.display_name as contributor_name,
    p.username     as contributor_username,
    p.avatar_url   as contributor_avatar,
    r.display_name as reviewer_name,
    r.avatar_url   as reviewer_avatar
  from public.contributions c
  join public.profiles p on p.id = c.contributor_id
  left join public.profiles r on r.id = c.reviewer_id;

grant select on public.public_log to anon, authenticated;

-- Direct archive edits and entry deletions, from the append-only audit log.
create view public.public_edits
with (security_invoker = false) as
  select
    a.id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.commit_sha,
    a.created_at,
    a.actor_display_name as editor_name,
    p.username           as editor_username,
    p.avatar_url         as editor_avatar
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  where a.action in ('archive.direct_edit', 'archive.entry_deleted', 'archive.sync_recovered');

grant select on public.public_edits to anon, authenticated;
