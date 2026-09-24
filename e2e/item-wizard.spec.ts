import { expect, test } from '@playwright/test'
import { addOpening, openLocationAndConfig, resetApp, startNewQuote } from './helpers'

// A minimal 1x1 transparent PNG, small enough to embed inline without a fixture file on disk.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

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

  test('records door lock details and bowed condition through review and edit', async ({ page }) => {
    await page.getByRole('link', { name: '+ Add Opening' }).click()
    await page.getByLabel('Location').fill('Front door')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /^HDX-L\b/ }).click()
    await expect(page.getByLabel('H3', { exact: true })).toHaveCount(0)
    await page.getByLabel('H1', { exact: true }).fill('2100')
    await page.getByLabel('W1', { exact: true }).fill('900')
    await page.getByLabel('Lock height (mm)').fill('950')
    await expect(page.getByLabel('Lock side')).toHaveValue('left')
    await page.getByLabel('Centre tongue').check()
    await page.getByLabel('Door is bowed').check()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('950 mm')).toBeVisible()
    await expect(page.getByText('Door bowed')).toBeVisible()
    await page.getByRole('button', { name: 'Save Item' }).click()
    await expect(page.locator('.quote-item-card').getByText(/Lock height: 950 mm.*Door bowed/)).toBeVisible()
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByText('950 mm')).toBeVisible()
    await expect(page.getByText('Door bowed')).toBeVisible()
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

  test('attaches and annotates a photo, then reloads it on edit', async ({ page }) => {
    await openLocationAndConfig(page, { location: 'Living Room', configCode: 'HDX-L' })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Add-ons' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByRole('heading', { name: 'Review & save' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Photos / Markup' })).toBeVisible()

    const fileInput = page.locator('.item-photos-section input[type="file"]')
    await fileInput.setInputFiles({ name: 'opening.png', mimeType: 'image/png', buffer: ONE_PX_PNG })

    const thumbnails = page.locator('.item-photos-section .room-photo-thumb')
    await expect(thumbnails).toHaveCount(1)

    await thumbnails.first().click()
    await page.getByRole('button', { name: 'Annotate' }).click()

    const canvas = page.locator('.photo-markup-modal canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('markup canvas did not render')
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 5 })
    await page.mouse.up()

    await page.getByRole('button', { name: 'Save annotation' }).click()
    await expect(page.getByRole('button', { name: 'Annotate' })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('button', { name: 'Save Item' }).click()
    await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()

    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Review & save' })).toBeVisible()
    await expect(page.locator('.item-photos-section .room-photo-thumb')).toHaveCount(1)

    await page.locator('.item-photos-section .room-photo-thumb').first().click()
    await page.getByRole('button', { name: 'Annotate' }).click()
    await expect(page.locator('.photo-markup-modal canvas')).toBeVisible()

    // The stroke drawn and saved earlier reloads into the editor: Clear starts enabled (there is
    // something to clear) while Undo starts disabled (no new action has been taken yet this session).
    await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
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

test.describe('duplicate and reuse location behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
    await addOpening(page, { location: 'Bedroom 1', configCode: 'HDX-L' })
  })

  test('duplicate pre-fills the original location, ready to save as-is or change', async ({ page }) => {
    await page.getByRole('link', { name: 'Duplicate' }).click()

    await expect(page.getByRole('heading', { name: 'Review & save' })).toBeVisible()
    await expect(page.getByText('Bedroom 1', { exact: true })).toBeVisible()
  })

  test('reuse shows the original location and requires a fresh confirmation', async ({ page }) => {
    await page.getByRole('link', { name: 'Reuse' }).click()

    await expect(page.getByRole('heading', { name: 'Where is this opening?' })).toBeVisible()
    await expect(page.getByText('Original location:')).toBeVisible()
    await expect(page.getByText('Bedroom 1', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await page.getByLabel('Use at').fill('Bedroom 2')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Pick a configuration' })).toBeVisible()
  })

  test('a custom location becomes reusable and groups with future items in it', async ({ page }) => {
    await addOpening(page, { location: 'Study', configCode: 'WS', product: 'Fly Screens' })
    await addOpening(page, { location: 'Study', configCode: 'HDX-L' })

    const studyGroup = page.locator('.quote-room-group', { hasText: 'Study' })
    await expect(studyGroup.locator('.quote-item-card')).toHaveCount(2)

    await page.getByRole('link', { name: '+ Add Opening' }).click()
    await expect(page.getByRole('button', { name: 'Study', exact: true })).toBeVisible()
  })
})
