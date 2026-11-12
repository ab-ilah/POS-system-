import { describe, expect, it } from 'vitest'
import { createCommitSaleClient, type TypedSupabaseClient } from '../../src/lib/data/supabase.ts'
import type { Database } from '../../src/types/database.ts'
import { dbInteger, pesewas } from '../../src/lib/money.ts'

describe('createCommitSaleClient', () => {
  it('calls commit_sale once with the idempotency key and integer lines', async () => {
    const calls: { fn: string; args: Database['public']['Functions']['commit_sale']['Args'] }[] = []
    const supabase = {
      rpc(fn: 'commit_sale', args: Database['public']['Functions']['commit_sale']['Args']) {
        calls.push({ fn, args })
        return {
          abortSignal() {
            return Promise.resolve({
              data: { sale_id: args.p_idempotency_key, replayed: false },
              error: null,
            })
          },
        }
      },
    }

    const client = createCommitSaleClient(supabase as unknown as TypedSupabaseClient)
    const result = await client.commitSale({
      idempotencyKey: 'sale-1',
      storeId: 'store-1',
      lines: [
        {
          id: 'line-1',
          variantId: 'var-1',
          quantity: dbInteger(2),
          unitPricePesewas: pesewas(18900),
        },
      ],
    })

    expect(result).toEqual({ saleId: 'sale-1', replayed: false })
    expect(calls).toEqual([
      {
        fn: 'commit_sale',
        args: {
          p_idempotency_key: 'sale-1',
          p_store_id: 'store-1',
          p_lines: [{ id: 'line-1', variant_id: 'var-1', quantity: 2, unit_price_pesewas: 18900 }],
        },
      },
    ])
  })

  it('throws CommitSaleRpcError with PostgREST fields when the RPC fails', async () => {
    const supabase = {
      rpc(_fn: 'commit_sale', _args: Database['public']['Functions']['commit_sale']['Args']) {
        return {
          abortSignal() {
            return Promise.resolve({
              data: null,
              error: {
                code: 'PSTCK',
                message: 'insufficient stock',
                details: 'variant_id=var-1',
                hint: 'Oxford shirt',
              },
            })
          },
        }
      },
    }

    const client = createCommitSaleClient(supabase as unknown as TypedSupabaseClient)
    await expect(
      client.commitSale({
        idempotencyKey: 'sale-1',
        storeId: 'store-1',
        lines: [
          {
            id: 'line-1',
            variantId: 'var-1',
            quantity: dbInteger(2),
            unitPricePesewas: pesewas(18900),
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'PSTCK',
      hint: 'Oxford shirt',
      details: 'variant_id=var-1',
    })
  })
})
