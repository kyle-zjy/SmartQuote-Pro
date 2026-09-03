import { expect, test } from '@playwright/test'
import { acceptDialogs, resetApp } from './helpers'

test.describe('admin settings', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('saves company details onto the quote paper', async ({ page }) => {
    await page.getByRole('link', { name: 'Admin' }).click()
    await expect(page.getByRole('heading', { name: 'Admin settings' })).toBeVisible()

    await page.getByLabel('Name', { exact: true }).fill('Test Screens Pty Ltd')
    await page.getByLabel('ABN').fill('11 222 333 444')
    await page.getByLabel('Validity (days)').fill('14')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByText('Saved on this browser.')).toBeVisible()

    await page.getByRole('link', { name: 'Quote', exact: true }).click()
    await expect(page.getByAltText('Test Screens Pty Ltd')).toBeVisible()
    await expect(page.getByText(/ABN: 11 222 333 444/)).toBeVisible()
    await expect(page.getByText('This Quote Valid for 14 Days*')).toBeVisible()
  })

  test('reset restores Goldco defaults', async ({ page }) => {
    acceptDialogs(page)
    await page.getByRole('link', { name: 'Admin' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Temporary Name')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await page.getByRole('button', { name: 'Reset defaults' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Goldco Security Group Pty Ltd')
    await expect(page.getByText('Saved on this browser.')).toBeVisible()
  })
})
