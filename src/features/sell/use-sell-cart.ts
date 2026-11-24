import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStaffSession } from '@/app/use-staff-session.ts'
import {
  addCartLine,
  cartAfterLineEdit,
  changeCartLineQuantity,
  createCart,
  regenerateCartSaleId,
  type Cart,
  type CartLineInput,
} from '@/lib/cart.ts'

const STORAGE_PREFIX = 'pos-sell-cart:'

function storageKey(sessionKey: string): string {
  return `${STORAGE_PREFIX}${sessionKey}`
}

function readStoredCart(sessionKey: string, storeId: string): Cart | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cart
    if (!parsed || typeof parsed.id !== 'string' || parsed.storeId !== storeId || !Array.isArray(parsed.lines)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredCart(sessionKey: string, cart: Cart | null): void {
  if (!cart || cart.lines.length === 0) {
    localStorage.removeItem(storageKey(sessionKey))
    return
  }
  localStorage.setItem(storageKey(sessionKey), JSON.stringify(cart))
}

export const DEFAULT_STORE_ID = 'demo-store-1'

export function useSellCart(storeId: string = DEFAULT_STORE_ID) {
  const { ready, session } = useStaffSession()
  const sessionKey = session?.role ?? 'signed-out'
  const [cart, setCart] = useState<Cart>(() => createCart(storeId))
  const hadCommitAttempt = useRef(false)
  const priorSession = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (priorSession.current !== null && priorSession.current !== sessionKey) {
      setCart(createCart(storeId))
      hadCommitAttempt.current = false
      writeStoredCart(priorSession.current, null)
    }
    priorSession.current = sessionKey
    if (!session) {
      setCart(createCart(storeId))
      hadCommitAttempt.current = false
      return
    }
    const stored = readStoredCart(sessionKey, storeId)
    if (stored) setCart(stored)
    else setCart(createCart(storeId))
  }, [ready, session, sessionKey, storeId])

  useEffect(() => {
    if (!ready || !session) return
    writeStoredCart(sessionKey, cart)
  }, [cart, ready, session, sessionKey])

  const updateCart = useCallback(
    (next: Cart | ((previous: Cart) => Cart)) => {
      setCart((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next
        if (hadCommitAttempt.current) {
          return cartAfterLineEdit(previous, resolved)
        }
        return resolved
      })
    },
    [],
  )

  const addLine = useCallback(
    (input: CartLineInput) => {
      hadCommitAttempt.current = false
      updateCart((previous) => {
        const withLine = addCartLine(previous, input)
        if (previous.lines.length === 0 && withLine.lines.length === 1) {
          return withLine
        }
        return withLine
      })
    },
    [updateCart],
  )

  const changeQuantity = useCallback(
    (lineId: string, delta: number) => {
      updateCart((previous) => changeCartLineQuantity(previous, lineId, delta))
    },
    [updateCart],
  )

  const clearCart = useCallback(() => {
    hadCommitAttempt.current = false
    setCart(createCart(storeId))
  }, [storeId])

  const mintNewSaleId = useCallback(() => {
    setCart((previous) => regenerateCartSaleId(previous))
    hadCommitAttempt.current = false
  }, [])

  const markCommitAttempt = useCallback(() => {
    hadCommitAttempt.current = true
  }, [])

  const clearCommitAttempt = useCallback(() => {
    hadCommitAttempt.current = false
  }, [])

  return useMemo(
    () => ({
      cart,
      addLine,
      changeQuantity,
      clearCart,
      mintNewSaleId,
      markCommitAttempt,
      clearCommitAttempt,
      setCart: updateCart,
    }),
    [addLine, cart, changeQuantity, clearCart, clearCommitAttempt, markCommitAttempt, mintNewSaleId, updateCart],
  )
}