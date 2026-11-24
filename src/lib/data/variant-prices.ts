import type { Pesewas } from '../money.ts'
import { pesewas } from '../money.ts'
import type { VariantId } from '../../types/index.ts'
import { DEMO_VARIANTS } from '../../features/sell/demo-catalog.ts'
import { browserSupabase } from './supabase.ts'

export const VARIANT_SHELF_PRICES_QUERY_KEY = ['variant-shelf-prices'] as const

function demoPriceByVariantId(): Map<string, Pesewas> {
  return new Map(DEMO_VARIANTS.map((variant) => [variant.variantId, variant.unitPricePesewas]))
}

/** Shelf prices for checkout refresh (P0003). Falls back to demo catalog when Supabase is not configured. */
export async function fetchVariantShelfPrices(
  variantIds: readonly VariantId[],
): Promise<Map<string, Pesewas>> {
  const unique = [...new Set(variantIds)]
  const client = browserSupabase()
  if (!client) {
    const demo = demoPriceByVariantId()
    const result = new Map<string, Pesewas>()
    for (const variantId of unique) {
      const price = demo.get(variantId)
      if (price != null) result.set(variantId, price)
    }
    return result
  }

  const { data, error } = await client
    .from('product_variants')
    .select('id, price_pesewas')
    .in('id', unique)
  if (error) throw new Error(error.message)

  const result = new Map<string, Pesewas>()
  for (const row of data ?? []) {
    if (typeof row.id === 'string' && typeof row.price_pesewas === 'number') {
      result.set(row.id, pesewas(row.price_pesewas))
    }
  }
  return result
}