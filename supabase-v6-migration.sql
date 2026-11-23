-- DIGIVEX V6: harga modal untuk menghitung keuntungan transaksi baru. Jalankan setelah supabase-migration.sql.
alter table public.orders add column if not exists cost_price numeric(14,2);
alter table public.orders drop constraint if exists orders_cost_price_chk;
alter table public.orders add constraint orders_cost_price_chk check (cost_price is null or cost_price >= 0) not valid;
create or replace function public.create_order(p_product_id text,p_item_name text,p_target_id text,p_payment_method text) returns public.orders language plpgsql security definer set search_path=public as $$
declare v_product public.products; v_item jsonb; v_name text; v_order public.orders; v_price numeric; v_cost numeric;
begin
 if auth.uid() is null then raise exception 'Belum login'; end if;
 if p_payment_method not in ('QRIS','DANA','OVO') then raise exception 'Metode pembayaran tidak valid'; end if;
 if p_target_id !~ '^[0-9]{4,20}( \([0-9]{1,8}\))?$' then raise exception 'ID tujuan tidak valid'; end if;
 if (select count(*) from public.orders where user_id=auth.uid() and status='Pending')>=5 then raise exception 'Terlalu banyak pesanan menunggu'; end if;
 select * into v_product from public.products where id=p_product_id; if not found then raise exception 'Produk tidak ditemukan'; end if;
 select i into v_item from jsonb_array_elements(v_product.items) i where i->>'nama'=p_item_name limit 1; if v_item is null then raise exception 'Item tidak ditemukan'; end if;
 v_price:=coalesce((v_item->>'harga')::numeric,0); if v_price<=0 then raise exception 'Harga item tidak valid'; end if;
 if nullif(v_item->>'modal','') is not null then v_cost:=(v_item->>'modal')::numeric; if v_cost<0 or v_cost>v_price then raise exception 'Harga modal tidak valid'; end if; end if;
 select full_name into v_name from public.profiles where id=auth.uid();
 insert into public.orders(user_id,user_name,product_name,item_name,price,cost_price,target_id,payment_method,status) values(auth.uid(),coalesce(v_name,'Pengguna')||' ('||coalesce(auth.jwt()->>'email','')||')',v_product.nama,p_item_name,v_price,v_cost,p_target_id,p_payment_method,'Pending') returning * into v_order; return v_order;
end $$;
revoke all on function public.create_order(text,text,text,text) from public,anon; grant execute on function public.create_order(text,text,text,text) to authenticated;
