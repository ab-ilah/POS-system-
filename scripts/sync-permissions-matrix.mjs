import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REMOTE_URL = 'https://raw.githubusercontent.com/ab-ilah/POS-System-backend/main/shared/permissions.matrix.ts'
const LOCAL_PATH = 'src/shared/permissions.matrix.ts'
const PIN_PATH = 'src/shared/permissions.matrix.sha256'

const VENDOR_HEADER = `/**
 * SYNCED FROM THE BACKEND.
 *
 * Vendored copy of the role matrix. The source of truth is
 * \`shared/permissions.matrix.ts\` in
 * https://github.com/ab-ilah/POS-System-backend
 *
 * Do not change policy in this copy. \`scripts/sync-permissions-matrix.mjs\`
 * diffs it against the backend file once that file exists. The pinned hash in
 * \`permissions.matrix.sha256\` must match this body. Replace this vendored
 * module with a shared package when the backend publishes one.
 * See docs/permissions-sync.md.
 */
`

export function stripVendorHeader(source) {
  return source.replace(/\/\*\*[\s\S]*?SYNCED FROM THE BACKEND[\s\S]*?\*\/\s*/, '')
}

export function normalizeMatrix(source) {
  return `${stripVendorHeader(source).replace(/\r\n/g, '\n').trim()}\n`
}

export function matrixBodyHash(source) {
  return createHash('sha256').update(normalizeMatrix(source), 'utf8').digest('hex')
}

function looksLikeMatrix(body) {
  return body.includes('PERMISSIONS_MATRIX') && body.includes('export const ROLES')
}

export function evaluatePermissionsSync({ localSource, pinnedHash, remote }) {
  const localHash = matrixBodyHash(localSource)
  const hashMatches = localHash === pinnedHash.trim()

  if (remote.status === 404) {
    if (!hashMatches) {
      return {
        state: 'pending',
        exitCode: 1,
        message: `permissions sync: PENDING — backend matrix is not published (HTTP 404), but the vendored hash ${localHash} does not match the pin ${pinnedHash.trim()}.`,
      }
    }
    return {
      state: 'pending',
      exitCode: 0,
      message: `permissions sync: PENDING — backend shared/permissions.matrix.ts is not published (HTTP 404). Vendored hash matches the pin ${localHash}.`,
    }
  }

  if (remote.status !== 200) {
    return {
      state: 'error',
      exitCode: 1,
      message: `permissions sync: failed to fetch backend matrix (HTTP ${remote.status}).`,
    }
  }

  const remoteBody = normalizeMatrix(remote.body ?? '')
  if (!looksLikeMatrix(remoteBody)) {
    return {
      state: 'invalid',
      exitCode: 1,
      message: 'permissions sync: backend response is not a permissions matrix.',
    }
  }

  const localBody = normalizeMatrix(localSource)
  if (localBody !== remoteBody) {
    return {
      state: 'mismatch',
      exitCode: 1,
      message: 'permissions sync: vendored matrix differs from the backend source of truth.',
      localBody,
      remoteBody,
    }
  }

  if (!hashMatches) {
    return {
      state: 'pin-mismatch',
      exitCode: 1,
      message: `permissions sync: vendored file matches the backend but not the pinned hash ${pinnedHash.trim()}.`,
    }
  }

  return {
    state: 'match',
    exitCode: 0,
    message: 'permissions sync: vendored matrix matches the backend and the pinned hash.',
  }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

async function fetchRemote() {
  const response = await fetch(REMOTE_URL, { signal: AbortSignal.timeout(20_000) })
  if (response.status === 404) return { status: 404 }
  const body = await response.text()
  return { status: response.status, body }
}

async function main() {
  const update = process.argv.includes('--update')
  const localSource = await readFile(LOCAL_PATH, 'utf8')
  const pinnedHash = await readFile(PIN_PATH, 'utf8')
  let remote
  try {
    remote = await fetchRemote()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'permissions sync: fetch failed')
    return 1
  }

  if (update && remote.status === 200) {
    const remoteBody = normalizeMatrix(remote.body ?? '')
    if (!looksLikeMatrix(remoteBody)) {
      console.error('permissions sync: backend response is not a permissions matrix.')
      return 1
    }
    const next = `${VENDOR_HEADER}\n${remoteBody}`
    await writeFile(LOCAL_PATH, next, 'utf8')
    await writeFile(PIN_PATH, `${matrixBodyHash(next)}\n`, 'utf8')
    console.log(`permissions sync: wrote ${LOCAL_PATH} and updated the pinned hash`)
    return 0
  }

  const decision = evaluatePermissionsSync({ localSource, pinnedHash, remote })
  if (decision.exitCode === 0) {
    console.log(decision.message)
    return 0
  }
  console.error(decision.message)
  if (decision.localBody && decision.remoteBody) {
    const directory = await mkdtemp(join(tmpdir(), 'pos-matrix-'))
    const localFile = join(directory, 'local.ts')
    const remoteFile = join(directory, 'remote.ts')
    await writeFile(localFile, decision.localBody)
    await writeFile(remoteFile, decision.remoteBody)
    spawnSync('diff', ['-u', localFile, remoteFile], { stdio: 'inherit' })
  }
  return decision.exitCode
}

if (isDirectRun()) {
  const code = await main()
  process.exit(code)
}
