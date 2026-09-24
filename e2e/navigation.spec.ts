import { expect, test } from '@playwright/test'
import { addOpening, resetApp, startNewQuote } from './helpers'

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

  test('returns from quote history to the in-progress work without starting a new quote', async ({ page }) => {
    await startNewQuote(page)
    await addOpening(page, { location: 'Old job', configCode: 'HDX-L' })
    await page.getByRole('button', { name: 'Save quote' }).click()
    page.on('dialog', (dialog) => void dialog.accept())
    await startNewQuote(page, { name: 'Current Customer', phone: '0417001615', address: '2 Current St' })
    await addOpening(page, { location: 'Current job', configCode: 'HDX-L' })
    const workingUrl = page.url()
    const customer = await page.getByLabel('Customer').inputValue()

    await page.getByRole('navigation').first().getByRole('link', { name: /^Quotes/ }).click()
    await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Snapshot' }).click()
    await expect(page.getByText('Old job').first()).toBeVisible()
    await page.locator('.quote-preview--snapshot').getByRole('button', { name: 'Continue current quote' }).click()

    await expect(page).toHaveURL(workingUrl)
    await expect(page.getByLabel('Customer')).toHaveValue(customer)
    await expect(page.locator('.quote-item-card')).toContainText('Current job')
    await page.getByRole('navigation').first().getByRole('link', { name: /^Quotes/ }).click()
    await page.getByRole('link', { name: /^Continue quote / }).click()
    await expect(page).toHaveURL(workingUrl)
  })
})
