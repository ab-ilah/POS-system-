// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { AlertDialog } from '../../src/components/ui/alert-dialog.tsx'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('AlertDialog accessibility', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('exposes alertdialog name and description via labelled elements', async () => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.open = true
      }
    }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <AlertDialog
          open
          title="Ring this as a new sale?"
          description="Only do this if Sales shows no sale for this customer."
          confirmLabel="Ring as new sale"
          onCancel={() => {}}
          onConfirm={() => {}}
        />,
      )
    })

    const dialog = container.querySelector('[role="alertdialog"]')
    expect(dialog).toBeTruthy()
    const titleId = dialog?.getAttribute('aria-labelledby')
    const descriptionId = dialog?.getAttribute('aria-describedby')
    expect(container.querySelector(`#${titleId}`)?.textContent).toBe('Ring this as a new sale?')
    expect(container.querySelector(`#${descriptionId}`)?.textContent).toContain('Only do this if Sales')
    root.unmount()
  })
})