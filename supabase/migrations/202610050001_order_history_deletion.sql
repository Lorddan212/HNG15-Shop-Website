-- Keep snapshots and checkout request IDs while allowing customers to remove history entries.
alter table public.orders add column deleted_at timestamptz;
alter policy "Read own orders" on public.orders
 using ((select auth.uid()) = user_id and deleted_at is null);
-- The order-items policy already checks the parent order through its RLS policy.
