import { test, expect, resetApp } from './helpers'

test('company settings reject invalid defaults and preserve edits when storage fails', async ({ page }) => {
  await resetApp(page)
  await page.goto('/admin')
  await page.getByLabel('Deposit rate').fill('1.5')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('alert')).toHaveText(/Deposit rate must be between/)
  await page.getByLabel('Deposit rate').fill('0.5')
  await page.getByLabel('Name', { exact: true }).fill('Unsaved company')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'smartquote-pro:company') throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('alert')).toHaveText(/Could not save company settings/)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved company')
  await expect(page.getByText('Saved on this browser.')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Goldco Security Group Pty Ltd')
})

test('settings sync across tabs and an older edited form cannot overwrite a newer save', async ({ page, context }) => {
  await resetApp(page)
  await page.goto('/admin')
  const other = await context.newPage()
  await other.goto('/admin')
  await other.getByLabel('Name', { exact: true }).fill('First update')
  await other.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('First update')
  await page.getByLabel('Name', { exact: true }).fill('My pending edits')
  await other.getByLabel('Name', { exact: true }).fill('Second update')
  await other.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('alert')).toContainText('changed elsewhere')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('My pending edits')
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  await page.getByRole('button', { name: 'Load latest settings' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Second update')
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeEnabled()
})

test('deactivating an account in another tab invalidates its open session', async ({ page, context }) => {
  await resetApp(page)
  await page.goto('/login/staff')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible()
  const other = await context.newPage()
  await other.goto('/')
  await other.evaluate(() => {
    const staff = { id: 'staff', name: 'Sales Staff', email: 'staff@goldco.com.au', password: 'staff', role: 'staff', active: false, createdAt: '2026-01-01T00:00:00.000Z' }
    localStorage.setItem('smartquote-pro:staff', JSON.stringify([staff]))
  })
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to SmartQuote Pro' })).toBeVisible()
})
