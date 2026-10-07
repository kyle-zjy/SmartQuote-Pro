import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow, startNewQuote } from './helpers'

for (const width of [375, 768, 1440]) {
  test(`home navigation and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible()
    await expectNoHorizontalOverflow(page, 'home')
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('link', { name: 'New quote', exact: false }).first().click()
    await expect(page).toHaveURL(/\/quotes\/new$/)
    await startNewQuote(page)
    await page.getByRole('link', { name: 'Home', exact: true }).click()
    await expect(page.getByText('Ada Lovelace', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Continue current quote' }).click()
    await expect(page.getByRole('heading', { name: /^Quote \d/ })).toBeVisible()
    await page.getByRole('link', { name: 'SmartQuote Pro home' }).click()
    await page.getByRole('link', { name: /Products & pricing/ }).click()
    await expect(page).toHaveURL(/\/admin\/pricing$/)
  })
}
