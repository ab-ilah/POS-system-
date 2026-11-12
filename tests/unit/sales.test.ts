import { describe, expect, it } from 'vitest'
import { commitSale, prepareSale, type CommitSaleArgs, type CommitSaleClient } from '../../src/lib/data/sales.ts'
import { shelfPriceFromCedis } from '../../src/lib/money.ts'

function rpcClient() {
  const calls: CommitSaleArgs[] = []
  const client: CommitSaleClient = {
    async commitSale(args) {
      calls.push(args)
      const replayed = calls.filter((call) => call.idempotencyKey === args.idempotencyKey).length > 1
      return { saleId: args.idempotencyKey, replayed }
    },
  }
  return { client, calls }
}

const shirt = shelfPriceFromCedis(189, 0)
const thread = shelfPriceFromCedis(1, 5)

describe('prepareSale', () => {
  it('keeps client-generated ids so a retry targets the same command', () => {
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

  it('rejects an empty sale and duplicate line ids', () => {
    expect(() => prepareSale({ storeId: 'store-1', lines: [] })).toThrow(/at least one line/)
    expect(() =>
      prepareSale({
        storeId: 'store-1',
        lines: [
          { id: 'line-1', variantId: 'var-1', quantity: 1, unitPricePesewas: thread },
          { id: 'line-1', variantId: 'var-2', quantity: 1, unitPricePesewas: shirt },
        ],
      }),
    ).toThrow(/Duplicate sale line id line-1/)
  })
})

describe('commitSale', () => {
  it('sends the header and lines in one RPC and replays the same idempotency key', async () => {
    const { client, calls } = rpcClient()
    const command = prepareSale({
      id: 'sale-1',
      storeId: 'store-1',
      lines: [
        { id: 'line-1', variantId: 'var-1', quantity: 2, unitPricePesewas: shirt },
        { id: 'line-2', variantId: 'var-2', quantity: 1, unitPricePesewas: thread },
      ],
    })

    const first = await commitSale(client, command, 'cashier')
    const second = await commitSale(client, command, 'cashier')

    expect(first).toEqual({ saleId: 'sale-1', replayed: false })
    expect(second).toEqual({ saleId: 'sale-1', replayed: true })
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual(calls[1])
    expect(calls[0]).toMatchObject({
      idempotencyKey: 'sale-1',
      storeId: 'store-1',
      lines: [
        { id: 'line-1', variantId: 'var-1', quantity: 2, unitPricePesewas: 18900 },
        { id: 'line-2', variantId: 'var-2', quantity: 1, unitPricePesewas: 105 },
      ],
    })
  })

  it('asks the permission gate before the RPC and does not call it when denied', async () => {
    const { client, calls } = rpcClient()
    const seen: string[] = []
    const command = prepareSale({
      id: 'sale-1',
      storeId: 'store-1',
      lines: [{ id: 'line-1', variantId: 'var-1', quantity: 1, unitPricePesewas: thread }],
    })

    await expect(
      commitSale(client, command, 'cashier', (role) => {
        seen.push(role)
        throw new Error('denied')
      }),
    ).rejects.toThrow('denied')

    expect(seen).toEqual(['cashier'])
    expect(calls).toHaveLength(0)
  })
})
