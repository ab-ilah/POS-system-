import { lineTotal, sumPesewas, type Pesewas } from '../money.ts'
import { assertAllowed } from '../permissions.ts'
import type { Role, TableName, Operation } from '../../types/index.ts'
import type { SaleId, SaleLineId, StoreId, VariantId } from '../../types/index.ts'
import type { RowStore } from './types.ts'

export type PermissionGate = (role: Role, table: TableName, operation: Operation) => void

export type SaleLineInput = {
  id?: SaleLineId
  variantId: VariantId
  quantity: number
  unitPricePesewas: Pesewas
}

export type SaleInput = {
  id?: SaleId
  storeId: StoreId
  lines: readonly SaleLineInput[]
}

export type PreparedSaleLine = {
  id: SaleLineId
  variantId: VariantId
  quantity: number
  unitPricePesewas: Pesewas
  lineTotalPesewas: Pesewas
}

export type SaleCommand = {
  /** Client-generated primary key. Pass the same id again to retry the write. */
  id: SaleId
  storeId: StoreId
  lines: readonly PreparedSaleLine[]
  totalPesewas: Pesewas
}

export function prepareSale(input: SaleInput, newId: () => string = () => crypto.randomUUID()): SaleCommand {
  if (input.lines.length === 0) {
    throw new Error('A sale needs at least one line')
  }
  const id = input.id ?? newId()
  const lines = input.lines.map((line) => {
    const lineTotalPesewas = lineTotal(line.unitPricePesewas, line.quantity)
    return {
      id: line.id ?? newId(),
      variantId: line.variantId,
      quantity: line.quantity,
      unitPricePesewas: line.unitPricePesewas,
      lineTotalPesewas,
    }
  })
  return {
    id,
    storeId: input.storeId,
    lines,
    totalPesewas: sumPesewas(lines.map((line) => line.lineTotalPesewas)),
  }
}

export async function commitSale(
  store: RowStore,
  command: SaleCommand,
  role: Role,
  gate: PermissionGate = assertAllowed,
): Promise<void> {
  gate(role, 'sales', 'insert')
  gate(role, 'sale_lines', 'insert')
  await store.upsert(
    'sales',
    [
      {
        id: command.id,
        store_id: command.storeId,
        total_pesewas: command.totalPesewas,
      },
    ],
    'id',
  )
  await store.upsert(
    'sale_lines',
    command.lines.map((line) => ({
      id: line.id,
      sale_id: command.id,
      variant_id: line.variantId,
      quantity: line.quantity,
      unit_price_pesewas: line.unitPricePesewas,
    })),
    'id',
  )
}
