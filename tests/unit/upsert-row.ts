import { dbInteger, pesewas, type DbInteger } from '../../src/lib/money.ts'
import type { UpsertRow } from '../../src/lib/data/types.ts'

const integerRow: UpsertRow = { id: 'sale-1', total_pesewas: pesewas(18900), quantity: dbInteger(2) }

const floatRow: UpsertRow = {
  id: 'sale-1',
  // @ts-expect-error money columns reject non-integers
  total_pesewas: 1.5,
}

export const upsertExamples: { integerRow: UpsertRow; floatRow: UpsertRow; quantity: DbInteger } = {
  integerRow,
  floatRow,
  quantity: integerRow.quantity as DbInteger,
}
