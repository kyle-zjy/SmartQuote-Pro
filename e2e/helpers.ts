import { expect, type Page } from '@playwright/test'

export const CUSTOMER = {
  name: 'Ada Lovelace',
  phone: '0412 345 678',
  address: '1 Paradise Ave\nMiami QLD 4220',
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function resetApp(page: Page) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await expect(page).toHaveURL(/\/quotes$/)
  await expect(page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible()
}

export async function goTo(page: Page, name: RegExp | string) {
  await page.getByRole('navigation').first().getByRole('link', { name }).click()
}

export async function startNewQuote(page: Page, customer = CUSTOMER) {
  await page.goto('/quotes/new')
  await expect(page.getByRole('heading', { name: 'New quote' })).toBeVisible()
  await page.getByLabel('Customer').fill(customer.name)
  await page.getByLabel('Phone').fill(customer.phone)
  await page.getByLabel('Site address', { exact: true }).fill(customer.address)
  await page.getByRole('button', { name: 'Start quote' }).click()
  await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
}

/** Enters the complete opening location in the predictive location field. */
export async function fillRoomLocation(page: Page, location: string) {
  await page.getByRole('combobox').fill(location)
}

export type OpeningLocationOptions = {
  location?: string
  product?: string
  configCode?: string
  measurements?: Record<string, string>
  widthMm?: string
  heightMm?: string
}

/**
 * Drives Location -> Configuration -> Product -> Measurements and lands on Add-ons.
 * The Configuration step has no separate Continue button -- clicking a config card
 * advances immediately -- unlike every other wizard step.
 */
export async function openLocationAndConfig(
  page: Page,
  {
    location = 'Living Room',
    product = 'Supascreen',
    configCode = 'HDX-L',
    measurements = { H1: '2100', W1: '900' },
    widthMm,
    heightMm,
  }: OpeningLocationOptions = {},
) {
  await page.getByRole('link', { name: '+ Add Opening' }).click()

  await expect(page.getByRole('heading', { name: 'Where is this opening?' })).toBeVisible()
  await fillRoomLocation(page, location)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a configuration' })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(configCode)}\\b`) }).click()

  await expect(page.getByRole('heading', { name: 'Select a product' })).toBeVisible()
  await page.getByRole('button', { name: product, exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Measure the opening' })).toBeVisible()
  for (const [key, value] of Object.entries(measurements)) {
    await page.getByLabel(key, { exact: true }).fill(value)
  }
  if (heightMm) await page.getByLabel('H1', { exact: true }).fill(heightMm)
  if (widthMm) await page.getByLabel('W1', { exact: true }).fill(widthMm)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Add-ons' })).toBeVisible()
}

export type AddOpeningOptions = OpeningLocationOptions & {
  category?: string
  mesh?: string
  doubleHung?: boolean
  addons?: string[]
  addonPrices?: Record<string, string>
  quantity?: number
  note?: string
  customerNote?: string
}

/** Drives the full Add Opening wizard through to Save Item. */
export async function addOpening(page: Page, options: AddOpeningOptions = {}) {
  await openLocationAndConfig(page, options)

  if (options.mesh) {
    await page.getByLabel('Mesh type').selectOption({ label: options.mesh })
  }
  if (options.doubleHung) {
    await page.getByRole('checkbox', { name: /Double hung window/ }).check()
  }
  for (const name of options.addons ?? []) {
    const row = page.getByRole('row', { name: new RegExp(escapeRegExp(name)) })
    const price = options.addonPrices?.[name]
    await row.getByRole('checkbox').check()
    if (price) await row.getByRole('spinbutton', { name: `${name} price` }).fill(price)
  }
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Review & save' })).toBeVisible()
  if (options.quantity) {
    await page.getByLabel('Quantity').fill(String(options.quantity))
  }
  if (options.customerNote !== undefined) {
    await page.getByLabel('Customer notes (customer only)').fill(options.customerNote)
  }
  if (options.note) {
    await page.getByLabel('Production notes (factory only)').fill(options.note)
  }
  await page.getByRole('button', { name: 'Save Item' }).click()
}

export function acceptDialogs(page: Page, promptText = 'Customer asked for a change') {
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'prompt') {
      void dialog.accept(promptText)
    } else {
      void dialog.accept()
    }
  })
}

export function parseAud(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ''))
}

/** Fails if the page has produced horizontal scroll -- content wider than the viewport. */
export async function expectNoHorizontalOverflow(page: Page, context = '') {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    overflow.scrollWidth,
    `horizontal overflow${context ? ` at ${context}` : ''}: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1)
}
