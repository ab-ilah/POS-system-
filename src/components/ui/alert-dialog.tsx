import { type ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { cn } from '@/lib/utils.ts'

type AlertDialogProps = {
  open: boolean
  title: string
  description: string
  cancelLabel?: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  className?: string
}

function supportsDialogModal(element: HTMLDialogElement): boolean {
  return typeof element.showModal === 'function'
}

export function AlertDialog({
  open,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  onCancel,
  onConfirm,
  className,
}: AlertDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const useNativeModal = typeof HTMLDialogElement !== 'undefined'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !useNativeModal) return
    if (!supportsDialogModal(dialog)) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, useNativeModal])

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  if (!open) return null

  const panel = (
    <div
      className={cn(
        'w-full max-w-sm rounded-lg border border-border bg-card p-6 text-foreground shadow-lg',
        className,
      )}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 id="alert-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <p id="alert-dialog-description" className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {useNativeModal ? (
        <dialog ref={dialogRef} open={open} className="border-0 bg-transparent p-0">
          {panel}
        </dialog>
      ) : (
        panel
      )}
    </div>
  )
}

export function StatusBanner({
  tone,
  children,
  actions,
}: {
  tone: 'danger' | 'success' | 'info'
  children: ReactNode
  actions?: ReactNode
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-border bg-card text-foreground'
  return (
    <div className={cn('rounded-lg border p-4 text-sm', toneClass)} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
