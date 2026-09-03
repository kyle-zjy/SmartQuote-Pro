import { expect, test } from '@playwright/test'
import { acceptDialogs, addProductToQuote, CUSTOMER, fillQuoteDetails, parseAud, resetApp } from './helpers'

test.describe('quote editor', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await addProductToQuote(page)
    await fillQuoteDetails(page)
  })

  test('shows customer, suffix and GST on the paper preview', async ({ page }) => {
    await page.getByLabel('Quote suffix').fill('SS')
    await expect(page.locator('.quote-doc__no')).toHaveText(/Quote No: 00033021-SS|Quote No: \d{8}-SS/)
    await expect(page.locator('.quote-doc').getByText(CUSTOMER.name).first()).toBeVisible()
    await expect(page.locator('.quote-doc').getByText(CUSTOMER.phone).first()).toBeVisible()

    const saleAmt = page.locator('.quote-sheet-foot__totals').getByText('Sale Amt')
    await expect(saleAmt).toBeVisible()
    const totals = page.locator('.quote-sheet-foot__totals')
    const amounts = await totals.locator('span').allTextContents()
    const sale = parseAud(amounts[1])
    const gst = parseAud(amounts[3])
    const total = parseAud(amounts[7])
    expect(gst).toBeCloseTo(sale * 0.1, 1)
    expect(total).toBeCloseTo(sale + gst, 1)

    await page.getByLabel('Include GST (10%)').uncheck()
    const after = await totals.locator('span').allTextContents()
    expect(parseAud(after[3])).toBe(0)
    expect(parseAud(after[7])).toBe(sale)
  })

  test('can use a different ship-to address and a colour extra', async ({ page }) => {
    await page.getByLabel('Ship To is the same as Bill To').uncheck()
    await page.getByLabel('Ship name').fill('Site Contact')
    await page.getByLabel('Ship phone').fill('0400 000 001')
    await page.getByLabel('Ship address').fill('9 Site Rd\nMiami QLD 4220')
    await expect(page.locator('.quote-doc').getByText('Site Contact')).toBeVisible()
    await expect(page.locator('.quote-doc').getByText('9 Site Rd', { exact: true })).toBeVisible()

    await page.getByLabel('Frame colour').selectOption('Deco Bush Cherry Decoral')
    await expect(page.getByLabel('Colour extra $')).toHaveValue('220')
    await expect(page.getByText('Powder coating for non-standard colour')).toBeVisible()
    await expect(page.getByText('$220.00').first()).toBeVisible()
  })

  test('save, issue, revise and new quote follow the paper workflow', async ({ page }) => {
    acceptDialogs(page)

    await page.getByRole('button', { name: 'Save quote' }).click()
    await expect(page.getByText(/Saved on this browser/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Saved \(1\)/ })).toBeVisible()

    await page.getByRole('button', { name: 'Issue quote' }).click()
    await expect(page.getByText('Status: Issued')).toBeVisible()
    await expect(page.getByLabel('Customer')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Issued' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Revise quote' })).toBeVisible()

    await page.getByRole('navigation').first().getByRole('link', { name: 'Products' }).click()
    await page.getByRole('link', { name: /Supascreen/ }).click()
    await page.getByLabel('Height (mm)').fill('1200')
    await page.getByLabel('Width (mm)').fill('900')
    await expect(page.getByText(/issued and locked/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to quote' })).toBeDisabled()

    await page.getByRole('navigation').first().getByRole('link', { name: /Quote/ }).click()
    await page.getByRole('button', { name: 'Revise quote' }).click()
    await expect(page.getByText(/Revision opened/)).toBeVisible()
    await expect(page.locator('.quote-doc__no')).toHaveText(/Rev 2/)
    await expect(page.getByLabel('Customer')).toBeEnabled()

    await page.getByRole('button', { name: 'New quote' }).click()
    await expect(page.locator('.quote-doc__no')).toHaveText(/Quote No: 00033022|Quote No: \d{8}/)
    await expect(page.locator('.quote-doc__no')).not.toHaveText(/-SS/)
    await expect(page.getByText('No items yet')).toBeVisible()
  })

  test('opens the PDF preview dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Save as PDF' }).click()
    const dialog = page.getByRole('dialog', { name: 'Preview quote' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Quote', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Download PDF' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('clear items empties the line list', async ({ page }) => {
    acceptDialogs(page)
    await page.getByRole('button', { name: 'Clear items' }).click()
    await expect(page.getByText('No items yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Quote', exact: true })).toBeVisible()
  })
})
