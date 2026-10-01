import { expect, test } from '@playwright/test'
import { fillRoomLocation, resetApp, startNewQuote } from './helpers'

test('door operation filters do not leak into All types or Windows', async ({ page }) => {
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
  await expect(page.getByRole('button', { name: 'Any operation', exact: true })).toHaveCount(0)

  for (const operation of ['Hinged', 'Sliding']) {
    await page.getByRole('button', { name: 'Doors', exact: true }).click()
    await page.getByRole('button', { name: operation, exact: true }).click()
    await expect(windowCard).toHaveCount(0)
    await expect(cards.first()).toBeVisible()
    await page.getByRole('button', { name: 'All types', exact: true }).click()
    await expect(cards).toHaveCount(allCount)
    await expect(windowCard).toBeVisible()
    await expect(page.getByRole('button', { name: operation, exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Doors', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Any operation', exact: true })).toHaveClass(/tab--active/)
    await page.getByRole('button', { name: operation, exact: true }).click()
    await page.getByRole('button', { name: '2 panels', exact: true }).click()
    await page.getByRole('button', { name: 'LHS', exact: true }).click()
    await page.getByRole('button', { name: 'Windows', exact: true }).click()
    await expect(windowCard).toBeVisible()
    await expect(hingedCard).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Any operation', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Any panels|1 panel|2 panels|3\+ panels|Any direction|LHS|RHS)$/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'All types', exact: true }).click()
    await expect(cards).toHaveCount(allCount)
    await expect(page.getByRole('button', { name: 'Any panels', exact: true })).toHaveClass(/tab--active/)
    await expect(page.getByRole('button', { name: 'Any direction', exact: true })).toHaveClass(/tab--active/)
  }
})
