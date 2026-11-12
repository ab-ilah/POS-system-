export { browserAuthGateway, signIn, visibleSignInMessage, type SignInResult } from './auth.ts'
export { browserSessionReader, type SessionReader, type StaffSession } from './session.ts'
export { createRowStore } from './row-store.ts'
export { CommitSaleRpcError, isCommitSaleRpcError, type CommitSaleRpcErrorFields } from './commit-sale-rpc-error.ts'
export { prepareSale, commitSale, type CommitSaleClient, type SaleCommand, type SaleInput } from './sales.ts'
export { createCommitSaleClient, isSupabaseConfigured } from './supabase.ts'
export { checkoutCart, type CheckoutFailure, type CheckoutResult, type CheckoutSuccess } from '../checkout.ts'
export { mapCommitSaleFailure, type CommitSaleFailureCode, type MappedCommitSaleFailure } from '../commit-sale-errors.ts'
export {
  cloneCart,
  regenerateCartLineIds,
  regenerateCartSaleId,
  type Cart,
  type CartLine,
} from '../cart.ts'
export { browserCheckoutCart } from './checkout-gateway.ts'
export type { AuthGateway, RowStore } from './types.ts'
