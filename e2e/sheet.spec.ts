import { expect, test } from '@playwright/test'
import { resetApp } from './helpers'

test.describe('site measure sheet', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('picks a drawing, records sizes and saves them on this browser', async ({ page }) => {
    await page.getByRole('link', { name: 'Sheet' }).click()
    await expect(page.getByRole('heading', { name: 'Quote sheet' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hinged doors' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sliding doors' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Windows' })).toBeVisible()

    await page.getByRole('link', { name: /HDX-L/ }).click()
    await expect(page.getByRole('heading', { name: 'HDX-L' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Brush', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eraser', exact: true })).toBeVisible()

    await page.getByLabel('H1', { exact: true }).fill('2100')
    await page.getByLabel('W1', { exact: true }).fill('900')
    await expect(page.getByText(/Opening used for sizing: 2100 × 900 mm/)).toBeVisible()
    await expect(page.getByText(/Screen size: 2100 × 900 mm/)).toBeVisible()

    await page.getByRole('button', { name: 'Save measurements' }).click()
    await expect(page.getByText(/Saved on this browser/)).toBeVisible()

    await page.getByRole('link', { name: /Back to configurations/ }).click()
    await page.getByRole('link', { name: /HDX-L/ }).click()
    await expect(page.getByLabel('H1', { exact: true })).toHaveValue('2100')
    await expect(page.getByLabel('W1', { exact: true })).toHaveValue('900')
  })
})
