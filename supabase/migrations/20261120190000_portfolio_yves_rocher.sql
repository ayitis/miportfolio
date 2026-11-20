begin;
-- Permit the Yves Rocher case study in editor drafts, history and published designs.
-- Existing documents, authentication policies and ownership stay unchanged.
alter table public.portfolio_history drop constraint portfolio_history_page_check,
  add constraint portfolio_history_page_check check (page in ('home', 'nuptias', 'maison-carnage', 'ayam', 'villa-tiger', 'yves-rocher'));
alter table public.portfolio_drafts drop constraint portfolio_drafts_page_check,
  add constraint portfolio_drafts_page_check check (page in ('home', 'nuptias', 'maison-carnage', 'ayam', 'villa-tiger', 'yves-rocher'));
alter table public.portfolio_published drop constraint portfolio_published_page_check,
  add constraint portfolio_published_page_check check (page in ('home', 'nuptias', 'maison-carnage', 'ayam', 'villa-tiger', 'yves-rocher'));

create or replace function public.portfolio_save_page(page_key text, design jsonb, expected_revision bigint, publish_now boolean)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare prior_revision bigint;
        next_revision bigint;
begin
  perform 1 from public.portfolio_owner where user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = '42501', message = 'Portfolio owner required';
  end if;
  if page_key is null or page_key not in ('home','nuptias','maison-carnage','ayam','villa-tiger','yves-rocher')
    or jsonb_typeof(design) is distinct from 'object'
    or design->'version' is distinct from '1'::jsonb
    or design->>'page' is distinct from page_key
    or jsonb_typeof(design->'desktop') is distinct from 'object'
    or jsonb_typeof(design->'mobile') is distinct from 'object'
    or jsonb_typeof(design->'content') is distinct from 'object'
    or octet_length(design::text) > 1000000
    or publish_now is null then
    raise exception using errcode = '22023', message = 'Invalid portfolio document';
  end if;
  select revision into prior_revision from public.portfolio_drafts where page = page_key;
  if prior_revision is distinct from expected_revision then
    raise exception using errcode = '40001', message = 'Portfolio draft has changed';
  end if;
  insert into public.portfolio_history (page,document,published)
    values (page_key,design,publish_now) returning revision into next_revision;
  insert into public.portfolio_drafts (page,document,revision)
    values (page_key,design,next_revision)
    on conflict (page) do update set document=excluded.document,revision=excluded.revision;
  if publish_now then
    insert into public.portfolio_published (page,document,revision)
      values (page_key,design,next_revision)
      on conflict (page) do update set document=excluded.document,revision=excluded.revision;
  end if;
  return next_revision;
end;
$$;
commit;
