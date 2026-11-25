import type { Role } from '@/shared/permissions.matrix.ts'
import { roleFromAppMetadata } from '@/lib/permissions.ts'

const STORAGE_KEY = 'pos-e2e-assist-role'

export function isDevE2eAssistEnabled(env?: { dev?: boolean; assistFlag?: string }): boolean {
  if (env) return env.dev === true && env.assistFlag === 'true'
  return __POS_DEV_E2E_ASSIST__ === true
}

export function readE2eAssistRole(): Role | null {
  if (!isDevE2eAssistEnabled()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return roleFromAppMetadata({ role: raw })
  } catch {
    return null
  }
}

export function writeE2eAssistRole(role: Role): void {
  if (!isDevE2eAssistEnabled()) return
  sessionStorage.setItem(STORAGE_KEY, role)
}

export const E2E_ASSIST_STORAGE_KEY = STORAGE_KEY