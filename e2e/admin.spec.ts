import { expect, test } from '@playwright/test'
import { acceptDialogs, addOpening, goTo, resetApp, startNewQuote } from './helpers'

test.describe('admin settings', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('saves company details onto the customer preview', async ({ page }) => {
    await startNewQuote(page)
    await addOpening(page, { location: 'Living Room', configCode: 'HDX-L' })

    await goTo(page, 'Admin')
    await expect(page.getByRole('heading', { name: 'Admin settings' })).toBeVisible()

    await page.getByLabel('Name', { exact: true }).fill('Test Screens Pty Ltd')
    await page.getByLabel('ABN').fill('11 222 333 444')
    await page.getByLabel('Validity (days)').fill('14')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByText('Saved on this browser.')).toBeVisible()

    await goTo(page, /^Current Quote/)
    await page.getByRole('button', { name: 'Preview Customer Quote' }).click()
    const dialog = page.getByRole('dialog', { name: 'Preview quote' })
    await expect(dialog.getByAltText('Test Screens Pty Ltd')).toBeVisible()
    await expect(dialog.getByText(/ABN: 11 222 333 444/)).toBeVisible()
    await expect(dialog.getByText('This Quote Valid for 14 Days*')).toBeVisible()
  })

  test('reset restores Goldco defaults', async ({ page }) => {
    acceptDialogs(page)
    await goTo(page, 'Admin')
    await page.getByLabel('Name', { exact: true }).fill('Temporary Name')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await page.getByRole('button', { name: 'Reset defaults' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Goldco Security Group Pty Ltd')
    await expect(page.getByText('Saved on this browser.')).toBeVisible()
  })
})
