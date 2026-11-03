export function stripVendorHeader(source: string): string
export function normalizeMatrix(source: string): string
export function matrixBodyHash(source: string): string

export type SyncRemote = { status: 404 } | { status: number; body?: string }

export type SyncDecision = {
  state: string
  exitCode: number
  message: string
  localBody?: string
  remoteBody?: string
}

export function evaluatePermissionsSync(input: {
  localSource: string
  pinnedHash: string
  remote: SyncRemote
}): SyncDecision
