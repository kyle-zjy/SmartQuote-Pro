import { expect, test } from '@playwright/test'
import { resetApp } from './helpers'

test.describe('product calculator', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('lists product lines from the bundled price list', async ({ page }) => {
    await expect(page.getByText('Using the built-in default price list.')).toBeVisible()
    for (const name of ['Supascreen', 'IntrudaGuard', '7mm Diamond', 'Fly Screens']) {
      await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
    }
  })

  test('prices a size at the next matrix bracket and adds it to the quote', async ({ page }) => {
    await page.getByRole('link', { name: /Supascreen/ }).click()
    await expect(page.getByRole('heading', { name: 'Supascreen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Windows' })).toHaveClass(/tab--active/)

    await page.getByLabel('Height (mm)').fill('1100')
    await page.getByLabel('Width (mm)').fill('800')
    await expect(page.getByText('Priced at 900 x 1200 mm bracket')).toBeVisible()

    const price = page.locator('.price-result__amount')
    await expect(price).toHaveText(/\$[\d,]+/)

    await page.getByLabel('Room').selectOption('Kitchen')
    await page.getByLabel('Notes (optional)').fill('Site measure pending')
    await page.getByRole('button', { name: 'Add to quote' }).click()
    await expect(page.getByText('Added to your quote.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Quote \(1\)/ })).toBeVisible()

    await page.getByRole('link', { name: /Quote \(1\)/ }).click()
    await expect(page.locator('.desc-input')).toHaveValue(/Supascreen window screen \*Kitchen/)
    await expect(page.getByText('Note: Site measure pending')).toBeVisible()
  })

  test('rejects sizes larger than the matrix', async ({ page }) => {
    await page.getByRole('link', { name: /Supascreen/ }).click()
    await page.getByLabel('Height (mm)').fill('3000')
    await page.getByLabel('Width (mm)').fill('900')
    await expect(page.getByText(/larger than the maximum we can auto-quote/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to quote' })).toHaveCount(0)
  })

  test('Fly Screens can add a double-hung surcharge', async ({ page }) => {
    await page.getByRole('link', { name: /Fly Screens/ }).click()
    await expect(page.getByRole('heading', { name: 'Fly Screens' })).toBeVisible()
    await page.getByLabel('Height (mm)').fill('1500')
    await page.getByLabel('Width (mm)').fill('1200')
    await page.getByLabel('Double hung window').check()
    await expect(page.getByText(/includes \$15\.00 extras/)).toBeVisible()
    await page.getByRole('button', { name: 'Add to quote' }).click()
    await expect(page.getByText('Added to your quote.')).toBeVisible()

    await page.getByRole('link', { name: /Quote \(1\)/ }).click()
    await expect(page.locator('.desc-input')).toHaveValue(/with double hung/)
  })
})
