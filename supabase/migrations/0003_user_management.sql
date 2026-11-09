-- ============================================================================
-- Migration 0003 — user banning + owner user-management support.
--
-- Adds ban state to profiles (enforced server-side by every Edge Function
-- through authenticate()) and the indexes the owner panel needs. Ban history
-- is kept in the existing append-only audit_logs table — no second audit
-- system is introduced.
--
-- Safety notes:
--   * Ban fields are privileged: the profile-protection trigger is extended
--     so a browser session can never change them (same rule as `role`).
--     Only the service role (Edge Functions) may write them.
--   * Existing data is untouched: every column is added with a default.
--   * RLS: profiles policies from 0001 already govern who can READ profile
--     rows (own row + staff). Ban columns ride the same policies; no new
--     policy is added. Writes stay service-role only.
-- ============================================================================

-- ---- ban state on profiles --------------------------------------------------

alter table public.profiles
  add column if not exists banned        boolean     not null default false,
  add column if not exists ban_reason    text        check (ban_reason is null or char_length(ban_reason) <= 2000),
  add column if not exists banned_by     uuid        references public.profiles (id),
  add column if not exists banned_at     timestamptz,
  add column if not exists ban_lifted_at timestamptz;

-- The owner panel lists and filters accounts by role and ban state.
create index if not exists profiles_role_idx   on public.profiles (role);
create index if not exists profiles_banned_idx on public.profiles (banned);
create index if not exists profiles_discord_idx on public.profiles (discord_id);

-- ---- extend the privileged-field guard to the ban columns --------------------

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      raise exception 'Roles can only be changed by authorised staff through the backend.';
    end if;
    if new.discord_id is distinct from old.discord_id then
      raise exception 'discord_id is immutable.';
    end if;
    if new.banned is distinct from old.banned
       or new.ban_reason is distinct from old.ban_reason
       or new.banned_by is distinct from old.banned_by
       or new.banned_at is distinct from old.banned_at
       or new.ban_lifted_at is distinct from old.ban_lifted_at then
      raise exception 'Ban state can only be changed by authorised staff through the backend.';
    end if;
  end if;
  return new;
end;
$$;

-- The trigger from 0001 stays in place; create or replace above redefines the
-- function it executes, so no trigger re-creation is needed.

-- ---- contribution statistics for the owner panel -----------------------------
--
-- Accepted-contribution counts per account, readable by staff (the owner
-- panel joins it against profiles). Aggregated, non-sensitive: counts only.

create or replace view public.contribution_counts
with (security_invoker = false) as
  select c.contributor_id as profile_id,
         count(*)                              as total_submitted,
         count(*) filter (where c.status = 'accepted') as accepted,
         count(*) filter (where c.status = 'pending')  as pending
  from public.contributions c
  group by c.contributor_id;

grant select on public.contribution_counts to authenticated;
