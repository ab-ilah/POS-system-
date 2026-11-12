import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RoleGate } from '@/app/RoleGate.tsx'
import { LoginScreen } from '@/features/auth/LoginScreen.tsx'
import { PlaceholderScreen } from '@/features/section/PlaceholderScreen.tsx'
import { SellScreen } from '@/features/sell/SellScreen.tsx'
import { defaultRouteForRole } from '@/lib/route-access.ts'
import { useStaffRole, useStaffSession } from '@/app/use-staff-session.ts'

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
        <Route path="/products" element={gated(<PlaceholderScreen title="Products" />)} />
        <Route path="/stock" element={gated(<PlaceholderScreen title="Stock" />)} />
        <Route path="/day" element={gated(<PlaceholderScreen title="Day" />)} />
        <Route path="/staff" element={gated(<PlaceholderScreen title="Staff" />)} />
        <Route path="/settings" element={gated(<PlaceholderScreen title="Settings" />)} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
