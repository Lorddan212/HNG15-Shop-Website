-- Phase 1: apply before deploying the shared-cart backend. Existing rows stay guests.
alter table public.carts add column user_id uuid references auth.users(id) on delete cascade;
create unique index carts_user_id_unique on public.carts(user_id) where user_id is not null;

-- Keep the ownership token private, including for the owner of an account cart.
revoke all on public.carts,public.cart_items from anon,authenticated;
grant select(id,user_id,created_at,updated_at) on public.carts to authenticated;
grant select on public.cart_items to authenticated;
create policy "Read own account cart" on public.carts for select to authenticated
 using (user_id=(select auth.uid()));
create policy "Read own account cart items" on public.cart_items for select to authenticated
 using (exists(select 1 from public.carts c where c.id=cart_id and c.user_id=(select auth.uid())));

-- All server mutation paths already lock the parent cart before changing its items.
-- Touch on removals and checkout as well as adds, for future Realtime subscribers.
create function public.touch_cart_from_items() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.carts set updated_at=clock_timestamp()
 where id=case when TG_OP='DELETE' then OLD.cart_id else NEW.cart_id end;
 return null;
end $$;
revoke all on function public.touch_cart_from_items() from public,anon,authenticated;
grant execute on function public.touch_cart_from_items() to service_role;
create trigger cart_items_touch_parent after insert or update or delete on public.cart_items
 for each row execute function public.touch_cart_from_items();

create function public.resolve_account_cart(p_user_id uuid,p_guest_token_hash text,p_new_token_hash text)
returns text language plpgsql security definer set search_path='' as $$
declare v_account uuid; v_guest uuid; v_token text; v_product record; v_quantity integer;
begin
 if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id)
 or p_new_token_hash is null or p_new_token_hash !~ '^[a-f0-9]{64}$'
 or (p_guest_token_hash is not null and p_guest_token_hash !~ '^[a-f0-9]{64}$') then
  raise exception 'Invalid account cart request';
 end if;
 -- Serializes first access/merges for the same user across browsers and devices.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-cart:'||p_user_id::text,0));
 if p_guest_token_hash is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cart-token:'||p_guest_token_hash,0));
 end if;
 insert into public.carts(user_id,token_hash) values(p_user_id,p_new_token_hash)
 on conflict(user_id) where user_id is not null do nothing;
 select id,token_hash into v_account,v_token from public.carts where user_id=p_user_id for update;
 -- Never claim another user's cart or reuse a guest cookie as an account secret.
 select id into v_guest from public.carts
 where token_hash=p_guest_token_hash and user_id is null for update;
 if v_guest is null then return v_token;end if;

 -- Lock stock in the same product-ID order as checkout. No stock is reserved here.
 for v_product in
  select p.id,p.stock,p.active from public.products p
  where exists(select 1 from public.cart_items ci where ci.product_id=p.id and ci.cart_id in(v_account,v_guest))
  order by p.id for update of p
 loop
  select least(10,v_product.stock,sum(quantity)::integer) into v_quantity
  from public.cart_items where product_id=v_product.id and cart_id in(v_account,v_guest);
  if not v_product.active then v_quantity:=0;end if;
  if v_quantity>0 then
   insert into public.cart_items(cart_id,product_id,quantity) values(v_account,v_product.id,v_quantity)
   on conflict(cart_id,product_id) do update set quantity=excluded.quantity;
  else
   delete from public.cart_items where cart_id=v_account and product_id=v_product.id;
  end if;
 end loop;
 delete from public.carts where id=v_guest and user_id is null;
 update public.carts set updated_at=clock_timestamp() where id=v_account;
 return v_token;
end $$;
revoke all on function public.resolve_account_cart(uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_account_cart(uuid,text,text) to service_role;

-- Publish only non-secret metadata. Clients later refetch the same /api/cart.
do $$ begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='carts') then
  alter publication supabase_realtime add table public.carts(id,user_id,created_at,updated_at);
 end if;
end $$;

-- Preserve the existing RPC signatures for the deployed Task 2 backend.
create or replace function public.change_cart(p_token_hash text,p_product_id uuid,p_quantity integer,p_operation text)
returns void language plpgsql security definer set search_path='' as $$
declare v_cart uuid; v_stock integer; v_current integer; v_quantity integer;
begin
 if length(p_token_hash) <> 64 or p_quantity not between 0 and 10 or p_operation not in ('set','add') then
  raise exception 'Invalid cart request'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cart-token:'||p_token_hash,0));
 insert into public.carts(token_hash) values(p_token_hash) on conflict(token_hash) do nothing;
 select id into v_cart from public.carts where token_hash=p_token_hash for update;
 select quantity into v_current from public.cart_items where cart_id=v_cart and product_id=p_product_id;
 v_quantity := case when p_operation='add' then coalesce(v_current,0)+p_quantity else p_quantity end;
 if v_quantity=0 then delete from public.cart_items where cart_id=v_cart and product_id=p_product_id; return; end if;
 select stock into v_stock from public.products where id=p_product_id and active;
 if not found then raise exception 'This product is unavailable'; end if;
 if v_quantity > 10 then raise exception 'You can add up to 10 of each item'; end if;
 if v_quantity > v_stock then raise exception 'There is not enough stock for this quantity'; end if;
 insert into public.cart_items(cart_id,product_id,quantity) values(v_cart,p_product_id,v_quantity)
 on conflict(cart_id,product_id) do update set quantity=excluded.quantity;
 update public.carts set updated_at=now() where id=v_cart;
end $$;
revoke all on function public.change_cart(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.change_cart(text,uuid,integer,text) to service_role;

create or replace function public.checkout_cart(p_token_hash text,p_user_id uuid,p_email text,p_request_id uuid,p_delivery jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_cart uuid; v_order uuid; v_subtotal integer:=0; v_shipping integer; v_item record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || p_request_id::text,0));
 select id into v_order from public.orders where user_id=p_user_id and request_id=p_request_id;
 if found then return v_order; end if;
 if not exists(select 1 from auth.users where id=p_user_id and email=p_email) then raise exception 'Sign in again to place your order'; end if;
 if (select count(*) from public.orders where user_id=p_user_id and created_at>now()-interval '10 minutes') >= 5 then
  raise exception 'Please wait before placing another order'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cart-token:'||p_token_hash,0));
 select id into v_cart from public.carts where token_hash=p_token_hash and (user_id is null or user_id=p_user_id) for update;
 if not found or not exists(select 1 from public.cart_items where cart_id=v_cart) then raise exception 'Your bag is empty'; end if;
 if length(trim(coalesce(p_delivery->>'full_name',''))) not between 2 and 100
 or length(trim(coalesce(p_delivery->>'phone',''))) not between 7 and 25
 or length(trim(coalesce(p_delivery->>'address',''))) not between 5 and 250
 or length(trim(coalesce(p_delivery->>'city',''))) not between 2 and 80
 or length(trim(coalesce(p_delivery->>'state',''))) not between 2 and 80
 or length(coalesce(p_delivery->>'notes','')) > 500 then raise exception 'Check your delivery details'; end if;
 for v_item in
  select p.id,p.name,p.price_kobo,p.stock,p.active,ci.quantity from public.cart_items ci
  join public.products p on p.id=ci.product_id where ci.cart_id=v_cart order by p.id for update of p
 loop
  if not v_item.active or v_item.stock < v_item.quantity then raise exception 'Some items are unavailable. Review your bag'; end if;
  v_subtotal:=v_subtotal+v_item.price_kobo*v_item.quantity;
 end loop;
 v_shipping:=case when v_subtotal>=3000000 then 0 else 150000 end;
 v_order:=gen_random_uuid();
 insert into public.orders(id,reference,user_id,request_id,email,full_name,phone,address,city,state,notes,subtotal_kobo,shipping_kobo,total_kobo)
 values(v_order,'FV-'||upper(right(replace(v_order::text,'-',''),12)),p_user_id,p_request_id,p_email,
 p_delivery->>'full_name',p_delivery->>'phone',p_delivery->>'address',p_delivery->>'city',p_delivery->>'state',coalesce(p_delivery->>'notes',''),v_subtotal,v_shipping,v_subtotal+v_shipping);
 insert into public.order_items(order_id,product_id,product_name,quantity,unit_price_kobo)
 select v_order,p.id,p.name,ci.quantity,p.price_kobo from public.cart_items ci join public.products p on p.id=ci.product_id where ci.cart_id=v_cart;
 update public.products p set stock=p.stock-ci.quantity from public.cart_items ci where ci.cart_id=v_cart and p.id=ci.product_id;
 insert into public.profiles(id,full_name,phone,address,city,state)
 values(p_user_id,p_delivery->>'full_name',p_delivery->>'phone',p_delivery->>'address',p_delivery->>'city',p_delivery->>'state')
 on conflict(id) do update set full_name=excluded.full_name,phone=excluded.phone,address=excluded.address,city=excluded.city,state=excluded.state,updated_at=now();
 delete from public.cart_items where cart_id=v_cart;
 return v_order;
end $$;
revoke all on function public.checkout_cart(text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.checkout_cart(text,uuid,text,uuid,jsonb) to service_role;

