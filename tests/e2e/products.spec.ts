import { expect, test } from '@playwright/test'

async function actAs(page: import('@playwright/test').Page, role: 'owner' | 'cashier') {
  await page.goto(`/__e2e/as/${role}`)
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 15_000 })
}

test.describe('products catalogue', () => {
  test('owner sees list and can open edit flow', async ({ page }) => {
    await actAs(page, 'owner')
    await expect(page.getByText('Basic cotton tee')).toBeVisible()
    await expect(page.getByText('Low stock')).toBeVisible()
    await page.getByRole('link', { name: 'Add product' }).click()
    await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible()
    await page.getByLabel('Name').fill('Playwright test shirt')
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByRole('heading', { name: 'Playwright test shirt' })).toBeVisible()
  })

  test('cashier is read-only on products', async ({ page }) => {
    await actAs(page, 'cashier')
    await expect(page.getByText('Basic cotton tee')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add product' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Basic cotton tee' }).click()
    await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  })
})