
create table public.products (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
 category text not null check (category in ('Notebooks','Planners','Sets')), description text not null,
 price_kobo integer not null check(price_kobo > 0), stock integer not null check(stock >= 0),
 color text not null, cover_label text not null, subtitle text not null, specs text[] not null,
 active boolean not null default true
);
create table public.carts (
 id uuid primary key default gen_random_uuid(), token_hash text unique not null check(length(token_hash)=64),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cart_items (
 cart_id uuid not null references public.carts on delete cascade,
 product_id uuid not null references public.products,
 quantity integer not null check(quantity between 1 and 10), primary key(cart_id,product_id)
);
create table public.profiles (
 id uuid primary key references auth.users on delete cascade, full_name text not null,
 phone text not null, address text not null, city text not null, state text not null,
 updated_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), reference text unique not null,
 user_id uuid not null references auth.users, request_id uuid not null,
 email text not null, full_name text not null, phone text not null, address text not null,
 city text not null, state text not null, notes text not null default '',
 subtotal_kobo integer not null check(subtotal_kobo > 0),
 shipping_kobo integer not null check(shipping_kobo >= 0),
 total_kobo integer not null check(total_kobo = subtotal_kobo + shipping_kobo),
 payment_method text not null default 'pay_on_delivery' check(payment_method='pay_on_delivery'),
 status text not null default 'placed' check(status='placed'),
 email_status text not null default 'queued' check(email_status in ('queued','sending','accepted','failed')),
 email_attempts integer not null default 0, email_attempted_at timestamptz, mailgun_id text,
 created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index orders_user_created_idx on public.orders(user_id,created_at desc);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete cascade,
 product_id uuid not null references public.products, product_name text not null,
 quantity integer not null check(quantity between 1 and 10),
 unit_price_kobo integer not null check(unit_price_kobo > 0)
);
create index order_items_order_idx on public.order_items(order_id);
create index cart_items_product_idx on public.cart_items(product_id);
create index order_items_product_idx on public.order_items(product_id);

alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.products,public.carts,public.cart_items,public.profiles,public.orders,public.order_items from anon,authenticated;
grant select on public.products to anon,authenticated;
grant select on public.profiles,public.orders,public.order_items to authenticated;
grant all on public.products,public.carts,public.cart_items,public.profiles,public.orders,public.order_items to service_role;
create policy "Public active catalogue" on public.products for select to anon,authenticated using(active);
create policy "Read own profile" on public.profiles for select to authenticated using((select auth.uid())=id);
create policy "Read own orders" on public.orders for select to authenticated using((select auth.uid())=user_id);
create policy "Read own order items" on public.order_items for select to authenticated using(exists(select 1 from public.orders where orders.id=order_id and orders.user_id=(select auth.uid())));

create function public.change_cart(p_token_hash text,p_product_id uuid,p_quantity integer,p_operation text)
returns void language plpgsql security definer set search_path='' as $$
declare v_cart uuid; v_stock integer; v_current integer; v_quantity integer;
begin
 if length(p_token_hash) <> 64 or p_quantity not between 0 and 10 or p_operation not in ('set','add') then
  raise exception 'Invalid cart request'; end if;
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

create function public.checkout_cart(p_token_hash text,p_user_id uuid,p_email text,p_request_id uuid,p_delivery jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_cart uuid; v_order uuid; v_subtotal integer:=0; v_shipping integer; v_item record;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || p_request_id::text,0));
 select id into v_order from public.orders where user_id=p_user_id and request_id=p_request_id;
 if found then return v_order; end if;
 if not exists(select 1 from auth.users where id=p_user_id and email=p_email) then raise exception 'Sign in again to place your order'; end if;
 if (select count(*) from public.orders where user_id=p_user_id and created_at>now()-interval '10 minutes') >= 5 then
  raise exception 'Please wait before placing another order'; end if;
 select id into v_cart from public.carts where token_hash=p_token_hash for update;
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

create function public.claim_order_email(p_order_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.orders set email_status='sending',email_attempts=email_attempts+1,email_attempted_at=now()
 where id=p_order_id and email_status in ('queued','failed') and email_attempts<3
 and (email_attempted_at is null or email_attempted_at<now()-interval '60 seconds');
 return found;
end $$;
revoke all on function public.claim_order_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_order_email(uuid) to service_role;
