import { Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useStaffRole } from '@/app/use-staff-session.ts'
import { visibleRoutesForRole } from '@/lib/route-access.ts'

export function Shell({ children }: { children: ReactNode }) {
  const role = useStaffRole()
  const location = useLocation()
  const navRoutes = role ? visibleRoutesForRole(role) : []

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to={role ? navRoutes[0]?.path ?? '/sell' : '/'} className="inline-flex items-center gap-2 font-semibold">
            <Store className="size-5" aria-hidden="true" />
            Clothing POS
          </Link>
          <nav className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm" aria-label="Main">
            {navRoutes.map((route) => {
              const active = location.pathname === route.path || (route.path === '/sell' && location.pathname === '/')
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  className={active ? 'font-medium underline' : 'hover:underline'}
                  aria-current={active ? 'page' : undefined}
                >
                  {route.label}
                </Link>
              )
            })}
            {!role ? (
              <Link to="/login" className="hover:underline">
                Sign in
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
