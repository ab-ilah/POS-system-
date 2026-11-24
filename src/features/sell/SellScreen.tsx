import { Link, useLocation } from 'react-router-dom'
import { Shell } from '@/app/Shell.tsx'
import { useStaffRole } from '@/app/use-staff-session.ts'
import { visibleRoutesForRole } from '@/lib/route-access.ts'
import { SellCheckoutPanel } from '@/features/sell/sell-checkout.tsx'
import { useSellCart } from '@/features/sell/use-sell-cart.ts'
import { cn } from '@/lib/utils.ts'

function CashierBottomNav() {
  const role = useStaffRole()
  const location = useLocation()
  if (!role) return null
  const routes = visibleRoutesForRole(role).filter((route) => route.label === 'Sell' || route.label === 'Sales')
  if (routes.length === 0) return null
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card lg:hidden"
      aria-label="Cashier"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${routes.length}, 1fr)` }}>
        {routes.map((route) => {
          const active = location.pathname === route.path
          return (
            <Link
              key={route.path}
              to={route.path}
              className={cn(
                'flex min-h-14 items-center justify-center text-sm',
                active ? 'font-bold text-primary' : 'text-muted-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {route.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function SellScreen() {
  const role = useStaffRole()
  const sellCart = useSellCart()
  const displayRole = role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : 'Staff'

  return (
    <Shell>
      <div className="mx-auto w-full max-w-md space-y-4 pb-20 lg:max-w-none lg:pb-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sell</h1>
          <p className="text-sm text-muted-foreground">{displayRole}</p>
        </div>
        <div className="lg:grid lg:grid-cols-[1fr_minmax(280px,360px)] lg:gap-8 lg:items-start">
          <p className="text-sm text-muted-foreground lg:py-8">Product grid (out of scope for this ticket).</p>
          <aside className="lg:sticky lg:top-4">
            <SellCheckoutPanel sellCart={sellCart} />
          </aside>
        </div>
      </div>
      <CashierBottomNav />
    </Shell>
  )
}