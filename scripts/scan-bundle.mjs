import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import { join } from 'node:path'

export function scanText(text, options = {}, file = '<text>') {
  const findings = []
  if (text.includes('service_role')) {
    findings.push({ file, reason: 'found service_role claim' })
  }
  // A real key continues past the prefix. @supabase/supabase-js ships the bare
  // prefix in startsWith("sb_secret_") and that check is not a credential.
  if (/sb_secret_[A-Za-z0-9_-]+/.test(text)) {
    findings.push({ file, reason: 'found sb_secret_ key material' })
  }

  const jwtPattern = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
  for (const token of text.match(jwtPattern) ?? []) {
    const classified = classifyJwt(token)
    if (!classified) continue
    if (classified.role !== 'anon') {
      findings.push({ file, reason: `JWT role is "${classified.role ?? 'missing'}", not anon` })
    }
  }

  const forbiddenSecret = options.forbiddenSecret ?? ''
  if (forbiddenSecret && text.includes(forbiddenSecret)) {
    findings.push({ file, reason: 'found configured forbidden secret' })
  }

  return findings
}

function classifyJwt(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = decodeJson(parts[0])
  const payload = decodeJson(parts[1])
  if (!isRecord(header) || !isRecord(payload)) return null
  if (!('alg' in header) && !('typ' in header)) return null
  const role = typeof payload.role === 'string' ? payload.role : null
  return { role }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeJson(segment) {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf8'))
  } catch {
    return undefined
  }
}

export async function scanDirectory(directory, options = {}) {
  let info
  try {
    info = await stat(directory)
  } catch {
    throw new Error(`Bundle directory does not exist: ${directory}`)
  }
  if (!info.isDirectory()) {
    throw new Error(`Bundle directory does not exist: ${directory}`)
  }

  const findings = []
  for (const file of await walk(directory)) {
    const text = await readFile(file)
    findings.push(...scanText(text.toString('utf8'), options, file))
  }
  return findings
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return walk(path)
      if (entry.isFile()) return [path]
      return []
    }),
  )
  return nested.flat()
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

async function main() {
  const directory = process.argv[2] ?? 'dist'
  const forbiddenSecret = process.env.BUNDLE_SCAN_FORBIDDEN_SECRET ?? ''
  if (forbiddenSecret) {
    console.log('bundle scan: exact secret match enabled')
  } else {
    console.log('bundle scan: exact secret match skipped')
  }
  const findings = await scanDirectory(directory, { forbiddenSecret })
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}: ${finding.reason}`)
    }
    return 1
  }
  console.log(`bundle scan: no service_role, sb_secret_, or non-anon JWT in ${directory}`)
  return 0
}

if (isDirectRun()) {
  const code = await main()
  process.exit(code)
}
