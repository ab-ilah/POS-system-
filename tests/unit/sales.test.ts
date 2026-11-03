import { describe, expect, it } from 'vitest'
import { commitSale, prepareSale } from '../../src/lib/data/sales.ts'
import type { RowStore, UpsertRow } from '../../src/lib/data/types.ts'
import { shelfPriceFromCedis } from '../../src/lib/money.ts'

function memoryStore() {
  const tables = new Map<string, Map<string, UpsertRow>>()
  const store: RowStore = {
    async upsert(table, rows, onConflict) {
      if (onConflict !== 'id') throw new Error(`expected onConflict id, got ${onConflict}`)
      const bucket = tables.get(table) ?? new Map<string, UpsertRow>()
      tables.set(table, bucket)
      for (const row of rows) bucket.set(row.id, { ...row })
    },
  }
  return { store, tables }
}

const shirt = shelfPriceFromCedis(189, 0)
const thread = shelfPriceFromCedis(1, 5)

describe('prepareSale', () => {
  it('keeps client-generated ids so a retry targets the same rows', () => {
    const command = prepareSale({
      id: 'sale-1',
      storeId: 'store-1',
      lines: [{ id: 'line-1', variantId: 'var-1', quantity: 2, unitPricePesewas: shirt }],
    })
    expect(command.id).toBe('sale-1')
    expect(command.lines[0]?.id).toBe('line-1')
    expect(command.totalPesewas).toBe(37800)
  })

  it('fills missing ids from the injected generator', () => {
    let n = 0
    const command = prepareSale(
      {
        storeId: 'store-1',
        lines: [{ variantId: 'var-1', quantity: 1, unitPricePesewas: thread }],
      },
      () => `id-${++n}`,
    )
    expect(command.id).toBe('id-1')
    expect(command.lines[0]?.id).toBe('id-2')
    expect(command.totalPesewas).toBe(105)
  })

  it('rejects an empty sale', () => {
    expect(() => prepareSale({ storeId: 'store-1', lines: [] })).toThrow(/at least one line/)
  })
})

describe('commitSale', () => {
  it('upserts on id so a second commit does not create another row', async () => {
    const { store, tables } = memoryStore()
    const command = prepareSale({
      id: 'sale-1',
      storeId: 'store-1',
      lines: [
        { id: 'line-1', variantId: 'var-1', quantity: 2, unitPricePesewas: shirt },
        { id: 'line-2', variantId: 'var-2', quantity: 1, unitPricePesewas: thread },
      ],
    })

    await commitSale(store, command, 'cashier')
    await commitSale(store, command, 'cashier')

    expect(tables.get('sales')?.size).toBe(1)
    expect(tables.get('sale_lines')?.size).toBe(2)
    expect(tables.get('sales')?.get('sale-1')).toMatchObject({
      id: 'sale-1',
      store_id: 'store-1',
      total_pesewas: 37905,
    })
    expect(tables.get('sale_lines')?.get('line-1')).toMatchObject({
      sale_id: 'sale-1',
      variant_id: 'var-1',
      quantity: 2,
      unit_price_pesewas: 18900,
    })
  })

  it('asks the permission gate before writing and does not write when denied', async () => {
    const { store, tables } = memoryStore()
    const calls: string[] = []
    const command = prepareSale({
      id: 'sale-1',
      storeId: 'store-1',
      lines: [{ id: 'line-1', variantId: 'var-1', quantity: 1, unitPricePesewas: thread }],
    })

    await expect(
      commitSale(store, command, 'cashier', () => {
        calls.push('denied')
        throw new Error('denied')
      }),
    ).rejects.toThrow('denied')

    expect(calls).toEqual(['denied'])
    expect(tables.size).toBe(0)
  })
})
