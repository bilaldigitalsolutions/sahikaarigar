-- ============================================================================
-- SahiKaarigar - Supabase Storage buckets
-- Migration: 0002_storage.sql
--
-- Firebase Storage is not available on the free plan, so worker avatars and
-- portfolio images live in Supabase Storage instead.
-- Uploads are performed server-side with the `service_role` key (which
-- bypasses storage RLS), therefore only a public READ policy is required.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',   'avatars',   true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  drop policy if exists "Public read avatars" on storage.objects;
  create policy "Public read avatars" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'avatars');

  drop policy if exists "Public read portfolio" on storage.objects;
  create policy "Public read portfolio" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'portfolio');
end;
$$;
