# `commit_sale` RPC

Sales and sale lines are append-only. The frontend does not upsert them. One call inserts the header and its lines, or replays the original result when the same idempotency key is sent again.

This function is **not in this repo**. It is a backend follow-up in [POS-System-backend](https://github.com/ab-ilah/POS-System-backend). Until that migration exists, `commitSale` still calls the typed contract below; the database will reject the call.

## Expected signature

```sql
create function public.commit_sale(
  p_idempotency_key uuid,
  p_store_id uuid,
  p_lines jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
  -- One transaction:
  -- 1. If p_idempotency_key was already committed, return
  --    { "sale_id": <original>, "replayed": true } and do not write.
  -- 2. Otherwise insert the sale header and every line, then return
  --    { "sale_id": <p_idempotency_key>, "replayed": false }.
  -- Never update an existing sale or line.
$$;
```

`p_lines` is a JSON array of `{ "id", "variant_id", "quantity", "unit_price_pesewas" }`. Quantities and prices are integers. Pesewas are tax-inclusive shelf prices. Line ids must be unique within the call.

The idempotency key is the client-generated sale id. A retry sends the same key and the same lines. A different key is a different sale.

## TypeScript contract

`src/types/database.ts` declares `Database['public']['Functions']['commit_sale']`. `createCommitSaleClient` in `src/lib/data/supabase.ts` calls `client.rpc('commit_sale', …)`. `commitSale` in `src/lib/data/sales.ts` checks insert permission for `sales` and `sale_lines`, then makes that single call.
