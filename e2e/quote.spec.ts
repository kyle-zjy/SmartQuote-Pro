import { expect, test } from '@playwright/test'
import { acceptDialogs, addOpening, CUSTOMER, parseAud, resetApp, startNewQuote } from './helpers'

test.describe('quote workspace', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
    await addOpening(page, { location: 'Living Room', configCode: 'HDX-L' })
  })

  test('shows customer, suffix and GST on the customer preview', async ({ page }) => {
    await page.getByLabel('Quote suffix').fill('SS')
    await page.getByRole('button', { name: 'Preview Customer Quote' }).click()

    const dialog = page.getByRole('dialog', { name: 'Preview quote' })
    await expect(dialog.locator('.quote-doc__no')).toHaveText(/Quote No: \d+-SS/)
    await expect(dialog.getByText(CUSTOMER.name)).toBeVisible()
    await expect(dialog.getByText('GST')).toBeVisible()

    await dialog.getByRole('button', { name: 'Back' }).click()
    await expect(dialog).toBeHidden()
  })

  test('can use a different ship-to address and a colour extra', async ({ page }) => {
    await page.getByLabel('Ship To is the same as Bill To').uncheck()
    await page.getByLabel('Ship name').fill('Warehouse Co')
    await page.getByLabel('Ship phone').fill('07 5555 1234')
    await page.getByLabel('Ship address').fill('9 Industrial Dr\nYatala QLD 4207')

    await page.getByLabel('Frame colour (default)').selectOption({ label: 'Deco Bush Cherry Decoral (extra)' })
    await expect(page.getByLabel('Colour extra $')).toBeVisible()

    await page.getByRole('button', { name: 'Preview Customer Quote' }).click()
    const dialog = page.getByRole('dialog', { name: 'Preview quote' })
    await expect(dialog.getByText('Warehouse Co')).toBeVisible()
    await expect(dialog.getByText('Powder coating for non-standard colour')).toBeVisible()
  })

  test('submit for review, issue, revise and new quote follow the office workflow', async ({ page }) => {
    acceptDialogs(page)

    await page.getByRole('button', { name: 'Submit for Office Review' }).click()
    await expect(page.getByText('This quote is submitted for office review and can still be edited.')).toBeVisible()

    await page.getByRole('button', { name: 'Issue quote' }).click()
    await expect(page.getByText(/^Issued/)).toBeVisible()
    await expect(page.getByLabel('Customer')).toBeDisabled()

    await expect(page.getByRole('button', { name: '+ Add Opening' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Duplicate' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reuse' })).toBeDisabled()
    await expect(page.getByText('Revise this quote to add or change openings.')).toBeVisible()

    await page.goto(`${page.url()}/items/new`)
    await expect(
      page.getByText('This quote is issued and locked. Start a new quote before changing items.'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Where is this opening?' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Back to quote' }).click()
    await page.getByRole('button', { name: 'Revise quote' }).click()
    await expect(page.getByText(/^Revision opened/)).toBeVisible()
    await expect(page.getByLabel('Customer')).toBeEnabled()

    await page.getByRole('link', { name: 'New quote' }).click()
    await expect(page).toHaveURL(/\/quotes\/new$/)
    await expect(page.getByRole('heading', { name: 'New quote' })).toBeVisible()
  })

  test('opens the PDF preview dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Preview Customer Quote' }).click()

    const dialog = page.getByRole('dialog', { name: 'Preview quote' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Preview quote' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Download PDF' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Back' }).click()
    await expect(dialog).toBeHidden()
  })

  test('clear items empties the opening list', async ({ page }) => {
    await expect(page.locator('.quote-item-card')).toHaveCount(1)

    acceptDialogs(page)
    await page.getByRole('button', { name: 'Clear items' }).click()

    await expect(page.locator('.quote-item-card')).toHaveCount(0)
    await expect(page.getByText('No openings added yet.')).toBeVisible()
  })
})

test.describe('quote totals', () => {
  test('subtotal and total reflect the opening price', async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
    await addOpening(page, { location: 'Living Room', configCode: 'HDX-L' })

    const subtotalText = await page.getByText(/^Subtotal: /).innerText()
    const totalText = await page.getByText(/^Total: /).innerText()
    expect(parseAud(subtotalText)).toBeGreaterThan(0)
    expect(parseAud(totalText)).toBeGreaterThanOrEqual(parseAud(subtotalText))
  })
})

test.describe('room grouping', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page)
    await startNewQuote(page)
  })

  test('groups items into one container per room', async ({ page }) => {
    await addOpening(page, { location: 'Living Room', configCode: 'HDX-L' })
    await addOpening(page, { location: 'Living Room', configCode: 'WS', product: 'Fly Screens' })
    await addOpening(page, { location: 'Kitchen', configCode: 'WS', product: 'Fly Screens' })

    const rooms = page.locator('.quote-room-group')
    await expect(rooms).toHaveCount(2)

    await expect(rooms.nth(0).locator('.quote-room-group__title')).toHaveText('Living Room')
    await expect(rooms.nth(0).getByText('2 items')).toBeVisible()
    await expect(rooms.nth(0).locator('.quote-item-card')).toHaveCount(2)

    await expect(rooms.nth(1).locator('.quote-room-group__title')).toHaveText('Kitchen')
    await expect(rooms.nth(1).getByText('1 item')).toBeVisible()
    await expect(rooms.nth(1).locator('.quote-item-card')).toHaveCount(1)
  })

  test('never merges numbered bedrooms into one group', async ({ page }) => {
    await addOpening(page, { location: 'Bedroom 1', configCode: 'HDX-L' })
    await addOpening(page, { location: 'Bedroom 2', configCode: 'HDX-L' })
    await addOpening(page, { location: 'Bedroom 1', configCode: 'WS', product: 'Fly Screens' })

    const rooms = page.locator('.quote-room-group')
    await expect(rooms).toHaveCount(2)

    await expect(rooms.nth(0).locator('.quote-room-group__title')).toHaveText('Bedroom 1')
    await expect(rooms.nth(0).locator('.quote-item-card')).toHaveCount(2)

    await expect(rooms.nth(1).locator('.quote-room-group__title')).toHaveText('Bedroom 2')
    await expect(rooms.nth(1).locator('.quote-item-card')).toHaveCount(1)
  })
})
