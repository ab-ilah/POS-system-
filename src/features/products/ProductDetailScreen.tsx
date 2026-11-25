import type { ReactNode } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useStaffRole } from '@/app/use-staff-session.ts'
import { Button } from '@/components/ui/button.tsx'
import { Card } from '@/components/ui/card.tsx'
import { LowStockBadge } from '@/features/products/LowStockBadge.tsx'
import { fetchProductById, friendlyProductError, PRODUCTS_QUERY_KEY, setProductActive } from '@/lib/data/products.ts'
import { canManageProducts } from '@/lib/route-access.ts'
import { categoryLabel, formatVariantLabel, isLowStock } from '@/lib/products/types.ts'
import { formatGhs } from '@/lib/money.ts'

export function ProductDetailScreen() {
  const { productId = '' } = useParams()
  const role = useStaffRole()
  const canEdit = role ? canManageProducts(role) : false
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, 'detail', productId],
    queryFn: () => fetchProductById(productId),
    enabled: productId.length > 0,
  })

  const [archiveError, setArchiveError] = useState<string | null>(null)

  const archiveMutation = useMutation({
    mutationFn: (active: boolean) => setProductActive(productId, active),
    onSuccess: () => {
      setArchiveError(null)
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY })
    },
    onError: (error) => setArchiveError(friendlyProductError(error)),
  })

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading product…</p>
  }

  if (query.isError) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
        {(query.error as Error).message}
      </p>
    )
  }

  if (!query.data) {
    return (
      <PageWrap>
        <p className="text-sm text-muted-foreground">Product not found.</p>
        <Button type="button" variant="outline" className="mt-4 min-h-11" asChild>
          <Link to="/products">Back to products</Link>
        </Button>
      </PageWrap>
    )
  }

  const product = query.data

  return (
    <PageWrap className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link to="/products" className="underline-offset-2 hover:underline">
              Products
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(product.category)}
            {!product.active ? <span className="ml-2 text-xs uppercase tracking-wide">Archived</span> : null}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11" asChild>
              <Link to={`/products/${product.id}/edit`}>Edit</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate(!product.active)}
            >
              {product.active ? 'Archive' : 'Unarchive'}
            </Button>
          </div>
        ) : null}
      </div>

      {archiveError ? (
        <p className="text-sm text-destructive" role="alert">
          {archiveError}
        </p>
      ) : null}

      {product.description ? <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p> : null}

      <section className="space-y-3" aria-labelledby="variants-heading">
        <h2 id="variants-heading" className="text-lg font-semibold">
          Variants
        </h2>
        {product.variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variants yet.</p>
        ) : (
          <ul className="space-y-2">
            {product.variants.map((variant) => (
              <li key={variant.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{formatVariantLabel(variant)}</p>
                    <p className="text-sm text-muted-foreground">SKU {variant.sku}</p>
                    <p className="text-sm tabular-nums">
                      {formatGhs(variant.price_pesewas)} · Stock {variant.stock_qty}
                    </p>
                  </div>
                  {isLowStock(variant) ? <LowStockBadge /> : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrap>
  )
}

function PageWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}