import { expect, test, type Page } from '@playwright/test'
import { acceptDialogs, addOpening, goTo, resetApp, startNewQuote } from './helpers'

/** Starts an opening and stops on the Measurements step with partial values, nothing saved. */
async function startUnfinishedOpening(page: Page, location = 'Living Room Test') {
  await page.getByRole('link', { name: '+ Add Opening' }).click()
  await page.getByLabel('Location').fill(location)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: /^HDX-L\b/ }).click()

  await expect(page.getByRole('heading', { name: 'Measure the opening' })).toBeVisible()
  await page.getByLabel('H1', { exact: true }).fill('2000')
  await page.getByLabel('W1', { exact: true }).fill('800')
}

async function expectResumedOnMeasurements(page: Page, location = 'Living Room Test') {
  await expect(page).toHaveURL(/\/items\/new$/)
  await expect(page.getByRole('heading', { name: 'Measure the opening' })).toBeVisible()
  await expect(page.getByText(`${location} / HDX-L`)).toBeVisible()
  await expect(page.getByLabel('H1', { exact: true })).toHaveValue('2000')
  await expect(page.getByLabel('W1', { exact: true })).toHaveValue('800')
}

test.describe('wizard draft persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
  })

  test.describe('Back to quote is an explicit exit: stay on the workspace', () => {
    test('offers Resume/Discard instead of redirecting back into the wizard', async ({ page }) => {
      await page.getByRole('link', { name: '+ Add Opening' }).click()
      await page.getByLabel('Location').fill('Bedroom 2')
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { name: 'Pick a configuration' })).toBeVisible()

      await page.getByRole('link', { name: 'Back to quote' }).click()

      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.getByText(/New opening.*Bedroom 2.*Configuration step/)).toBeVisible()

      // The workspace must hold: no auto-redirect may kick in a moment later.
      await page.waitForTimeout(600)
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
    })

    test('Resume returns to the saved step with values intact', async ({ page }) => {
      await startUnfinishedOpening(page)
      await page.getByRole('link', { name: 'Back to quote' }).click()
      await expect(page.getByText(/New opening.*Measurements step/)).toBeVisible()

      await page.getByRole('link', { name: 'Resume' }).click()
      await expectResumedOnMeasurements(page)
    })

    test('Discard from the banner deletes the unfinished draft', async ({ page }) => {
      acceptDialogs(page)
      await startUnfinishedOpening(page)
      await page.getByRole('link', { name: 'Back to quote' }).click()

      await page.getByRole('button', { name: 'Discard' }).click()
      await expect(page.getByText(/New opening/)).toHaveCount(0)

      // With the draft gone, returning to the quote must no longer auto-resume anything.
      await goTo(page, /^Quotes/)
      await goTo(page, 'Current Quote')
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.getByRole('heading', { name: 'Measure the opening' })).toHaveCount(0)
    })
  })

  test.describe('returning to the quote from elsewhere: auto-resume', () => {
    test('the Current Quote nav link goes straight back into the wizard', async ({ page }) => {
      await startUnfinishedOpening(page)
      await page.getByRole('link', { name: 'Back to quote' }).click()
      await goTo(page, /^Quotes/)
      await expect(page).toHaveURL(/\/quotes$/)

      await goTo(page, 'Current Quote')

      await expectResumedOnMeasurements(page)
      // Auto-resume replaces the workspace entry, so it must never show its banner on the way.
      await expect(page.getByText(/New opening/)).toHaveCount(0)
    })

    test('reopening the quote by URL goes straight back into the wizard', async ({ page }) => {
      await startUnfinishedOpening(page, 'Front Entry')
      await page.getByRole('link', { name: 'Back to quote' }).click()
      const workspaceUrl = page.url()

      await goTo(page, /^Quotes/)
      await page.goto(workspaceUrl)

      await expectResumedOnMeasurements(page, 'Front Entry')
    })

    test('auto-resume does not trap the Back button or loop with Back to quote', async ({ page }) => {
      await startUnfinishedOpening(page)
      await page.getByRole('link', { name: 'Back to quote' }).click()
      await goTo(page, /^Quotes/)
      await goTo(page, 'Current Quote')
      await expectResumedOnMeasurements(page)

      // The redirect used replace, so Back leaves for the Quotes list rather than bouncing
      // through the workspace and being redirected into the wizard again.
      await page.goBack()
      await expect(page).toHaveURL(/\/quotes$/)

      // And an explicit exit still wins immediately after an auto-resume.
      await goTo(page, 'Current Quote')
      await expectResumedOnMeasurements(page)
      await page.getByRole('link', { name: 'Back to quote' }).click()
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await page.waitForTimeout(600)
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.getByText(/New opening.*Measurements step/)).toBeVisible()
    })
  })

  test.describe('explicitly ending a draft leaves nothing to resume', () => {
    test('discarding inside the wizard clears the draft', async ({ page }) => {
      acceptDialogs(page)
      await startUnfinishedOpening(page, 'Laundry')

      await page.getByRole('button', { name: 'Discard this opening' }).click()
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.getByText(/New opening/)).toHaveCount(0)

      await goTo(page, /^Quotes/)
      await goTo(page, 'Current Quote')
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
    })

    test('a completed save clears the draft', async ({ page }) => {
      await addOpening(page, { location: 'Kitchen', configCode: 'HDX-L' })
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.getByText(/New opening/)).toHaveCount(0)

      await goTo(page, /^Quotes/)
      await goTo(page, 'Current Quote')
      await expect(page).toHaveURL(/\/quotes\/\d+$/)
      await expect(page.locator('.quote-item-card')).toHaveCount(1)
    })
  })
})
