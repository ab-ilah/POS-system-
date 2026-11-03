// @vitest-environment jsdom
import { act, type ReactNode } from 'react'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '../../src/app/AppErrorBoundary.tsx'
import { GlobalErrorReporter } from '../../src/app/GlobalErrorReporter.tsx'

function ThrowOnRender(): never {
  throw new Error('render failed')
}

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

describe('AppErrorBoundary', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('shows an alert instead of leaving #root blank when render throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container, root } = mount(
      <AppErrorBoundary>
        <ThrowOnRender />
      </AppErrorBoundary>,
    )
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('render failed')
    expect(container.textContent?.trim().length).toBeGreaterThan(0)
    root.unmount()
    spy.mockRestore()
  })
})

describe('global error handlers', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('surfaces window error and unhandledrejection in an alert', async () => {
    const { container, root } = mount(<GlobalErrorReporter />)
    await act(async () => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'window boom', error: new Error('window boom') }))
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('window boom')

    await act(async () => {
      const rejection = new Event('unhandledrejection')
      Object.defineProperty(rejection, 'reason', { value: new Error('rejected sale') })
      window.dispatchEvent(rejection)
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('rejected sale')
    root.unmount()
  })
})
