-- DIGIVEX — kerangka pembayaran (jalankan SETELAH supabase-migration.sql). Aman dijalankan di mode uji coba.
alter table public.orders
  add column if not exists payment_ref text unique,
  add column if not exists invoice_url text,
  add column if not exists paid_at timestamptz;

-- Hanya service_role (Edge Function webhook) yang boleh menandai lunas. Idempoten: hanya sekali berhasil,
-- dan nominal harus sama dengan price di database.
create or replace function public.mark_order_paid(p_order_id text, p_amount numeric, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update public.orders set status = 'Sukses', paid_at = now(), payment_ref = coalesce(payment_ref, p_ref)
  where id::text = p_order_id and status in ('Pending','Diproses') and price = p_amount;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;
revoke all on function public.mark_order_paid(text,numeric,text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text,numeric,text) to service_role;

-- GO-LIVE: setelah webhook teruji di sandbox, aktifkan ini agar admin tidak bisa menandai Sukses manual.
-- drop policy if exists "digivex admin update orders" on public.orders;
-- create policy "digivex admin update orders" on public.orders for update to authenticated
--   using (public.digivex_is_admin())
--   with check (public.digivex_is_admin() and status in ('Pending','Diproses','Gagal'));
