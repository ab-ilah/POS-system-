import { describe, expect, it } from 'vitest'
import { dbInteger } from '../../src/lib/money.ts'
import { createRowStore } from '../../src/lib/data/row-store.ts'

describe('createRowStore', () => {
  it('upserts on id and surfaces the database error', async () => {
    const calls: { table: string; onConflict: string; count: number }[] = []
    const store = createRowStore({
      from(table) {
        return {
          async upsert(values, options) {
            calls.push({ table, onConflict: options.onConflict, count: values.length })
            return { error: null }
          },
        }
      },
    })

    await store.upsert('sales', [{ id: 'sale-1', total_pesewas: dbInteger(100) }], 'id')
    expect(calls).toEqual([{ table: 'sales', onConflict: 'id', count: 1 }])

    const failing = createRowStore({
      from() {
        return {
          async upsert() {
            return { error: { message: 'duplicate key' } }
          },
        }
      },
    })
    await expect(failing.upsert('sales', [{ id: 'sale-1' }], 'id')).rejects.toThrow('duplicate key')
  })
})
