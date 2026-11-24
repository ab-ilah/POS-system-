import { pesewas, shelfPriceFromCedis } from '@/lib/money.ts'
import type {
  ProductInput,
  ProductRow,
  ProductVariantRow,
  ProductWithVariants,
  VariantInput,
} from '@/lib/products/types.ts'

const now = () => new Date().toISOString()

let products: ProductRow[] = [
  {
    id: 'prod-tee',
    name: 'Basic cotton tee',
    category: 'shirts',
    description: 'Soft everyday tee for the till demo.',
    image_path: null,
    active: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'prod-linen',
    name: 'Linen shirt',
    category: 'shirts',
    description: 'Breathable linen for warm days.',
    image_path: null,
    active: true,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'prod-kaftan-archived',
    name: 'Printed kaftan (archived)',
    category: 'kaftans',
    description: 'Seasonal style no longer on the floor.',
    image_path: null,
    active: false,
    created_at: now(),
    updated_at: now(),
  },
]

let variants: ProductVariantRow[] = [
  {
    id: 'demo-tee-m-white',
    product_id: 'prod-tee',
    sku: 'TEE-M-WHT',
    size_name: 'M',
    colour_name: 'White',
    price_pesewas: shelfPriceFromCedis(45, 50),
    stock_qty: 12,
    low_stock_threshold: 5,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'demo-linen-l-navy',
    product_id: 'prod-linen',
    sku: 'LIN-L-NVY',
    size_name: 'L',
    colour_name: 'Navy',
    price_pesewas: shelfPriceFromCedis(89, 99),
    stock_qty: 3,
    low_stock_threshold: 5,
    created_at: now(),
    updated_at: now(),
  },
  {
    id: 'demo-kaftan-m-gold',
    product_id: 'prod-kaftan-archived',
    sku: 'KAF-M-GLD',
    size_name: 'M',
    colour_name: 'Gold',
    price_pesewas: shelfPriceFromCedis(120, 0),
    stock_qty: 0,
    low_stock_threshold: 5,
    created_at: now(),
    updated_at: now(),
  },
]

function attachVariants(product: ProductRow): ProductWithVariants {
  return {
    ...product,
    variants: variants.filter((variant) => variant.product_id === product.id),
  }
}

export function demoListProducts(options: {
  search: string
  category: string
  includeArchived: boolean
}): ProductWithVariants[] {
  const needle = options.search.trim().toLowerCase()
  return products
  .filter((product) => (options.includeArchived ? true : product.active))
  .filter((product) => options.category === 'all' || product.category === options.category)
  .map(attachVariants)
  .filter((product) => {
    if (!needle) return true
    if (product.name.toLowerCase().includes(needle)) return true
    return product.variants.some((variant) => variant.sku.toLowerCase().includes(needle))
  })
  .sort((left, right) => left.name.localeCompare(right.name))
}

export function demoGetProduct(productId: string): ProductWithVariants | null {
  const product = products.find((row) => row.id === productId)
  return product ? attachVariants(product) : null
}

export function demoCreateProduct(input: ProductInput): ProductWithVariants {
  const product: ProductRow = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    category: input.category,
    description: input.description.trim() || null,
    image_path: null,
    active: true,
    created_at: now(),
    updated_at: now(),
  }
  products = [...products, product]
  return attachVariants(product)
}

export function demoUpdateProduct(productId: string, input: ProductInput): ProductWithVariants {
  const index = products.findIndex((row) => row.id === productId)
  if (index < 0) throw new Error('Product not found')
  const updated: ProductRow = {
    ...products[index]!,
    name: input.name.trim(),
    category: input.category,
    description: input.description.trim() || null,
    updated_at: now(),
  }
  products = products.map((row, i) => (i === index ? updated : row))
  return attachVariants(updated)
}

export function demoSetProductActive(productId: string, active: boolean): ProductWithVariants {
  const index = products.findIndex((row) => row.id === productId)
  if (index < 0) throw new Error('Product not found')
  const updated = { ...products[index]!, active, updated_at: now() }
  products = products.map((row, i) => (i === index ? updated : row))
  return attachVariants(updated)
}

export function demoUpsertVariant(productId: string, variantId: string | null, input: VariantInput): ProductVariantRow {
  if (!products.some((row) => row.id === productId)) throw new Error('Product not found')
  const sku = input.sku.trim().toUpperCase()
  const duplicate = variants.find(
    (row) => row.sku.toLowerCase() === sku.toLowerCase() && row.id !== (variantId ?? ''),
  )
  if (duplicate) {
    const err = new Error('duplicate sku')
    Object.assign(err, { code: '23505' })
    throw err
  }
  if (variantId) {
    const index = variants.findIndex((row) => row.id === variantId && row.product_id === productId)
    if (index < 0) throw new Error('Variant not found')
    const updated: ProductVariantRow = {
      ...variants[index]!,
      sku,
      size_name: input.size_name.trim(),
      colour_name: input.colour_name.trim(),
      price_pesewas: pesewas(input.price_pesewas),
      low_stock_threshold: input.low_stock_threshold,
      updated_at: now(),
    }
    variants = variants.map((row, i) => (i === index ? updated : row))
    return updated
  }
  const created: ProductVariantRow = {
    id: crypto.randomUUID(),
    product_id: productId,
    sku,
    size_name: input.size_name.trim(),
    colour_name: input.colour_name.trim(),
    price_pesewas: pesewas(input.price_pesewas),
    stock_qty: 0,
    low_stock_threshold: input.low_stock_threshold,
    created_at: now(),
    updated_at: now(),
  }
  variants = [...variants, created]
  return created
}