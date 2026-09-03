import { expect, test } from '@playwright/test'
import { acceptDialogs, addOpening, CUSTOMER, goTo, resetApp, startNewQuote } from './helpers'

test.describe('quotes list', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
    await addOpening(page, { location: 'Living Room', configCode: 'HDX-L' })
    acceptDialogs(page)
    await page.getByRole('button', { name: 'Save quote' }).click()
    await expect(page.getByText(/Saved on this browser/)).toBeVisible()
  })

  test('lists a saved quote and filters by deal status and quote status', async ({ page }) => {
    await goTo(page, /^Quotes/)
    await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible()

    const card = page.locator('.saved-quote-card').filter({ hasText: CUSTOMER.name })
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: /^00033/ })).toBeVisible()
    await expect(card.getByText('(draft)')).toBeVisible()

    const dealNav = page.getByRole('navigation', { name: 'Filter by deal status' })
    const quoteStatusNav = page.getByRole('navigation', { name: 'Filter by quote status' })

    await dealNav.getByRole('button', { name: /Closed/ }).click()
    await expect(page.getByRole('heading', { name: 'In progress' })).not.toBeVisible()
    await dealNav.getByRole('button', { name: 'All' }).click()
    await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()

    await card.getByRole('button', { name: 'Close deal' }).click()
    await expect(page.locator('.saved-board--open').getByText(CUSTOMER.name)).toHaveCount(0)
    await expect(page.locator('.saved-board--closed').getByText(CUSTOMER.name)).toBeVisible()

    await page.locator('.saved-board--closed').getByRole('button', { name: 'Reopen' }).click()
    await expect(page.locator('.saved-board--open').getByText(CUSTOMER.name)).toBeVisible()

    await quoteStatusNav.getByRole('button', { name: 'Issued' }).click()
    await expect(card).not.toBeVisible()
    await quoteStatusNav.getByRole('button', { name: 'Draft' }).click()
    await expect(card).toBeVisible()
  })

  test('can comment, snapshot, open and delete a revision', async ({ page }) => {
    await goTo(page, /^Quotes/)

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
    await expect(page).toHaveURL(/\/quotes\/\d+$/)
    await expect(page.getByLabel('Customer')).toHaveValue(CUSTOMER.name)

    await goTo(page, /^Quotes/)
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText(/No saved quotes yet/)).toBeVisible()
  })
})
