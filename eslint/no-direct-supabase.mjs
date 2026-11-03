import fs from 'node:fs'
import path from 'node:path'

const PACKAGE = '@supabase/supabase-js'
const MESSAGE =
  'Import Supabase only inside src/lib/data/supabase.ts. UI and features use the data-access layer.'

function importerPath(context) {
  const name = context.filename ?? context.getFilename?.()
  if (!name || name === '<input>' || name === '<text>') return null
  return path.resolve(name)
}

function resolveLocal(importer, source) {
  if (source.startsWith('@/')) return path.resolve('src', source.slice(2))
  if (source.startsWith('.')) return path.resolve(path.dirname(importer), source)
  return null
}

// Same mapping the TypeScript bundler resolver uses: a `.js` specifier can
// point at the `.ts` source, and an extensionless specifier tries `.ts` first.
function typescriptCandidates(resolvedPath) {
  const extension = path.extname(resolvedPath)
  if (extension === '.js' || extension === '.jsx' || extension === '.mjs' || extension === '.cjs') {
    const base = resolvedPath.slice(0, -extension.length)
    if (extension === '.jsx') return [`${base}.tsx`, `${base}.ts`, `${base}.d.ts`, resolvedPath]
    if (extension === '.mjs') return [`${base}.mts`, `${base}.d.mts`, resolvedPath]
    if (extension === '.cjs') return [`${base}.cts`, `${base}.d.cts`, resolvedPath]
    return [`${base}.ts`, `${base}.tsx`, `${base}.d.ts`, resolvedPath]
  }
  if (extension === '.ts' || extension === '.tsx' || extension === '.mts' || extension === '.cts') {
    return [resolvedPath]
  }
  if (extension === '') {
    return [
      `${resolvedPath}.ts`,
      `${resolvedPath}.tsx`,
      `${resolvedPath}.d.ts`,
      `${resolvedPath}.js`,
      `${resolvedPath}.jsx`,
      path.join(resolvedPath, 'index.ts'),
      path.join(resolvedPath, 'index.tsx'),
      path.join(resolvedPath, 'index.d.ts'),
      path.join(resolvedPath, 'index.js'),
    ]
  }
  return [resolvedPath]
}

function resolveTypeScriptFile(resolvedPath) {
  for (const candidate of typescriptCandidates(resolvedPath)) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // Try the next TypeScript candidate.
    }
  }
  return null
}

function isClientModule(filePath) {
  const normalized = path.normalize(filePath)
  return (
    normalized.endsWith(`${path.sep}src${path.sep}lib${path.sep}data${path.sep}supabase.ts`) ||
    normalized.endsWith(`${path.sep}src${path.sep}lib${path.sep}data${path.sep}supabase.tsx`)
  )
}

function isDataLayerFile(filePath) {
  const normalized = path.normalize(filePath)
  return normalized.includes(`${path.sep}src${path.sep}lib${path.sep}data${path.sep}`)
}

function classify(importer, source) {
  if (source === PACKAGE || source.startsWith(`${PACKAGE}/`)) return 'package'
  const resolved = resolveLocal(importer, source)
  if (!resolved) return null
  const existing = resolveTypeScriptFile(resolved)
  return existing && isClientModule(existing) ? 'client-module' : null
}

function check(context, node, source) {
  if (typeof source !== 'string') return
  const importer = importerPath(context)
  if (!importer || !importer.includes(`${path.sep}src${path.sep}`)) return
  const kind = classify(importer, source)
  if (!kind) return
  if (kind === 'package' && isClientModule(importer)) return
  if (kind === 'client-module' && isDataLayerFile(importer)) return
  context.report({ node, message: MESSAGE })
}

const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep the Supabase client behind the data-access layer, by resolved path.' },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return
        check(context, node, node.source.value)
      },
      ExportAllDeclaration(node) {
        check(context, node, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(context, node, node.source.value)
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') check(context, node, node.source.value)
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments[0]?.type === 'Literal') {
          check(context, node, node.arguments[0].value)
        }
      },
    }
  },
}

export default {
  rules: {
    'no-direct-supabase': rule,
  },
}
