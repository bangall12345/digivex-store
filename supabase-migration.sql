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
-- Insert langsung dari browser DITUTUP: pesanan hanya lewat fungsi create_order() di bawah.
drop policy if exists "digivex customer create own order" on public.orders;
drop policy if exists "digivex customer read own orders" on public.orders;
create policy "digivex customer read own orders" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.digivex_is_admin());
drop policy if exists "digivex admin update orders" on public.orders;
create policy "digivex admin update orders" on public.orders
  for update to authenticated
  using (public.digivex_is_admin())
  with check (public.digivex_is_admin());


-- ======================= HARDENING (hasil audit) =======================
-- 1) Hapus SEMUA policy lama yang bukan milik DIGIVEX (policy PostgreSQL bersifat OR,
--    satu policy longgar membatalkan yang ketat). Cek dulu: select * from pg_policies where schemaname='public';
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('orders','products','user_roles','profiles')
             and policyname not like 'digivex %'
  loop execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename); end loop;
end $$;

-- 2) RLS tabel profiles
alter table public.profiles enable row level security;
drop policy if exists "digivex profiles read own"   on public.profiles;
drop policy if exists "digivex profiles insert own" on public.profiles;
drop policy if exists "digivex profiles update own" on public.profiles;
create policy "digivex profiles read own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.digivex_is_admin());
create policy "digivex profiles insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "digivex profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 3) Batasan data (NOT VALID: baris lama tidak diperiksa, baris baru wajib lolos)
alter table public.orders
  drop constraint if exists orders_status_chk,
  drop constraint if exists orders_price_chk;
alter table public.orders
  add constraint orders_status_chk check (status in ('Pending','Diproses','Sukses','Gagal')) not valid,
  add constraint orders_price_chk  check (price is null or price > 0) not valid;

-- 4) Pesanan dibuat server: harga dari tabel products, nama pembeli dari profiles
create or replace function public.create_order(
  p_product_id text, p_item_name text, p_target_id text, p_payment_method text
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_product public.products; v_item jsonb; v_name text; v_order public.orders;
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  if p_payment_method not in ('QRIS','DANA','OVO') then raise exception 'Metode pembayaran tidak valid'; end if;
  -- Sesuaikan pola ini bila ada produk dengan ID email/kode (Steam, Roblox, dll).
  if p_target_id !~ '^[0-9]{4,20}( \([0-9]{1,8}\))?$' then raise exception 'ID tujuan tidak valid'; end if;
  if (select count(*) from public.orders where user_id = auth.uid() and status = 'Pending') >= 5 then
    raise exception 'Terlalu banyak pesanan menunggu';
  end if;
  select * into v_product from public.products where id = p_product_id;
  if not found then raise exception 'Produk tidak ditemukan'; end if;
  select i into v_item from jsonb_array_elements(v_product.items) i where i->>'nama' = p_item_name limit 1;
  if v_item is null or coalesce((v_item->>'harga')::numeric, 0) <= 0 then raise exception 'Item tidak ditemukan'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.orders (user_id, user_name, product_name, item_name, price, target_id, payment_method, status)
  values (auth.uid(), coalesce(v_name,'Pengguna') || ' (' || coalesce(auth.jwt()->>'email','') || ')',
          v_product.nama, p_item_name, (v_item->>'harga')::numeric, p_target_id, p_payment_method, 'Pending')
  returning * into v_order;
  return v_order;
end $$;
revoke all on function public.create_order(text,text,text,text) from public, anon;
grant execute on function public.create_order(text,text,text,text) to authenticated;

-- 5) Jejak audit perubahan status pesanan dan produk
create table if not exists public.digivex_audit (
  id bigserial primary key, at timestamptz not null default now(), actor uuid default auth.uid(),
  table_name text, row_id text, action text, old_data jsonb, new_data jsonb);
alter table public.digivex_audit enable row level security;
drop policy if exists "digivex audit admin read" on public.digivex_audit;
create policy "digivex audit admin read" on public.digivex_audit
  for select to authenticated using (public.digivex_is_admin());
create or replace function public.digivex_audit_fn() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.digivex_audit(table_name, row_id, action, old_data, new_data)
  values (tg_table_name, (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists digivex_audit_orders on public.orders;
create trigger digivex_audit_orders after update on public.orders
  for each row when (old.status is distinct from new.status) execute function public.digivex_audit_fn();
drop trigger if exists digivex_audit_products on public.products;
create trigger digivex_audit_products after insert or update or delete on public.products
  for each row execute function public.digivex_audit_fn();

-- 6) MFA admin (M-2): AKTIFKAN HANYA setelah alur enroll/challenge TOTP ada di admin.html, kalau tidak admin terkunci.
-- create or replace function public.digivex_is_admin() returns boolean language sql stable security definer set search_path = public as $f$
--   select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
--          and coalesce(auth.jwt()->>'aal','') = 'aal2'; $f$;

-- SETELAH membuat akun admin melalui Authentication > Users, ganti UUID di bawah:
-- insert into public.user_roles (user_id, role)
-- values ('UUID_AUTH_USER_ADMIN', 'admin');
-- Jangan pernah memberi role admin melalui form publik aplikasi.
