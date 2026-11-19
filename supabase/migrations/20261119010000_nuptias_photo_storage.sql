begin;

-- Private uploads. Portfolio documents keep references; history needs the same
-- immutable files when a removed photo or a previous version is restored.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-nuptias', 'portfolio-nuptias', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Editor owner can upload Nuptias photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'portfolio-nuptias'
  and name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|avif)$'
  and (select public.portfolio_is_owner())
);

create policy "Editor owner can read Nuptias uploads"
on storage.objects for select to authenticated
using (bucket_id = 'portfolio-nuptias' and (select public.portfolio_is_owner()));

create policy "Visitors can read published visible Nuptias uploads"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'portfolio-nuptias'
  and exists (
    select 1
    from public.portfolio_published as p
    where p.page = 'nuptias'
      and (p.document #> '{gallery,uploads}') ? ('upload:' || storage.objects.name)
      and p.document #>> array['gallery', 'photos', 'upload:' || storage.objects.name, 'state'] is null
  )
);

commit;
