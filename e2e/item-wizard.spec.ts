import { expect, test } from '@playwright/test'
import { addOpening, openLocationAndConfig, resetApp, startNewQuote } from './helpers'

test.describe('item wizard', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
  })

  test('Product step lists every product from the bundled price list', async ({ page }) => {
    await openLocationAndConfig(page, { configCode: 'HDX-L' })

    for (const name of ['Supascreen', 'IntrudaGuard', '7mm Diamond', 'Fly Screens']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
    // HDX-L is a hinged door, so the wizard should default to a product/category offering doors.
    await expect(page.getByRole('button', { name: 'Supascreen', exact: true })).toHaveClass(/tab--active/)
    await expect(page.getByRole('button', { name: 'Doors', exact: true })).toHaveClass(/tab--active/)
  })

  test('prices a size at the next matrix bracket, adds add-ons, saves the opening, and merges an identical repeat', async ({
    page,
  }) => {
    const opening = {
      location: 'Living Room',
      configCode: 'HDX-L',
      measurements: { H1: '2100', W1: '900' },
      addons: ['PET DOOR - SMALL', 'BOX-OUTS'],
      addonPrices: { 'BOX-OUTS': '75' },
      note: 'Site measure pending',
    }

    await openLocationAndConfig(page, opening)
    // 900mm rounds up to the 925mm bracket for Supascreen doors.
    await expect(page.getByText('Priced at 925 x 2100 mm bracket')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByRole('heading', { name: 'Add-ons' })).toBeVisible()
    for (const name of opening.addons) {
      const row = page.getByRole('row', { name: new RegExp(name) })
      const price = (opening.addonPrices as Record<string, string>)[name]
      if (price) await row.getByPlaceholder('Enter price').fill(price)
      await row.getByRole('checkbox').check()
    }
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByRole('heading', { name: 'Review & save' })).toBeVisible()
    await page.getByLabel('Additional notes').fill(opening.note)
    await page.getByRole('button', { name: 'Save Item' }).click()

    await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
    const card = page.locator('.quote-item-card')
    await expect(card).toHaveCount(1)
    await expect(card.getByText('Living Room — Supascreen')).toBeVisible()
    await expect(card.getByText(/900 × 2100 mm/)).toBeVisible()
    await expect(card.getByText(/Add-ons: PET DOOR - SMALL, BOX-OUTS/)).toBeVisible()
    await expect(card.getByText('Note: Site measure pending')).toBeVisible()

    // Adding an identical opening again should bump quantity instead of duplicating the row.
    await addOpening(page, opening)
    await expect(page.locator('.quote-item-card')).toHaveCount(1)
    await expect(page.getByLabel('Qty')).toHaveValue('2')
  })

  test('rejects sizes larger than the matrix', async ({ page }) => {
    await openLocationAndConfig(page, { configCode: 'HDX-L' })
    await page.getByLabel('Height (mm)').fill('3000')
    await page.getByLabel('Width (mm)').fill('900')
    await expect(page.getByText(/larger than the maximum we can auto-quote/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  test('Fly Screens can add a double-hung surcharge on a window opening', async ({ page }) => {
    await addOpening(page, {
      location: 'Rumpus Room',
      configCode: 'WS',
      measurements: { H1: '1500', W1: '1200' },
      product: 'Fly Screens',
      doubleHung: true,
    })

    await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
    const card = page.locator('.quote-item-card')
    await expect(card).toHaveCount(1)
    await expect(card.getByText('Rumpus Room — Fly Screens')).toBeVisible()
  })
})
