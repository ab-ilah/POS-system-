import { Loader2, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStaffRole } from '@/app/use-staff-session.ts'
import { AlertDialog, StatusBanner } from '@/components/ui/alert-dialog.tsx'
import { Button } from '@/components/ui/button.tsx'
import { browserCheckoutCart } from '@/lib/data/checkout-gateway.ts'
import { cartGrossPesewas, type Cart } from '@/lib/cart.ts'
import type { CheckoutResult } from '@/lib/checkout.ts'
import { formatGhs, lineTotal } from '@/lib/money.ts'
import { taxBreakdownFromGross } from '@/lib/tax.ts'
import { DEMO_VARIANTS } from '@/features/sell/demo-catalog.ts'
import type { useSellCart } from '@/features/sell/use-sell-cart.ts'
import type { Pesewas } from '@/lib/money.ts'

type SellCart = ReturnType<typeof useSellCart>

export type CheckoutPhase =
  | 'editing'
  | 'committing'
  | 'success'
  | 'voided'
  | 'conflict'
  | 'unconfirmed'
  | 'network'

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function lineLabel(productName: string, variantLabel: string): string {
  return `${productName}, ${variantLabel}`
}

function CartLines({
  cart,
  locked,
  onChangeQuantity,
}: {
  cart: Cart
  locked: boolean
  onChangeQuantity: (lineId: string, delta: number) => void
}) {
  if (cart.lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No items yet. Search or pick a product.</p>
    )
  }
  const gross = cartGrossPesewas(cart)
  const tax = taxBreakdownFromGross(gross)
  return (
    <div className="space-y-4">
      {cart.lines.map((line) => (
        <div key={line.id} className="space-y-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 font-medium leading-snug">{line.label.split(',')[0]}</p>
              <p className="truncate text-sm text-muted-foreground">
                {line.label.includes(',') ? line.label.split(',').slice(1).join(',').trim() : ''}
              </p>
              <p className="text-sm tabular-nums">
                {line.quantity} × {formatGhs(line.unitPricePesewas)}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">{formatGhs(lineTotal(line.unitPricePesewas, line.quantity))}</p>
          </div>
          {!locked ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11"
                aria-label={`Decrease ${line.label}`}
                onClick={() => onChangeQuantity(line.id, -1)}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <span className="min-w-11 text-center text-base font-medium tabular-nums">{line.quantity}</span>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11"
                aria-label={`Increase ${line.label}`}
                onClick={() => onChangeQuantity(line.id, 1)}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <div aria-live="polite" className="space-y-1 border-t border-border pt-3 text-sm tabular-nums text-muted-foreground">
        <div className="flex justify-between">
          <span>Net</span>
          <span>{formatGhs(tax.netPesewas)}</span>
        </div>
        <div className="flex justify-between">
          <span>VAT 15%</span>
          <span>{formatGhs(tax.vatPesewas)}</span>
        </div>
        <div className="flex justify-between">
          <span>NHIL 2.5%</span>
          <span>{formatGhs(tax.nhilPesewas)}</span>
        </div>
        <div className="flex justify-between">
          <span>GETFund 2.5%</span>
          <span>{formatGhs(tax.getfundPesewas)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-foreground">
          <span>Total</span>
          <span>{formatGhs(tax.grossPesewas)}</span>
        </div>
      </div>
    </div>
  )
}

export function SellCheckoutPanel({ sellCart }: { sellCart: SellCart }) {
  const role = useStaffRole()
  const online = useOnline()
  const totalsId = useId()
  const [phase, setPhase] = useState<CheckoutPhase>('editing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successTotal, setSuccessTotal] = useState<Pesewas | null>(null)
  const [ringNewOpen, setRingNewOpen] = useState(false)
  const checkoutInFlight = useRef(false)
  const { cart, addLine, changeQuantity, clearCart, mintNewSaleId, markCommitAttempt, setCart } = sellCart

  const locked = phase === 'committing' || phase === 'unconfirmed' || phase === 'network'
  const payDisabled =
    cart.lines.length === 0 || !online || phase === 'committing' || locked || phase === 'success' || phase === 'voided'

  const handleCheckoutResult = useCallback(
    (result: CheckoutResult) => {
      if (result.ok) {
        if (result.status === 'voided') {
          setSuccessTotal(result.totalPesewas)
          setPhase('voided')
          return
        }
        setSuccessTotal(result.totalPesewas)
        setPhase('success')
        return
      }
      if (result.kind === 'unconfirmed') {
        setPhase('unconfirmed')
        setErrorMessage(result.userMessage)
        setCart(result.cart)
        return
      }
      setCart(result.cart)
      if (result.idempotencyReuse) {
        setErrorMessage(result.userMessage)
        setPhase('conflict')
        return
      }
      if (result.code === 'generic') {
        setErrorMessage(result.userMessage)
        setPhase('network')
        return
      }
      setPhase('editing')
      setErrorMessage(result.userMessage)
    },
    [setCart],
  )

  const executeCheckout = useCallback(
    async (activeCart: Cart) => {
      if (!role) return
      markCommitAttempt()
      setPhase('committing')
      setErrorMessage(null)
      const result = await browserCheckoutCart(activeCart, role)
      handleCheckoutResult(result)
    },
    [handleCheckoutResult, markCommitAttempt, role],
  )

  const onPay = useCallback(() => {
    if (!role || payDisabled || checkoutInFlight.current) return
    checkoutInFlight.current = true
    void executeCheckout(cart).finally(() => {
      checkoutInFlight.current = false
    })
  }, [cart, executeCheckout, payDisabled, role])

  const onRetry = useCallback(() => {
    if (!role || checkoutInFlight.current) return
    checkoutInFlight.current = true
    void executeCheckout(cart).finally(() => {
      checkoutInFlight.current = false
    })
  }, [cart, executeCheckout, role])

  const onConfirmNewSale = () => {
    setRingNewOpen(false)
    mintNewSaleId()
    setPhase('editing')
    setErrorMessage(null)
  }

  if (phase === 'success') {
    return (
      <StatusBanner tone="success">
        <p className="text-base font-semibold">Sale recorded</p>
        {successTotal != null ? (
          <p className="mt-1 text-xl font-bold tabular-nums">{formatGhs(successTotal)}</p>
        ) : null}
        <Button
          type="button"
          className="mt-4 min-h-11 w-full"
          onClick={() => {
            clearCart()
            setPhase('editing')
            setSuccessTotal(null)
          }}
        >
          New sale
        </Button>
      </StatusBanner>
    )
  }

  if (phase === 'voided') {
    return (
      <StatusBanner tone="info">
        <p className="text-base font-semibold">Sale already recorded</p>
        <Button
          type="button"
          className="mt-4 min-h-11 w-full"
          onClick={() => {
            clearCart()
            setPhase('editing')
          }}
        >
          New sale
        </Button>
      </StatusBanner>
    )
  }

  return (
    <div className="space-y-4">
      {!online ? (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">
          Offline. Sales need a connection. Showing last saved data.
        </p>
      ) : null}

      <label className="block">
        <span className="sr-only">Search name, SKU or barcode</span>
        <input
          disabled
          placeholder="Search name, SKU or barcode"
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-muted-foreground"
        />
      </label>

      <div className="rounded-lg border border-border bg-card p-4">
        <CartLines cart={cart} locked={locked} onChangeQuantity={changeQuantity} />
      </div>

      <div aria-live="assertive" aria-atomic="true" id={totalsId}>
        {errorMessage && phase !== 'conflict' ? (
          <StatusBanner tone="danger" actions={
            phase === 'unconfirmed' ? (
              <>
                <Button type="button" variant="outline" asChild className="min-h-11">
                  <Link to="/sales">Open Sales</Link>
                </Button>
                <Button type="button" className="min-h-11" onClick={onRetry}>
                  Retry
                </Button>
              </>
            ) : phase === 'network' ? (
              <Button type="button" className="min-h-11" onClick={onRetry}>
                Retry
              </Button>
            ) : null
          }
          >
            {errorMessage}
          </StatusBanner>
        ) : null}

        {phase === 'conflict' && errorMessage ? (
          <StatusBanner
            tone="danger"
            actions={
              <>
                <Button type="button" variant="outline" asChild className="min-h-11">
                  <Link to="/sales">View last sale</Link>
                </Button>
              </>
            }
          >
            {errorMessage}
          </StatusBanner>
        ) : null}
      </div>

      {phase === 'conflict' ? (
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setRingNewOpen(true)}>
          Ring as new sale…
        </Button>
      ) : (
        <Button type="button" className="min-h-11 w-full text-base font-semibold" disabled={payDisabled} onClick={onPay}>
          {phase === 'committing' ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Pay
            </>
          ) : (
            'Pay'
          )}
        </Button>
      )}

      <details className="rounded-lg border border-dashed border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Quick add (demo)</summary>
        <ul className="mt-2 space-y-2">
          {DEMO_VARIANTS.map((variant) => (
            <li key={variant.variantId}>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-11 w-full justify-start py-2 text-left"
                disabled={locked}
                onClick={() =>
                  addLine({
                    variantId: variant.variantId,
                    label: lineLabel(variant.productName, variant.variantLabel),
                    unitPricePesewas: variant.unitPricePesewas,
                  })
                }
              >
                {variant.productName} · {variant.variantLabel} — {formatGhs(variant.unitPricePesewas)}
              </Button>
            </li>
          ))}
        </ul>
      </details>

      <AlertDialog
        open={ringNewOpen}
        title="Ring this as a new sale?"
        description="Only do this if Sales shows no sale for this customer."
        confirmLabel="Ring as new sale"
        onCancel={() => setRingNewOpen(false)}
        onConfirm={onConfirmNewSale}
      />
    </div>
  )
}