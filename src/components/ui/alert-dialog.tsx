import { type ReactNode, useEffect, useId, useRef } from 'react'
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
  const confirmedRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') {
      if (open && !dialog.open) {
        confirmedRef.current = false
        dialog.showModal()
        queueMicrotask(() => cancelRef.current?.focus())
      } else if (!open && dialog.open) {
        dialog.close()
      }
    } else if (open) {
      queueMicrotask(() => cancelRef.current?.focus())
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        'w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border bg-card p-6 text-foreground shadow-lg backdrop:bg-black/40',
        !open && 'hidden',
        className,
      )}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClose={() => {
        if (!confirmedRef.current) onCancel()
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              confirmedRef.current = true
              onConfirm()
              dialogRef.current?.close()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
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