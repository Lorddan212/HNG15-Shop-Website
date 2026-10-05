-- Run only against a disposable database, after all migrations. Every fixture rolls back.
begin;
do $$
declare
 u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); keep uuid:=gen_random_uuid();
 guest text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 candidate text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 account text; other_account text; again text; c uuid; other_c uuid; stamp timestamptz;
 o uuid; request uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,aud,role) values
 (u,'shared-cart-test@example.invalid','authenticated','authenticated'),
 (v,'other-cart-test@example.invalid','authenticated','authenticated');
 insert into public.products(id,slug,name,category,description,price_kobo,stock,color,cover_label,subtitle,specs) values
 (p,p::text,'Stock limit','Notebooks','Fixture',10000,5,'blue','test','test','{}'),
 (q,q::text,'Quantity limit','Notebooks','Fixture',10000,50,'blue','test','test','{}'),
 (r,r::text,'Unavailable','Notebooks','Fixture',10000,5,'blue','test','test','{}'),
 (keep,keep::text,'Account only','Notebooks','Fixture',10000,50,'blue','test','test','{}');

 account:=public.resolve_account_cart(u,null,candidate);
 again:=public.resolve_account_cart(u,null,repeat('c',64));
 if account<>again then raise exception 'Different devices got different account carts';end if;
 select id into c from public.carts where user_id=u;
 if (select count(*) from public.carts where user_id=u)<>1 then raise exception 'Account cart uniqueness failed';end if;
 begin
  insert into public.carts(user_id,token_hash) values(u,repeat('e',64));
  raise exception 'Duplicate account cart allowed';
 exception when unique_violation then null;end;

 perform public.change_cart(account,p,2,'set');
 perform public.change_cart(account,q,8,'set');
 perform public.change_cart(account,keep,2,'set');
 perform public.change_cart(guest,p,3,'set');
 perform public.change_cart(guest,q,7,'set');
 perform public.change_cart(guest,r,2,'set');
 update public.products set active=false where id=r;
 again:=public.resolve_account_cart(u,guest,repeat('f',64));
 if again<>account or again=guest then raise exception 'Account identity changed or exposed guest secret';end if;
 if exists(select 1 from public.carts where token_hash=guest) then raise exception 'Obsolete guest cart remains';end if;
 if (select quantity from public.cart_items where cart_id=c and product_id=p)<>5 then raise exception 'Stock cap failed';end if;
 if (select quantity from public.cart_items where cart_id=c and product_id=q)<>10 then raise exception 'Quantity cap failed';end if;
 if (select quantity from public.cart_items where cart_id=c and product_id=keep)<>2 then raise exception 'Existing account item lost';end if;
 if exists(select 1 from public.cart_items where cart_id=c and product_id=r) then raise exception 'Inactive guest product retained';end if;
 again:=public.resolve_account_cart(u,guest,repeat('f',64));
 if (select quantity from public.cart_items where cart_id=c and product_id=p)<>5 then raise exception 'Repeated merge duplicated quantity';end if;

 -- A stolen/old guest cookie never resolves an account cart after sign-out.
 perform public.change_cart(guest,keep,1,'set');
 if not exists(select 1 from public.carts where token_hash=guest and user_id is null) then raise exception 'Guest compatibility broken';end if;
 if (select quantity from public.cart_items where cart_id=c and product_id=keep)<>2 then raise exception 'Guest accessed account items';end if;
 again:=public.resolve_account_cart(u,guest,repeat('f',64));
 if (select quantity from public.cart_items where cart_id=c and product_id=keep)<>3 then raise exception 'Second device guest merge failed';end if;

 other_account:=public.resolve_account_cart(v,account,repeat('d',64));
 if other_account=account then raise exception 'Other owner claimed account cart';end if;
 select id into other_c from public.carts where user_id=v;
 if exists(select 1 from public.cart_items where cart_id=other_c) then raise exception 'Another user copied account items';end if;
 perform public.change_cart(other_account,keep,1,'set');
 begin
  perform public.checkout_cart(account,v,'other-cart-test@example.invalid',gen_random_uuid(),'{}');
  raise exception 'Cross-account checkout allowed';
 exception when raise_exception then if sqlerrm='Cross-account checkout allowed' then raise;end if;end;

 select updated_at into stamp from public.carts where id=c;
 perform public.change_cart(account,keep,0,'set');
 if (select updated_at from public.carts where id=c)<=stamp then raise exception 'Removal did not touch cart';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('foliovale.test_cart',c::text,true);
 perform set_config('foliovale.other_cart',other_c::text,true);
 perform set_config('foliovale.test_account',account,true);
 perform set_config('foliovale.test_user',u::text,true);
end $$;

set local role authenticated;
do $$ begin
 if (select count(id) from public.carts where id=current_setting('foliovale.test_cart')::uuid)<>1 then raise exception 'Owner cannot read cart metadata';end if;
 if exists(select id from public.carts where id=current_setting('foliovale.other_cart')::uuid) then raise exception 'RLS exposed another cart';end if;
 if not exists(select 1 from public.cart_items where cart_id=current_setting('foliovale.test_cart')::uuid) then raise exception 'Owner cannot read cart items';end if;
 if exists(select 1 from public.cart_items where cart_id=current_setting('foliovale.other_cart')::uuid) then raise exception 'RLS exposed other items';end if;
 begin perform token_hash from public.carts;raise exception 'Token hash exposed';exception when insufficient_privilege then null;end;
 begin update public.carts set updated_at=now();raise exception 'Direct cart writes allowed';exception when insufficient_privilege then null;end;
 begin delete from public.cart_items;raise exception 'Direct item deletion allowed';exception when insufficient_privilege then null;end;
 begin insert into public.carts(token_hash) values(repeat('a',64));raise exception 'Direct cart insertion allowed';exception when insufficient_privilege then null;end;
 begin update public.cart_items set quantity=1;raise exception 'Direct item update allowed';exception when insufficient_privilege then null;end;
 begin perform public.resolve_account_cart(current_setting('foliovale.test_user')::uuid,null,repeat('a',64));raise exception 'Browser may execute resolver';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform id from public.carts;raise exception 'Anonymous cart reads allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.cart_items;raise exception 'Anonymous item reads allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;

do $$
declare o uuid;again uuid;request uuid:=gen_random_uuid();c uuid:=current_setting('foliovale.test_cart')::uuid;stamp timestamptz;
begin
 select updated_at into stamp from public.carts where id=c;
 o:=public.checkout_cart(current_setting('foliovale.test_account'),current_setting('foliovale.test_user')::uuid,'shared-cart-test@example.invalid',request,
 '{"full_name":"Test Customer","phone":"08012345678","address":"10 Example Street","city":"Lagos","state":"Lagos","notes":""}'::jsonb);
 again:=public.checkout_cart(current_setting('foliovale.test_account'),current_setting('foliovale.test_user')::uuid,'shared-cart-test@example.invalid',request,'{}');
 if o<>again then raise exception 'Shared checkout lost idempotency';end if;
 if exists(select 1 from public.cart_items where cart_id=c) then raise exception 'Shared checkout did not clear cart';end if;
 if (select updated_at from public.carts where id=c)<=stamp then raise exception 'Checkout did not touch cart';end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='carts') then raise exception 'Realtime publication missing';end if;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='carts' and 'token_hash'=any(attnames)) then raise exception 'Realtime publishes token hash';end if;
end $$;
select 'Shared identity, guest merging, quantity/stock caps, ownership, RLS, grants, timestamps, publication and checkout passed' as result;
rollback;
