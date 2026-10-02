import { expect, test } from '@playwright/test'
import { fillRoomLocation, resetApp, startNewQuote } from './helpers'

test('door filters reset when switching to windows or clearing filters', async ({ page }) => {
  await resetApp(page)
  await startNewQuote(page)
  await page.getByRole('link', { name: '+ Add Opening' }).click()
  await fillRoomLocation(page, 'Living Room')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pick a configuration' })).toBeVisible()

  const cards = page.locator('.sheet-config-card')
  const windowCard = cards.filter({ has: page.getByRole('heading', { name: 'WS', exact: true }) })
  const hingedCard = cards.filter({ has: page.getByRole('heading', { name: 'HDX-L', exact: true }) })
  const allCount = await cards.count()
  await expect(windowCard).toBeVisible()
  await expect(hingedCard).toBeVisible()

  await page.getByRole('button', { name: 'Filter' }).click()
  const filters = page.getByRole('dialog', { name: 'Configuration filters' })
  await filters.getByRole('button', { name: 'Hinged' }).click()
  await expect(windowCard).toHaveCount(0)
  await expect(hingedCard).toBeVisible()

  await filters.getByRole('button', { name: 'Windows' }).click()
  await expect(windowCard).toBeVisible()
  await expect(hingedCard).toHaveCount(0)
  await expect(filters.getByRole('button', { name: 'Hinged' })).not.toHaveClass(/tab--active/)

  await filters.getByRole('button', { name: 'Clear filters' }).click()
  await expect(cards).toHaveCount(allCount)
  await expect(windowCard).toBeVisible()
  await expect(hingedCard).toBeVisible()
})
