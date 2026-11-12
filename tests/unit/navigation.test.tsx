// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { RoleGate } from '../../src/app/RoleGate.tsx'
import { Shell } from '../../src/app/Shell.tsx'
import { StaffSessionTestProvider } from '../../src/app/staff-session.tsx'
import { APP_ROUTES, canAccessRoute, defaultRouteForRole } from '../../src/lib/route-access.ts'
import { ROLES, type Role } from '../../src/shared/permissions.matrix.ts'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function mount(node: ReactNode): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  container.id = 'root'
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return { container, root }
}

function withRole(role: Role, ui: ReactNode) {
  return <StaffSessionTestProvider role={role}>{ui}</StaffSessionTestProvider>
}

function navLabels(container: HTMLElement): string[] {
  const nav = container.querySelector('nav[aria-label="Main"]')
  if (!nav) return []
  return Array.from(nav.querySelectorAll('a'))
    .map((link) => link.textContent?.trim() ?? '')
    .filter((label) => label.length > 0)
}

function screenTitle(container: HTMLElement): string {
  return container.querySelector('h1')?.textContent?.trim() ?? ''
}

describe('role-gated navigation', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  describe.each(ROLES)('role %s', (role) => {
    it('shows only allowed nav items', () => {
      const { container, root } = mount(
        withRole(
          role,
          <MemoryRouter initialEntries={['/sell']}>
            <Shell>
              <h1>Sell</h1>
            </Shell>
          </MemoryRouter>,
        ),
      )

      const expected = APP_ROUTES.filter((route) => canAccessRoute(role, route)).map((route) => route.label)
      expect(navLabels(container)).toEqual(expected)
      root.unmount()
    })

    it('redirects blocked or unknown routes to the role default screen', () => {
      const blocked = APP_ROUTES.find((route) => !canAccessRoute(role, route))
      const initialPath = blocked?.path ?? '/not-a-screen'

      const { container, root } = mount(
        withRole(
          role,
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/sell" element={<RoleGate><h1>Sell</h1></RoleGate>} />
              <Route path="/sales" element={<RoleGate><h1>Sales</h1></RoleGate>} />
              <Route path="/products" element={<RoleGate><h1>Products</h1></RoleGate>} />
              <Route path="/stock" element={<RoleGate><h1>Stock</h1></RoleGate>} />
              <Route path="/day" element={<RoleGate><h1>Day</h1></RoleGate>} />
              <Route path="/staff" element={<RoleGate><h1>Staff</h1></RoleGate>} />
              <Route path="/settings" element={<RoleGate><h1>Settings</h1></RoleGate>} />
              <Route path="*" element={<RoleGate><h1>Unreachable</h1></RoleGate>} />
            </Routes>
          </MemoryRouter>,
        ),
      )

      const defaultLabel =
        APP_ROUTES.find((route) => route.path === defaultRouteForRole(role))?.label ?? 'Sell'
      expect(screenTitle(container)).toBe(defaultLabel)
      if (blocked) {
        expect(screenTitle(container)).not.toBe(blocked.label)
      }
      root.unmount()
    })
  })
})
