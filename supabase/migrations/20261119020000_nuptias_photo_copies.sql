begin;

-- The same immutable file may be used by more than one independently edited
-- photo. Permit signing only when at least one instance is publicly visible.
alter policy "Visitors can read published visible Nuptias uploads" on storage.objects
using (
  bucket_id = 'portfolio-nuptias'
  and exists (
    select 1
    from public.portfolio_published as p
    where p.page = 'nuptias'
      and (p.document #> '{gallery,uploads}') ? ('upload:' || storage.objects.name)
      and (
        p.document #>> array['gallery', 'photos', 'upload:' || storage.objects.name, 'state'] is null
        or exists (
          select 1
          from jsonb_each_text(
            case when jsonb_typeof(p.document #> '{gallery,copies}') = 'object'
              then p.document #> '{gallery,copies}' else '{}'::jsonb end
          ) as instance(id, source)
          where instance.source = 'upload:' || storage.objects.name
            and p.document #>> array['gallery', 'photos', instance.id, 'state'] is null
        )
      )
  )
);

commit;
