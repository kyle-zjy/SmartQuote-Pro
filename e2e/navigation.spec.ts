import { expect, test } from '@playwright/test'
import { resetApp } from './helpers'

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('top nav reaches every main page', async ({ page }) => {
    await expect(page).toHaveTitle(/SmartQuote Pro/)
    await expect(page.getByRole('link', { name: 'SmartQuote Pro' })).toBeVisible()

    const nav = page.getByRole('navigation').first()

    await nav.getByRole('link', { name: /^Current Quote/ }).click()
    await expect(page).toHaveURL(/\/quotes\/\d+$/)
    await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()

    await nav.getByRole('link', { name: 'Admin', exact: true }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Admin settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Company', level: 2 })).toBeVisible()

    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Pricing' }).click()
    await expect(page).toHaveURL(/\/admin\/pricing$/)
    await expect(page.getByRole('heading', { name: 'Price list', level: 2 })).toBeVisible()

    await nav.getByRole('link', { name: /^Quotes/ }).click()
    await expect(page).toHaveURL(/\/quotes$/)
    await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible()
  })

  test('legacy routes from the old five-page layout redirect instead of 404ing', async ({ page }) => {
    const toQuotesList = [
      '/',
      '/product/not-a-real-product',
      '/addons',
      '/sheet',
      '/sheet/NOT-A-CODE',
      '/saved',
      '/saved/in-progress',
    ]
    for (const path of toQuotesList) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/quotes$/)
      await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible()
    }

    await page.goto('/quote')
    await expect(page).toHaveURL(/\/quotes\/\d+$/)
    await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
  })
})
