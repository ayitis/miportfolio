begin;

create table public.portfolio_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id) on delete cascade
);

create table public.portfolio_history (
  revision bigint generated always as identity primary key,
  page text not null check (page = 'home'),
  document jsonb not null,
  published boolean not null,
  created_at timestamptz not null default now()
);

create table public.portfolio_drafts (
  page text primary key check (page = 'home'),
  document jsonb not null,
  revision bigint not null references public.portfolio_history(revision)
);

create table public.portfolio_published (
  page text primary key check (page = 'home'),
  document jsonb not null,
  revision bigint not null references public.portfolio_history(revision)
);

alter table public.portfolio_owner enable row level security;
alter table public.portfolio_history enable row level security;
alter table public.portfolio_drafts enable row level security;
alter table public.portfolio_published enable row level security;

revoke all on public.portfolio_owner, public.portfolio_history, public.portfolio_drafts,
  public.portfolio_published from public, anon, authenticated;
revoke all on sequence public.portfolio_history_revision_seq from public, anon, authenticated;
grant select on public.portfolio_history, public.portfolio_drafts to authenticated;
grant select on public.portfolio_published to anon, authenticated;

create function public.portfolio_is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.portfolio_owner where user_id = auth.uid()
  );
$$;

revoke all on function public.portfolio_is_owner() from public, anon, authenticated;
grant execute on function public.portfolio_is_owner() to authenticated;

create policy "Only the owner can read draft history" on public.portfolio_history
  for select to authenticated using ((select public.portfolio_is_owner()));
create policy "Only the owner can read the draft" on public.portfolio_drafts
  for select to authenticated using ((select public.portfolio_is_owner()));
create policy "Visitors can read the current publication" on public.portfolio_published
  for select to anon, authenticated using (true);

-- The only browser write entry point. Draft, history and publication update in
-- one transaction, and an editor opened earlier cannot overwrite a later save.
create function public.portfolio_save_home(
  design jsonb, expected_revision bigint, publish_now boolean
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  prior_revision bigint;
  next_revision bigint;
begin
  -- Lock the single owner row so saves and permission changes serialize.
  perform 1 from public.portfolio_owner where user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = '42501', message = 'Portfolio owner required';
  end if;

  if jsonb_typeof(design) is distinct from 'object'
    or design->'version' is distinct from '1'::jsonb
    or design->>'page' is distinct from 'home'
    or jsonb_typeof(design->'desktop') is distinct from 'object'
    or jsonb_typeof(design->'mobile') is distinct from 'object'
    or jsonb_typeof(design->'content') is distinct from 'object'
    or octet_length(design::text) > 1000000
    or publish_now is null then
    raise exception using errcode = '22023', message = 'Invalid portfolio document';
  end if;

  select revision into prior_revision from public.portfolio_drafts where page = 'home';
  if prior_revision is distinct from expected_revision then
    raise exception using errcode = '40001', message = 'Portfolio draft has changed';
  end if;

  insert into public.portfolio_history (page, document, published)
    values ('home', design, publish_now) returning revision into next_revision;

  insert into public.portfolio_drafts (page, document, revision)
    values ('home', design, next_revision)
    on conflict (page) do update set document = excluded.document, revision = excluded.revision;

  if publish_now then
    insert into public.portfolio_published (page, document, revision)
      values ('home', design, next_revision)
      on conflict (page) do update set document = excluded.document, revision = excluded.revision;
  end if;

  return next_revision;
end;
$$;

revoke all on function public.portfolio_save_home(jsonb, bigint, boolean) from public, anon, authenticated;
grant execute on function public.portfolio_save_home(jsonb, bigint, boolean) to authenticated;

commit;
