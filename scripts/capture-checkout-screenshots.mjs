import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const artifactDir = '/opt/cursor/artifacts'
const port = 4173
const baseUrl = `http://127.0.0.1:${port}`

const cart = {
  id: 'screenshot-sale-1',
  storeId: 'demo-store-1',
  lines: [
    {
      id: 'line-1',
      variantId: 'demo-tee-m-white',
      label: 'Basic cotton tee, M · White',
      quantity: 2,
      unitPricePesewas: 4550,
    },
    {
      id: 'line-2',
      variantId: 'demo-linen-l-navy',
      label: 'Linen shirt, L · Navy',
      quantity: 1,
      unitPricePesewas: 8999,
    },
  ],
}

async function startPreview() {
  const child = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  })
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return () => child.kill('SIGTERM')
}

async function seedCart(page) {
  await page.addInitScript((value) => {
    localStorage.setItem('pos-sell-cart:cashier', value)
  }, JSON.stringify(cart))
}

async function payWithMock(page, outcome) {
  await page.evaluate((kind) => {
    const original = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.includes('/rest/v1/rpc/commit_sale')) {
        if (kind === 'success') {
          return new Response(
            JSON.stringify({
              sale_id: 'screenshot-sale-1',
              replayed: false,
              status: 'completed',
              total_pesewas: 18099,
            }),
            { status: 200 },
          )
        }
        if (kind === 'unconfirmed') {
          return new Response(
            JSON.stringify({
              sale_id: 'screenshot-sale-1',
              replayed: false,
              total_pesewas: 18099,
            }),
            { status: 200 },
          )
        }
        if (kind === 'conflict') {
          return new Response(
            JSON.stringify({
              code: 'P0004',
              message: 'idempotency_key_reuse',
            }),
            { status: 400 },
          )
        }
        return new Response(JSON.stringify({ message: 'network' }), { status: 500 })
      }
      return original(input, init)
    }
  }, outcome)
}

async function main() {
  await mkdir(artifactDir, { recursive: true })
  const stop = await startPreview()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  try {
    await seedCart(page)
    await page.goto(`${baseUrl}/sell`)
    await page.getByRole('heading', { name: 'Sell' }).waitFor()
    await page.screenshot({ path: `${artifactDir}/checkout-cart-mobile.png`, fullPage: true })

    for (const [name, outcome, extra] of [
      ['checkout-success-mobile', 'success', async (p) => p.getByRole('button', { name: 'New sale' }).waitFor()],
      ['checkout-unconfirmed-mobile', 'unconfirmed', async (p) => p.getByRole('button', { name: 'Retry' }).waitFor()],
      ['checkout-conflict-mobile', 'conflict', async (p) => p.getByRole('button', { name: /Ring as new sale/ }).waitFor()],
      ['checkout-network-error-mobile', 'network', async (p) => p.getByRole('button', { name: 'Retry' }).waitFor()],
    ]) {
      await seedCart(page)
      await page.goto(`${baseUrl}/sell`)
      await payWithMock(page, outcome)
      await page.getByRole('button', { name: 'Pay' }).click()
      await extra(page)
      if (name === 'checkout-conflict-mobile') {
        await page.getByRole('button', { name: /Ring as new sale/ }).click()
        await page.getByRole('heading', { name: 'Ring this as a new sale?' }).waitFor()
        await page.screenshot({ path: `${artifactDir}/checkout-p0004-dialog-mobile.png`, fullPage: true })
      }
      await page.screenshot({ path: `${artifactDir}/${name}.png`, fullPage: true })
    }
  } finally {
    await browser.close()
    stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})