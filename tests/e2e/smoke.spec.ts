import { expect, test } from '@playwright/test'

test('shows the register and the sign-in form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible()
  await expect(page.getByText('GHS 189.00', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
