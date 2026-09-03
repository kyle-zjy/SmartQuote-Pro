import { expect, test } from '@playwright/test'
import { acceptDialogs, addProductToQuote, CUSTOMER, fillQuoteDetails, goTo, resetApp } from './helpers'

test.describe('saved quotes', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await addProductToQuote(page)
    await fillQuoteDetails(page)
    acceptDialogs(page)
    await page.getByRole('button', { name: 'Save quote' }).click()
    await expect(page.getByText(/Saved on this browser/)).toBeVisible()
  })

  test('lists a saved quote and filters by deal status', async ({ page }) => {
    await goTo(page, /Saved/)
    const card = page.locator('.saved-quote-card').filter({ hasText: CUSTOMER.name })
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: /^00033/ })).toBeVisible()
    await expect(card.getByText('(draft)')).toBeVisible()
    await expect(card.getByText(/\$0\.00/)).toHaveCount(0)

    await page.getByRole('navigation', { name: 'Filter saved quotes' }).getByRole('link', { name: /In progress/ }).click()
    await expect(page).toHaveURL(/\/saved\/in-progress$/)
    await expect(card).toBeVisible()

    await page.getByRole('button', { name: 'Close deal' }).click()
    await expect(page.getByText('None.')).toBeVisible()

    await page.getByRole('navigation', { name: 'Filter saved quotes' }).getByRole('link', { name: /Closed/ }).click()
    await expect(page.getByRole('heading', { name: /^00033/ })).toBeVisible()
    await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Reopen' }).click()
    await page.getByRole('navigation', { name: 'Filter saved quotes' }).getByRole('link', { name: /In progress/ }).click()
    await expect(page.getByRole('heading', { name: /^00033/ })).toBeVisible()
  })

  test('can comment, snapshot, open and delete a revision', async ({ page }) => {
    await goTo(page, /Saved/)

    await page.getByRole('button', { name: 'Add a comment' }).click()
    await page.getByPlaceholder('e.g. Waiting on site measure').fill('Waiting on site measure')
    await page.getByRole('button', { name: 'Add comment' }).click()
    await expect(page.getByText('Waiting on site measure')).toBeVisible()

    await page.getByRole('button', { name: 'Snapshot' }).click()
    const snapshot = page.getByRole('dialog', { name: /Snapshot/ })
    await expect(snapshot).toBeVisible()
    await expect(snapshot.getByText(CUSTOMER.name).first()).toBeVisible()
    await expect(snapshot.getByText(/1 line/)).toBeVisible()
    await snapshot.getByRole('button', { name: 'Close' }).first().click()
    await expect(snapshot).toHaveCount(0)

    await page.getByRole('button', { name: 'Open' }).click()
    await expect(page).toHaveURL(/\/quote$/)
    await expect(page.getByLabel('Customer')).toHaveValue(CUSTOMER.name)

    await goTo(page, /Saved/)
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('No saved quotes yet')).toBeVisible()
  })
})
