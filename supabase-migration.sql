-- DIGIVEX STORE 2.0 — jalankan di Supabase SQL Editor setelah backup.
-- Pastikan project URL pada supabase-config.js benar sebelum deploy.

-- Lengkapi kolom pesanan yang dipakai aplikasi.
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists product_name text,
  add column if not exists item_name text,
  add column if not exists price numeric(14,2),
  add column if not exists target_id text,
  add column if not exists payment_method text,
  add column if not exists status text not null default 'Pending';

alter table public.orders alter column created_at set default now();
create index if not exists orders_user_id_created_at_idx
  on public.orders(user_id, created_at desc);
create index if not exists orders_created_at_idx
  on public.orders(created_at desc);

-- Fungsi pemeriksaan admin menghindari policy membaca user_roles secara rekursif.
create or replace function public.digivex_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.digivex_is_admin() from public;
grant execute on function public.digivex_is_admin() to authenticated;

alter table public.user_roles enable row level security;
drop policy if exists "digivex role read own" on public.user_roles;
create policy "digivex role read own" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.digivex_is_admin());

alter table public.products enable row level security;
drop policy if exists "digivex products public read" on public.products;
create policy "digivex products public read" on public.products
  for select to anon, authenticated using (true);
drop policy if exists "digivex products admin insert" on public.products;
create policy "digivex products admin insert" on public.products
  for insert to authenticated with check (public.digivex_is_admin());
drop policy if exists "digivex products admin update" on public.products;
create policy "digivex products admin update" on public.products
  for update to authenticated using (public.digivex_is_admin()) with check (public.digivex_is_admin());
drop policy if exists "digivex products admin delete" on public.products;
create policy "digivex products admin delete" on public.products
  for delete to authenticated using (public.digivex_is_admin());

alter table public.orders enable row level security;
drop policy if exists "digivex customer create own order" on public.orders;
create policy "digivex customer create own order" on public.orders
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "digivex customer read own orders" on public.orders;
create policy "digivex customer read own orders" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.digivex_is_admin());
drop policy if exists "digivex admin update orders" on public.orders;
create policy "digivex admin update orders" on public.orders
  for update to authenticated
  using (public.digivex_is_admin())
  with check (public.digivex_is_admin());

-- SETELAH membuat akun admin melalui Authentication > Users, ganti UUID di bawah:
-- insert into public.user_roles (user_id, role)
-- values ('UUID_AUTH_USER_ADMIN', 'admin');
-- Jangan pernah memberi role admin melalui form publik aplikasi.
