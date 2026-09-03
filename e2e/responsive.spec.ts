import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow, resetApp, startNewQuote } from './helpers'

const VIEWPORTS = [
  { name: 'iPad landscape (1024px)', width: 1024, height: 768 },
  { name: 'iPad portrait (768px)', width: 768, height: 1024 },
  { name: 'mobile (430px)', width: 430, height: 932 },
  { name: 'small mobile (375px)', width: 375, height: 667 },
]

for (const viewport of VIEWPORTS) {
  test.describe(`no horizontal overflow at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('main quoting flow stays within the viewport', async ({ page }) => {
      await resetApp(page)
      await expectNoHorizontalOverflow(page, 'quotes list')

      await startNewQuote(page)
      await expectNoHorizontalOverflow(page, 'new quote workspace')

      await page.getByRole('link', { name: '+ Add Opening' }).click()
      await expect(page.getByRole('heading', { name: 'Where is this opening?' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'wizard: location step')

      await page.getByLabel('Location').fill('Living Room')
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { name: 'Pick a configuration' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'wizard: configuration step')

      await page.getByRole('button', { name: /^HDX-L\b/ }).click()
      await expect(page.getByRole('heading', { name: 'Measure the opening' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'wizard: measurements step')

      await page.getByLabel('H1', { exact: true }).fill('2100')
      await page.getByLabel('W1', { exact: true }).fill('900')
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { name: 'Product & size' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'wizard: product step')

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { name: 'Add-ons' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'wizard: add-ons step')

      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { name: 'Review & save' })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'wizard: review step')

      const ONE_PX_PNG = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      )
      await page
        .locator('.item-photos-section input[type="file"]')
        .setInputFiles({ name: 'opening.png', mimeType: 'image/png', buffer: ONE_PX_PNG })
      await expect(page.locator('.item-photos-section .room-photo-thumb')).toHaveCount(1)
      await expectNoHorizontalOverflow(page, 'wizard: review step with a photo')

      await page.locator('.item-photos-section .room-photo-thumb').first().click()
      await page.getByRole('button', { name: 'Annotate' }).click()
      await expect(page.locator('.photo-markup-modal canvas')).toBeVisible()
      await expectNoHorizontalOverflow(page, 'photo markup editor')
      await page.getByRole('button', { name: 'Save annotation' }).click()
      await expect(page.getByRole('button', { name: 'Annotate' })).toBeVisible()
      await page.getByRole('button', { name: 'Done' }).click()

      await page.getByRole('button', { name: 'Save Item' }).click()
      await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
      await expectNoHorizontalOverflow(page, 'quote workspace with a saved opening')

      await page.getByRole('button', { name: 'Preview Customer Quote' }).click()
      const dialog = page.getByRole('dialog', { name: 'Preview quote' })
      await expect(dialog).toBeVisible()
      await expectNoHorizontalOverflow(page, 'preview quote modal')
      await dialog.getByRole('button', { name: 'Back' }).click()
      await expect(dialog).toBeHidden()

      await page.getByRole('link', { name: 'All quotes' }).click()
      await expect(page).toHaveURL(/\/quotes$/)
      await expectNoHorizontalOverflow(page, 'quotes list with a saved quote')
    })
  })
}
