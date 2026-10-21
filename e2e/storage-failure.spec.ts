import { test, expect, resetApp, startNewQuote, addOpening, acceptDialogs } from './helpers'

test('failed saves cannot submit or issue a quote', async ({ page }) => {
  acceptDialogs(page)
  await resetApp(page)
  await startNewQuote(page)
  await addOpening(page)

  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'smartquote-pro:archive') throw new DOMException('Full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Save quote', exact: true }).click()
  await expect(page.getByText(/Could not save this quote/)).toBeVisible()
  await page.getByRole('button', { name: 'Submit for Office Review' }).click()
  await expect(page.getByText(/Could not submit/)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('smartquote-pro:reviews'))).toBeNull()
  await expect(page.getByRole('button', { name: 'Submit for Office Review' })).toBeVisible()
  await page.getByRole('button', { name: 'Issue quote' }).click()
  await expect(page.getByText(/Could not issue/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revise quote' })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('smartquote-pro:archive'))).toBeNull()
})

test('a failed revision keeps the issued version locked and archived', async ({ page }) => {
  acceptDialogs(page)
  await resetApp(page)
  await startNewQuote(page)
  await addOpening(page)
  await page.getByRole('button', { name: 'Issue quote' }).click()
  await expect(page.getByText('Issued', { exact: true })).toBeVisible()
  const archive = await page.evaluate(() => localStorage.getItem('smartquote-pro:archive'))
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'smartquote-pro:archive') throw new DOMException('Full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Revise quote' }).click()
  await expect(page.getByText(/Could not save the revision/)).toBeVisible()
  await expect(page.getByLabel('Product unit price')).toBeDisabled()
  expect(await page.evaluate(() => localStorage.getItem('smartquote-pro:archive'))).toBe(archive)
})
