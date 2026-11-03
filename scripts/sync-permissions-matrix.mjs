import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REMOTE_URL = 'https://raw.githubusercontent.com/ab-ilah/POS-System-backend/main/shared/permissions.matrix.ts'
const LOCAL_PATH = 'src/shared/permissions.matrix.ts'

const VENDOR_HEADER = `/**
 * SYNCED FROM THE BACKEND.
 *
 * Vendored copy of the role matrix. The source of truth is
 * \`shared/permissions.matrix.ts\` in
 * https://github.com/ab-ilah/POS-System-backend
 *
 * Do not change policy in this copy. \`scripts/sync-permissions-matrix.mjs\`
 * diffs it against the backend file once that file exists. Replace this
 * vendored module with a shared package when the backend publishes one.
 * See docs/permissions-sync.md.
 */
`

export function stripVendorHeader(source) {
  return source.replace(/\/\*\*[\s\S]*?SYNCED FROM THE BACKEND[\s\S]*?\*\/\s*/, '')
}

export function normalizeMatrix(source) {
  return `${stripVendorHeader(source).replace(/\r\n/g, '\n').trim()}\n`
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
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`permissions sync: failed to fetch backend matrix (${response.status})`)
  }
  const text = await response.text()
  if (text.includes('404: Not Found')) return null
  return text
}

async function main() {
  const update = process.argv.includes('--update')
  let remote
  try {
    remote = await fetchRemote()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'permissions sync: fetch failed')
    return 1
  }

  if (remote === null) {
    console.log(
      'permissions sync stub: backend file is not published yet. Vendored copy remains. See docs/permissions-sync.md',
    )
    return 0
  }

  const remoteBody = normalizeMatrix(remote)
  if (update) {
    await writeFile(LOCAL_PATH, `${VENDOR_HEADER}\n${remoteBody}`, 'utf8')
    console.log(`permissions sync: wrote ${LOCAL_PATH} from the backend`)
    return 0
  }

  const localBody = normalizeMatrix(await readFile(LOCAL_PATH, 'utf8'))
  if (localBody === remoteBody) {
    console.log('permissions sync: vendored matrix matches the backend')
    return 0
  }

  console.error('permissions sync: vendored matrix differs from the backend source of truth')
  const directory = await mkdtemp(join(tmpdir(), 'pos-matrix-'))
  const localFile = join(directory, 'local.ts')
  const remoteFile = join(directory, 'remote.ts')
  await writeFile(localFile, localBody)
  await writeFile(remoteFile, remoteBody)
  spawnSync('diff', ['-u', localFile, remoteFile], { stdio: 'inherit' })
  return 1
}

if (isDirectRun()) {
  const code = await main()
  process.exit(code)
}
