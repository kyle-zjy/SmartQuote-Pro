import { test, expect, resetApp, startNewQuote, addOpening } from './helpers'

test('full standard product description is saved and displayed in both PDF previews', async ({ page }) => {
  await resetApp(page)
  await startNewQuote(page)
  await addOpening(page, { measurements: { H1: '2100', H2: '2100', W1: '900', W2: '900', W3: '900' } })
  const description = 'SupaScreen - Hinged door with 316 marine grade stainless steel woven mesh'
  await page.getByRole('button', { name: 'Save quote', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Preview Customer Quote', exact: true }).click()
  const customer = page.getByRole('dialog', { name: 'Preview quote', exact: true })
  await expect(customer.getByText(description, { exact: false })).toBeVisible()
  await customer.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Preview Factory Quote', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Preview factory quote' }).getByText(description, { exact: false })).toBeVisible()
})
