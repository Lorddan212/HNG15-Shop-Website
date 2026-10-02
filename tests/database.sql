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
end $$;
select 'Cart, validation, server totals, stock, idempotency, email claim, profile and cart clearing passed' as result;
rollback;