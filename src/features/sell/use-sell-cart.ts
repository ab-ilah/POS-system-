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

export const SELL_CART_STORAGE_PREFIX = 'pos-sell-cart:'
const STORAGE_PREFIX = SELL_CART_STORAGE_PREFIX

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
  const sessionKey = session?.userId ?? 'signed-out'
  const [cart, setCart] = useState<Cart>(() => createCart(storeId))
  const [cartHydrated, setCartHydrated] = useState(false)
  const hadCommitAttempt = useRef(false)
  const priorSession = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) return
    setCartHydrated(false)
    if (priorSession.current !== null && priorSession.current !== sessionKey) {
      writeStoredCart(priorSession.current, null)
    }
    priorSession.current = sessionKey
    if (!session) {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key)
      }
      setCart(createCart(storeId))
      hadCommitAttempt.current = false
      setCartHydrated(true)
      return
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX) && key !== storageKey(sessionKey)) {
        localStorage.removeItem(key)
      }
    }
    const stored = readStoredCart(sessionKey, storeId)
    if (stored) setCart(stored)
    else setCart(createCart(storeId))
    setCartHydrated(true)
  }, [ready, session, sessionKey, storeId])

  useEffect(() => {
    if (!ready || !session || !cartHydrated) return
    writeStoredCart(sessionKey, cart)
  }, [cart, cartHydrated, ready, session, sessionKey])

  const replaceCart = useCallback((next: Cart) => {
    setCart(next)
  }, [])

  const updateCart = useCallback((next: Cart | ((previous: Cart) => Cart)) => {
    setCart((previous) => {
      const resolved = typeof next === 'function' ? next(previous) : next
      if (hadCommitAttempt.current) {
        return cartAfterLineEdit(previous, resolved)
      }
      return resolved
    })
  }, [])

  const applyLineEdit = useCallback((edit: (previous: Cart) => Cart) => {
    const mintOnEdit = hadCommitAttempt.current
    setCart((previous) => {
      const resolved = edit(previous)
      return mintOnEdit ? cartAfterLineEdit(previous, resolved) : resolved
    })
    if (mintOnEdit) {
      hadCommitAttempt.current = false
    }
  }, [])

  const addLine = useCallback(
    (input: CartLineInput) => {
      applyLineEdit((previous) => addCartLine(previous, input))
    },
    [applyLineEdit],
  )

  const changeQuantity = useCallback(
    (lineId: string, delta: number) => {
      applyLineEdit((previous) => changeCartLineQuantity(previous, lineId, delta))
    },
    [applyLineEdit],
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
      cartHydrated,
      addLine,
      changeQuantity,
      clearCart,
      mintNewSaleId,
      markCommitAttempt,
      clearCommitAttempt,
      setCart: updateCart,
      replaceCart,
    }),
    [
      addLine,
      cart,
      cartHydrated,
      changeQuantity,
      clearCart,
      clearCommitAttempt,
      markCommitAttempt,
      mintNewSaleId,
      replaceCart,
      updateCart,
    ],
  )
}