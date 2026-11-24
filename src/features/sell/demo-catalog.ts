import { shelfPriceFromCedis, type Pesewas } from '@/lib/money.ts'
import type { VariantId } from '@/types/index.ts'

export type DemoVariant = {
  variantId: VariantId
  productName: string
  variantLabel: string
  unitPricePesewas: Pesewas
}

/** Shelf picks for checkout demos until product search lands (POS-02e / POS-03 E5). */
export const DEMO_VARIANTS: readonly DemoVariant[] = [
  {
    variantId: 'demo-tee-m-white',
    productName: 'Basic cotton tee',
    variantLabel: 'M · White',
    unitPricePesewas: shelfPriceFromCedis(45, 50),
  },
  {
    variantId: 'demo-linen-l-navy',
    productName: 'Linen shirt',
    variantLabel: 'L · Navy',
    unitPricePesewas: shelfPriceFromCedis(89, 99),
  },
]