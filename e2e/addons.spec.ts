import { expect, test } from '@playwright/test'
import { resetApp } from './helpers'

test.describe('add-ons', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('adds a priced extra and a price-on-request extra', async ({ page }) => {
    await page.getByRole('link', { name: 'Add-ons' }).click()
    await expect(page.getByRole('heading', { name: 'Add-ons & extras' })).toBeVisible()

    await page.getByLabel('Room').selectOption('Garage')
    const petDoor = page.getByRole('row', { name: /PET DOOR - SMALL/ })
    await expect(petDoor.getByText('$180.00')).toBeVisible()
    await petDoor.getByRole('button', { name: 'Add to quote' }).click()

    const boxOuts = page.getByRole('row', { name: /BOX-OUTS/ })
    await expect(boxOuts.getByRole('button', { name: 'Add to quote' })).toHaveCount(0)
    await boxOuts.getByPlaceholder('Enter price').fill('75')
    await boxOuts.getByRole('button', { name: 'Add to quote' }).click()

    await expect(page.getByRole('link', { name: /Quote \(2\)/ })).toBeVisible()
    await page.getByRole('link', { name: /Quote \(2\)/ }).click()
    await expect(page.locator('.desc-input').first()).toHaveValue('PET DOOR - SMALL')
    await expect(page.locator('.desc-input').nth(1)).toHaveValue('BOX-OUTS')
    await expect(page.getByText('$180.00')).toBeVisible()
    await expect(page.getByText('$75.00')).toBeVisible()
  })
})
