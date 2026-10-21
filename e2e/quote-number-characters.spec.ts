import { expect, test } from './helpers'
import { resetApp } from './helpers'

test('arbitrary quote number survives navigation, saving and reload', async ({ page }) => {
  await resetApp(page)
  const number = '报价 /? #%2F & + 🐱'
  await page.goto('/quotes/new')
  await page.getByLabel('Quote number').fill(number)
  await page.getByLabel('Customer', { exact: true }).fill('Character test')
  await page.getByRole('button', { name: 'Start quote', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Quote ${number}`)
  await page.getByRole('button', { name: 'Save quote', exact: true }).click()
  await expect(page.getByText('Saved on this browser. Open it later from Quotes.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Quote ${number}`)
  await page.getByRole('link', { name: '+ Add Opening', exact: true }).click()
  await expect(page).toHaveURL(/\/items\/new$/)
  await page.goto(`/quotes/${encodeURIComponent(number)}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Quote ${number}`)
})
