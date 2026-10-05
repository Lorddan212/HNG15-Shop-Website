begin;
do $$
declare u uuid:=gen_random_uuid(); t text:=repeat('b',64); p uuid; request uuid:=gen_random_uuid(); o uuid; second_o uuid; before_stock integer; amount integer;
begin
 select id,stock into p,before_stock from public.products where slug='daybook';
 insert into auth.users(id,email,aud,role) values(u,'foliovale-test@example.invalid','authenticated','authenticated');
 perform public.change_cart(t,p,2,'add');
 if (select quantity from public.cart_items ci join public.carts c on c.id=ci.cart_id where c.token_hash=t)<>2 then raise exception 'Cart persistence failed';end if;
 begin perform public.change_cart(t,p,11,'set');raise exception 'Invalid quantity was accepted';exception when raise_exception then if sqlerrm='Invalid quantity was accepted' then raise;end if;end;
 o:=public.checkout_cart(t,u,'foliovale-test@example.invalid',request,'{"full_name":"Test Customer","phone":"08012345678","address":"10 Example Street","city":"Lagos","state":"Lagos","notes":""}'::jsonb);
 select total_kobo into amount from public.orders where id=o;
 if amount<>1850000 then raise exception 'Server pricing failed';end if;
 if (select stock from public.products where id=p)<>before_stock-2 then raise exception 'Stock decrement failed';end if;
 second_o:=public.checkout_cart(t,u,'foliovale-test@example.invalid',request,'{}'::jsonb);
 if second_o<>o then raise exception 'Idempotency failed';end if;
 if (select stock from public.products where id=p)<>before_stock-2 then raise exception 'Duplicate request decremented stock';end if;
 if not public.claim_order_email(o) then raise exception 'Email claim failed';end if;
 if public.claim_order_email(o) then raise exception 'Concurrent duplicate email claim';end if;
 if not exists(select 1 from public.profiles where id=u) then raise exception 'Profile not saved';end if;
 if exists(select 1 from public.cart_items ci join public.carts c on c.id=ci.cart_id where c.token_hash=t) then raise exception 'Cart not cleared';end if;
 -- Removing history must preserve snapshots, stock and the original request ID.
 update public.orders set deleted_at=now() where id=o and user_id=gen_random_uuid() and deleted_at is null;
 if found then raise exception 'Wrong owner removed order';end if;
 update public.orders set deleted_at=now() where id=o and user_id=u and deleted_at is null;
 if not found then raise exception 'Owner could not remove order';end if;
 update public.orders set deleted_at=now() where id=o and user_id=u and deleted_at is null;
 if found then raise exception 'Repeated removal changed order';end if;
 if exists(select 1 from public.orders where id=o and user_id=u and deleted_at is null) then raise exception 'Deleted order is visible';end if;
 if not exists(select 1 from public.order_items where order_id=o) then raise exception 'Order snapshots lost';end if;
 second_o:=public.checkout_cart(t,u,'foliovale-test@example.invalid',request,'{}'::jsonb);
 if second_o<>o then raise exception 'Deleted checkout lost idempotency';end if;
 if (select stock from public.products where id=p)<>before_stock-2 then raise exception 'History removal changed stock';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('foliovale.test_order_id',o::text,true);
end $$;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.orders where id=current_setting('foliovale.test_order_id')::uuid) then raise exception 'RLS exposed deleted order';end if;
 if exists(select 1 from public.order_items where order_id=current_setting('foliovale.test_order_id')::uuid) then raise exception 'RLS exposed deleted items';end if;
end $$;
reset role;
select 'Cart, totals, stock, idempotency, email claims, history deletion and RLS passed' as result;
rollback;
