import { expect, test } from '@playwright/test'
import { resetApp } from './helpers'

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
  })

  test('top nav reaches every main page', async ({ page }) => {
    await expect(page).toHaveTitle(/SmartQuote Pro/)
    await expect(page.getByRole('link', { name: 'SmartQuote Pro' })).toBeVisible()

    const pages: Array<{ nav: string; heading: string; path: string }> = [
      { nav: 'Add-ons', heading: 'Add-ons & extras', path: '/addons' },
      { nav: 'Quote', heading: 'Quote details', path: '/quote' },
      { nav: 'Sheet', heading: 'Quote sheet', path: '/sheet' },
      { nav: 'Saved', heading: 'Saved quotes', path: '/saved' },
      { nav: 'Admin', heading: 'Admin settings', path: '/admin' },
      { nav: 'Products', heading: 'Get a quote', path: '/' },
    ]

    for (const item of pages) {
      await page.getByRole('navigation').getByRole('link', { name: item.nav, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${item.path.replace('/', '\\/')}$`))
      await expect(page.getByRole('heading', { name: item.heading })).toBeVisible()
    }
  })

  test('unknown product and sheet codes redirect home', async ({ page }) => {
    await page.goto('/product/not-a-real-product')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Get a quote' })).toBeVisible()

    await page.goto('/sheet/NOT-A-CODE')
    await expect(page).toHaveURL(/\/sheet$/)
    await expect(page.getByRole('heading', { name: 'Quote sheet' })).toBeVisible()
  })
})
