import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { updateCartLineShelfPrices, type Cart } from '@/lib/cart.ts'
import { fetchVariantShelfPrices, VARIANT_SHELF_PRICES_QUERY_KEY } from '@/lib/data/variant-prices.ts'
import type { VariantId } from '@/types/index.ts'

export function useShelfPriceRefresh() {
  const queryClient = useQueryClient()

  const refreshCartShelfPrices = useCallback(async (cart: Cart, variantIds: readonly VariantId[]): Promise<Cart> => {
    await queryClient.invalidateQueries({ queryKey: VARIANT_SHELF_PRICES_QUERY_KEY })
    const prices = await queryClient.fetchQuery({
      queryKey: [...VARIANT_SHELF_PRICES_QUERY_KEY, ...variantIds],
      queryFn: () => fetchVariantShelfPrices(variantIds.length > 0 ? variantIds : cart.lines.map((line) => line.variantId)),
    })
    return updateCartLineShelfPrices(cart, prices)
  }, [queryClient])

  return { refreshCartShelfPrices }
}