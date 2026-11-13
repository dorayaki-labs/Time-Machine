-- ============================================================================
-- Migration 0004 — contributor recognition + in-app notifications.
--
-- Two additions, both additive and safe for existing data:
--
--   1. public.public_profiles — a deliberately narrow public view over
--      profiles so every contributor gets a public profile page
--      (/{username}). Only public identity fields leave the database:
--      username, display name, avatar, role, account creation date. Never
--      exposed: discord ids, ban reasons, email/identity data (those live on
--      auth tables and are not selected here at all).
--
--      Visibility rule (intentional, do not "fix"): only accounts that are
--      publicly active — at least one contribution in any status — or staff
--      (whose names already appear in the public activity views) get a
--      public profile. A member who has never contributed has no public
--      page; their Discord identity stays private.
--
--   2. public.notifications — persistent in-app notifications for
--      contribution status changes (accepted / declined / deleted), written
--      ONLY by Edge Functions with the service role. RLS isolates rows per
--      user; clients can select their own rows and mark them read, and can
--      never insert, delete or edit anything else.
--
-- Reversible:
--   drop view public.public_profiles;
--   drop table public.notifications;
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Public profiles
-- ---------------------------------------------------------------------------

-- Idempotent throughout: the whole file can be re-run safely (policies and
-- the trigger are dropped-if-exists first; the table is create-if-not-exists
-- so re-running never touches existing data).
create or replace view public.public_profiles
with (security_invoker = false)
as
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.role,
    p.created_at
  from public.profiles p
  where p.banned = false
    and (
      exists (select 1 from public.contributions c where c.contributor_id = p.id)
      or p.role in ('checker', 'admin', 'owner')
    );

grant select on public.public_profiles to anon, authenticated;

-- Case-insensitive username lookups need an index; if two legacy profiles
-- somehow share a username only differing by case, this index creation fails
-- loudly instead of silently serving the wrong profile — rename one of them
-- (Profiles → SQL: update profiles set username = username || '-2' where …)
-- and re-run this migration.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null and username <> '';

-- ---------------------------------------------------------------------------
-- 2. Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  -- Mirrors the contribution status the user is being told about.
  type                 text not null check (type in ('accepted', 'declined', 'deleted')),
  contribution_number  bigint,
  -- Denormalised, safe display data (the submission's title and entry ids).
  -- Payloads, review reasons and any private field stay in contributions.
  title                text not null,
  entry_id             text,
  entry_series         text,
  message              text not null,
  -- One notification per (contribution, type), ever — enforced by the
  -- unique key below, so retries (accept → reconcile retry, double-click)
  -- can never produce duplicates.
  dedup_key            text not null unique,
  read_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
-- Unread badge lookups stay cheap as the table grows.
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- A user sees only their own notifications. Everyone else — including
-- anonymous visitors — gets nothing.
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());

-- Mark-as-read is the ONLY client write: own rows only, and the trigger
-- below pins the update to the read_at column.
drop policy if exists "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No insert/delete policies exist on purpose: rows are created by Edge
-- Functions with the service role only. Notification creation is a trusted
-- backend operation — a client must never be able to forge one.

-- Clients may flip read_at (and nothing else); all other columns are
-- server-owned.
create or replace function public.notifications_pin_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    if new.user_id is distinct from old.user_id
       or new.type is distinct from old.type
       or new.contribution_number is distinct from old.contribution_number
       or new.title is distinct from old.title
       or new.entry_id is distinct from old.entry_id
       or new.entry_series is distinct from old.entry_series
       or new.message is distinct from old.message
       or new.dedup_key is distinct from old.dedup_key
       or new.created_at is distinct from old.created_at then
      raise exception 'Only the read state of a notification can be changed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_pin_columns on public.notifications;
create trigger notifications_pin_columns
  before update on public.notifications
  for each row execute function public.notifications_pin_columns();

-- Defense in depth: strip write privileges from client-facing roles even
-- though no policies grant them (RLS with no insert/delete policy = denied).
revoke insert, delete on public.notifications from anon, authenticated;
