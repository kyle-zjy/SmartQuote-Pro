import { expect, test } from '@playwright/test'
import { addOpening, resetApp, startNewQuote } from './helpers'

test('saves current edits independently and subsequent saves only update the new quote', async ({ page }) => {
  await resetApp(page)
  await startNewQuote(page)
  await addOpening(page, { location: 'Living Room', configCode: 'HDX-L' })
  await page.getByRole('button', { name: 'Save quote', exact: true }).click()
  const originalURL = page.url()
  const originalArchive = await page.evaluate(() => localStorage.getItem('smartquote-pro:archive'))

  await page.getByLabel('Customer', { exact: true }).fill('Edited customer')
  await page.getByRole('button', { name: 'Save as separate quote', exact: true }).click()
  await expect(page).not.toHaveURL(originalURL)
  await expect(page.getByText(/Saved as separate quote/)).toBeVisible()
  await expect(page.getByLabel('Customer', { exact: true })).toHaveValue('Edited customer')

  const newQuoteNo = page.url().split('/').pop()!
  await expect(page.getByLabel('Quote number')).toHaveCount(0)
  await page.getByLabel('Customer', { exact: true }).fill('Updated separate customer')
  await page.getByRole('button', { name: 'Update saved quote', exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('Customer', { exact: true })).toHaveValue('Updated separate customer')

  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('smartquote-pro:archive')!))
  const original = JSON.parse(originalArchive!)[0]
  expect(records).toHaveLength(2)
  expect(records.find((record: { quoteNo: string }) => record.quoteNo === original.quoteNo)).toEqual(original)
  const separate = records.find((record: { quoteNo: string }) => record.quoteNo === newQuoteNo)
  expect(separate.quote.quoteNumber).toBe(newQuoteNo)
  expect(separate.quote.customer.name).toBe('Updated separate customer')
  expect(separate.total).toBe(original.total)
  expect(separate.quote.items).toHaveLength(1)
  expect(separate.quote.items[0].id).not.toBe(original.quote.items[0].id)
  expect({ ...separate.quote.items[0], id: original.quote.items[0].id }).toEqual(original.quote.items[0])
})

test('failed save keeps the current quote and edits available', async ({ page }) => {
  await resetApp(page)
  await startNewQuote(page)
  const originalURL = page.url()
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'smartquote-pro:archive') throw new DOMException('Full', 'QuotaExceededError')
      setItem.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Save as separate quote', exact: true }).click()
  await expect(page.getByText(/Could not save a separate quote/)).toBeVisible()
  await expect(page).toHaveURL(originalURL)
  await expect(page.getByLabel('Customer', { exact: true })).toHaveValue('Ada Lovelace')
})
