import { expect, test } from '@playwright/test'

test('boots and renders sign-in', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#root')).toBeVisible()
  await expect.poll(async () => (await page.locator('#root').innerText()).trim().length).toBeGreaterThan(0)

  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
