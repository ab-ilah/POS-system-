import { dbInteger, lineTotal, sumPesewas, type Pesewas } from '../money.ts'
import { assertAllowed } from '../permissions.ts'
import type { Operation, Role, TableName } from '../../types/index.ts'
import type { SaleId, SaleLineId, StoreId, VariantId } from '../../types/index.ts'

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
  /** Client-generated idempotency key. Send the same command again to replay it. */
  id: SaleId
  storeId: StoreId
  lines: readonly PreparedSaleLine[]
  totalPesewas: Pesewas
}

export type CommitSaleArgs = {
  idempotencyKey: string
  storeId: string
  lines: readonly {
    id: string
    variantId: string
    quantity: ReturnType<typeof dbInteger>
    unitPricePesewas: Pesewas
  }[]
}

export type CommitSaleResult = {
  saleId: string
  replayed: boolean
}

export type CommitSaleClient = {
  commitSale(args: CommitSaleArgs): Promise<CommitSaleResult>
}

function assertUniqueLineIds(lines: readonly { id: string }[]): void {
  const seen = new Set<string>()
  for (const line of lines) {
    if (seen.has(line.id)) throw new Error(`Duplicate sale line id ${line.id}`)
    seen.add(line.id)
  }
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
  assertUniqueLineIds(lines)
  return {
    id,
    storeId: input.storeId,
    lines,
    totalPesewas: sumPesewas(lines.map((line) => line.lineTotalPesewas)),
  }
}

export async function commitSale(
  client: CommitSaleClient,
  command: SaleCommand,
  role: Role,
  gate: PermissionGate = assertAllowed,
): Promise<CommitSaleResult> {
  gate(role, 'sales', 'insert')
  gate(role, 'sale_lines', 'insert')
  assertUniqueLineIds(command.lines)
  return client.commitSale({
    idempotencyKey: command.id,
    storeId: command.storeId,
    lines: command.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      quantity: dbInteger(line.quantity),
      unitPricePesewas: line.unitPricePesewas,
    })),
  })
}
