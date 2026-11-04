import { describe, expect, it } from 'vitest'
import { createCommitSaleClient, type TypedSupabaseClient } from '../../src/lib/data/supabase.ts'
import { commitSaleWithTimeout } from '../../src/lib/data/commit-sale-call.ts'
import { dbInteger, pesewas } from '../../src/lib/money.ts'

const saleArgs = {
  idempotencyKey: 'sale-1',
  storeId: 'store-1',
  lines: [
    {
      id: 'line-1',
      variantId: 'var-1',
      quantity: dbInteger(1),
      unitPricePesewas: pesewas(100),
    },
  ],
}

describe('commitSaleWithTimeout', () => {
  it('retries a timed-out call with the same idempotency key', async () => {
    const keys: string[] = []
    const result = await commitSaleWithTimeout(async (signal) => {
      keys.push(saleArgs.idempotencyKey)
      if (keys.length === 1) {
        await new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      }
      return { saleId: saleArgs.idempotencyKey, replayed: true }
    }, 20)

    expect(keys).toEqual(['sale-1', 'sale-1'])
    expect(result).toEqual({ saleId: 'sale-1', replayed: true })
  })
})

describe('createCommitSaleClient timeout', () => {
  it('aborts the first commit_sale call and retries that same key', async () => {
    const keys: string[] = []
    let calls = 0
    const supabase = {
      rpc(_fn: string, args: { p_idempotency_key: string }) {
        keys.push(args.p_idempotency_key)
        return {
          abortSignal(signal: AbortSignal) {
            calls += 1
            if (calls === 1) {
              return new Promise<never>((_, reject) => {
                signal.addEventListener('abort', () => {
                  reject(new DOMException('The operation was aborted', 'AbortError'))
                })
              })
            }
            return Promise.resolve({
              data: { sale_id: args.p_idempotency_key, replayed: true },
              error: null,
            })
          },
        }
      },
    }

    const client = createCommitSaleClient(supabase as unknown as TypedSupabaseClient, { timeoutMs: 20 })
    const result = await client.commitSale(saleArgs)
    expect(result).toEqual({ saleId: 'sale-1', replayed: true })
    expect(keys).toEqual(['sale-1', 'sale-1'])
  })
})
