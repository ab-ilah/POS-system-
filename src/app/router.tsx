import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RoleGate } from '@/app/RoleGate.tsx'
import { LoginScreen } from '@/features/auth/LoginScreen.tsx'
import { ProductDetailScreen } from '@/features/products/ProductDetailScreen.tsx'
import { ProductFormScreen } from '@/features/products/ProductFormScreen.tsx'
import { ProductListScreen } from '@/features/products/ProductListScreen.tsx'
import { ProductsScreen } from '@/features/products/ProductsScreen.tsx'
import { PlaceholderScreen } from '@/features/section/PlaceholderScreen.tsx'
import { SellScreen } from '@/features/sell/SellScreen.tsx'
import { defaultRouteForRole } from '@/lib/route-access.ts'
import { useStaffRole, useStaffSession } from '@/app/use-staff-session.ts'

const LazyE2eAssistScreen = __POS_DEV_E2E_ASSIST__
  ? lazy(() => import('@/features/e2e/E2eAssistRoutes.tsx').then((mod) => ({ default: mod.E2eAssistScreen })))
  : null

const LazyE2eRoleSwitchScreen = __POS_DEV_E2E_ASSIST__
  ? lazy(() => import('@/features/e2e/E2eAssistRoutes.tsx').then((mod) => ({ default: mod.E2eRoleSwitchScreen })))
  : null

function RootRedirect() {
  const { ready, session } = useStaffSession()
  const role = useStaffRole()
  if (!ready) return null
  if (!session || !role) return <Navigate to="/login" replace />
  return <Navigate to={defaultRouteForRole(role)} replace />
}

function gated(element: ReactNode) {
  return <RoleGate>{element}</RoleGate>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/sell" element={gated(<SellScreen />)} />
        <Route path="/sales" element={gated(<PlaceholderScreen title="Sales" />)} />
        <Route
          path="/products"
          element={gated(
            <ProductsScreen>
              <ProductListScreen />
            </ProductsScreen>,
          )}
        />
        <Route
          path="/products/new"
          element={gated(
            <ProductsScreen>
              <ProductFormScreen mode="create" />
            </ProductsScreen>,
          )}
        />
        <Route
          path="/products/:productId/edit"
          element={gated(
            <ProductsScreen>
              <ProductFormScreen mode="edit" />
            </ProductsScreen>,
          )}
        />
        <Route
          path="/products/:productId"
          element={gated(
            <ProductsScreen>
              <ProductDetailScreen />
            </ProductsScreen>,
          )}
        />
        {LazyE2eAssistScreen ? (
          <Route
            path="/__e2e/assist"
            element={
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading assist…</p>}>
                <LazyE2eAssistScreen />
              </Suspense>
            }
          />
        ) : null}
        {LazyE2eRoleSwitchScreen ? (
          <Route
            path="/__e2e/as/:role"
            element={
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading assist…</p>}>
                <LazyE2eRoleSwitchScreen />
              </Suspense>
            }
          />
        ) : null}
        <Route path="/stock" element={gated(<PlaceholderScreen title="Stock" />)} />
        <Route path="/day" element={gated(<PlaceholderScreen title="Day" />)} />
        <Route path="/staff" element={gated(<PlaceholderScreen title="Staff" />)} />
        <Route path="/settings" element={gated(<PlaceholderScreen title="Settings" />)} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}