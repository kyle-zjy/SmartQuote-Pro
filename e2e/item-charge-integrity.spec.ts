import { test, expect, resetApp, startNewQuote, addOpening, openLocationAndConfig } from './helpers'

test('a price-on-request item needs an explicit price and negative charges cannot continue', async ({ page }) => {
  await resetApp(page)
  await startNewQuote(page)
  await openLocationAndConfig(page)
  const row = page.getByRole('row', { name: /BOX-OUTS/ })
  await row.getByRole('checkbox').check()
  await expect(row.getByRole('spinbutton')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await row.getByRole('spinbutton').fill('-1')
  await expect(page.getByRole('alert')).toHaveText(/valid price/)
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await row.getByRole('spinbutton').fill('0')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save Item' }).click()
  await expect(page.locator('.quote-item-card')).toHaveCount(1)
})

test('legacy hidden charges remain visible and removable and captured fitting prices survive editing', async ({ page }) => {
  await resetApp(page)
  await startNewQuote(page)
  await addOpening(page)
  await page.getByRole('button', { name: 'Save quote', exact: true }).click()
  await expect(page.getByText('Saved on this browser. Open it later from Quotes.', { exact: true })).toBeVisible()
  await page.addInitScript(() => {
    if (sessionStorage.getItem('legacy-charges-seeded')) return
    const draft = JSON.parse(localStorage.getItem('smartquote-pro:quote')!)
    draft.items[0].addons = [{ name: 'CALL OUT FEE', price: 95 }]
    draft.items[0].fitExtras = ['TOP TRACKS']
    draft.items[0].fitExtraPrices = [{ name: 'TOP TRACKS', price: 17 }]
    draft.items[0].unitPrice += 112
    draft.items[0].finalPrice = draft.items[0].unitPrice
    draft.items[0].calculatedPrice = draft.items[0].unitPrice
    localStorage.setItem('smartquote-pro:quote', JSON.stringify(draft))
    sessionStorage.setItem('legacy-charges-seeded', 'yes')
  })
  await page.reload()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Add-ons', exact: true }).click()
  const previous = page.getByRole('region', { name: 'Previously selected charges' })
  await expect(previous).toContainText('CALL OUT FEE')
  await expect(page.getByRole('row', { name: /TOP TRACKS/ }).getByRole('spinbutton')).toHaveValue('17')
  await previous.getByRole('button', { name: 'Remove CALL OUT FEE' }).click()
  await expect(previous).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save Item' }).click()
  await page.getByRole('button', { name: 'Update saved quote' }).click()
  await expect(page.getByText('Saved on this browser. Open it later from Quotes.', { exact: true })).toBeVisible()
  const item = await page.evaluate(() => JSON.parse(localStorage.getItem('smartquote-pro:archive')!)[0].quote.items[0])
  expect(item.addons).toEqual([])
  expect(item.fitExtraPrices).toEqual([{ name: 'TOP TRACKS', price: 17 }])
})
