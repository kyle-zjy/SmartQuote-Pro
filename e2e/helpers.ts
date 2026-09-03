import { expect, type Page } from '@playwright/test'

export const CUSTOMER = {
  name: 'Ada Lovelace',
  phone: '0412 345 678',
  address: '1 Paradise Ave\nMiami QLD 4220',
}

/** Wipe browser storage and reload so each test starts on a blank quote. */
export async function resetApp(page: Page) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Get a quote' })).toBeVisible()
}

export async function goTo(page: Page, name: RegExp | string) {
  await page.getByRole('navigation').first().getByRole('link', { name }).click()
}

export async function addProductToQuote(
  page: Page,
  options: {
    product?: string
    category?: string
    height?: string
    width?: string
    room?: string
    note?: string
  } = {},
) {
  const product = options.product ?? 'Supascreen'
  await goTo(page, 'Products')
  await expect(page.getByRole('heading', { name: 'Get a quote' })).toBeVisible()
  await page.getByRole('link', { name: new RegExp(product, 'i') }).first().click()
  await expect(page.getByRole('heading', { name: product })).toBeVisible()

  if (options.category) {
    await page.getByRole('button', { name: options.category }).click()
  }

  await page.getByLabel('Height (mm)').fill(options.height ?? '1200')
  await page.getByLabel('Width (mm)').fill(options.width ?? '900')

  if (options.room) {
    await page.getByLabel('Room').selectOption(options.room)
  }
  if (options.note) {
    await page.getByLabel('Notes (optional)').fill(options.note)
  }

  await expect(page.locator('.price-result:not(.price-result--error)')).toBeVisible()
  await page.getByRole('button', { name: 'Add to quote' }).click()
  await expect(page.getByText('Added to your quote.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Quote \(\d+\)/ })).toBeVisible()
}

export async function fillQuoteDetails(
  page: Page,
  customer: { name: string; phone: string; address: string } = CUSTOMER,
) {
  await goTo(page, /Quote/)
  await expect(page.getByRole('heading', { name: 'Quote details' })).toBeVisible()
  await page.getByLabel('Customer').fill(customer.name)
  await page.getByLabel('Phone').fill(customer.phone)
  await page.getByLabel('Address').fill(customer.address)
}

export function acceptDialogs(page: Page, promptText = 'Customer asked for a change') {
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'prompt') void dialog.accept(promptText)
    else void dialog.accept()
  })
}

export function parseAud(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ''))
}
