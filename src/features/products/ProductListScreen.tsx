import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffRole } from '@/app/use-staff-session.ts'
import { Button } from '@/components/ui/button.tsx'
import { Card } from '@/components/ui/card.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { LowStockBadge } from '@/features/products/LowStockBadge.tsx'
import { fetchProductList, PRODUCTS_QUERY_KEY } from '@/lib/data/products.ts'
import { canManageProducts } from '@/lib/route-access.ts'
import { categoryLabel, isLowStock, PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/products/types.ts'
import { formatGhs, pesewas, type Pesewas } from '@/lib/money.ts'

function lowestPricePesewas(variants: { price_pesewas: Pesewas }[]): Pesewas | null {
  if (variants.length === 0) return null
  return pesewas(Math.min(...variants.map((variant) => variant.price_pesewas)))
}

export function ProductListScreen() {
  const role = useStaffRole()
  const canEdit = role ? canManageProducts(role) : false
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const [includeArchived, setIncludeArchived] = useState(false)

  const query = useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'list', search, category, includeArchived],
    queryFn: () => fetchProductList({ search, category, includeArchived }),
  })

  const emptyMessage = useMemo(() => {
    if (query.isLoading) return null
    if (search.trim()) return 'No products match your search.'
    if (includeArchived) return 'No products yet.'
    return 'No active products yet.'
  }, [includeArchived, query.isLoading, search])

  return (
    <div className="space-y-6">
      <FolderHeader canEdit={canEdit} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="product-search">Search name or SKU</Label>
          <Input
            id="product-search"
            className="min-h-11"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Oxford, LIN-L-NVY…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="product-category">Category</Label>
          <select
            id="product-category"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as ProductCategory | 'all')}
          >
            <option value="all">All categories</option>
            {PRODUCT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading products…
        </p>
      ) : null}

      {query.isError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {(query.error as Error).message}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && (query.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}

      <ul className="space-y-3">
        {(query.data ?? []).map((product) => {
          const lowStock = product.variants.some(isLowStock)
          const fromPrice = lowestPricePesewas(product.variants)
          return (
            <li key={product.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link to={`/products/${product.id}`} className="text-base font-semibold underline-offset-2 hover:underline">
                      {product.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {categoryLabel(product.category)}
                      {!product.active ? <span className="ml-2 text-xs uppercase tracking-wide">Archived</span> : null}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}
                      {fromPrice != null ? ` · from ${formatGhs(fromPrice)}` : ''}
                    </p>
                  </div>
                  {lowStock ? <LowStockBadge /> : null}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FolderHeader({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">Catalogue and variant pricing</p>
      </div>
      {canEdit ? (
        <Button type="button" className="min-h-11" asChild>
          <Link to="/products/new">Add product</Link>
        </Button>
      ) : null}
    </div>
  )
}