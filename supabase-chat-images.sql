-- DIGIVEX STORE: kirim foto di chat (admin & pelanggan)
-- Jalankan sekali di Supabase SQL Editor. Aman diulang.

alter table public.chat_messages
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

-- Foto bisa dilihat lewat link (nama file acak, tidak bisa ditebak).
drop policy if exists "chat images public read" on storage.objects;
create policy "chat images public read"
on storage.objects for select
using (bucket_id = 'chat-images');

-- Pelanggan hanya boleh upload ke folder miliknya sendiri (nama folder = user id).
drop policy if exists "chat images customer upload" on storage.objects;
create policy "chat images customer upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Admin boleh upload ke folder pelanggan mana pun.
drop policy if exists "chat images admin upload" on storage.objects;
create policy "chat images admin upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-images'
  and public.digivex_is_admin()
);
