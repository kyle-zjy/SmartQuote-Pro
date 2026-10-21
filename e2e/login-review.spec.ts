import { test as base, expect, type Page } from '@playwright/test'
import { acceptDialogs, CUSTOMER } from './helpers'

// Uses the plain Playwright test (no auto admin session) so the real sign-in screens are exercised.
const test = base

async function signInAs(page: Page, portal: 'Staff' | 'Admin', email: string, password: string) {
  await page.goto('/login')
  await page.getByRole('link', { name: new RegExp(`${portal} login`) }).click()
  await expect(page.getByRole('heading', { name: `${portal} sign-in` })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

test.describe('sign-in and office review', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
  })

  test('protected pages send signed-out visitors to the login chooser', async ({ page }) => {
    await page.goto('/quotes')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('link', { name: /Staff login/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Admin login/ })).toBeVisible()
  })

  test('staff cannot use the admin portal or reach admin pages', async ({ page }) => {
    await signInAs(page, 'Admin', 'staff@goldco.com.au', 'staff')
    await expect(page.getByRole('alert')).toHaveText(/does not have admin access/)

    await signInAs(page, 'Staff', 'staff@goldco.com.au', 'staff')
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible()
    await expect(page.getByRole('navigation').first().getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
    await page.goto('/admin/reviews')
    await expect(page).toHaveURL(/\/login\/admin$/)
  })

  test('submit → return with note → resubmit → approve → issue', async ({ page }) => {
    test.setTimeout(60_000)
    acceptDialogs(page)

    await signInAs(page, 'Staff', 'staff@goldco.com.au', 'staff')
    await page.goto('/quotes/new')
    await page.getByLabel('Customer').fill(CUSTOMER.name)
    await page.getByLabel('Phone').fill(CUSTOMER.phone)
    await page.getByLabel('Site address', { exact: true }).fill(CUSTOMER.address)
    await page.getByRole('button', { name: 'Start quote' }).click()
    const heading = page.getByRole('heading', { name: /^Quote \d/ })
    await expect(heading).toBeVisible()
    const quoteNo = (await heading.textContent())!.match(/Quote (\d+)/)![1]
    // Seed one line directly so this flow doesn't depend on the opening wizard.
    await page.waitForFunction(
      (no) => JSON.parse(localStorage.getItem('smartquote-pro:quote') ?? '{}').quoteNo === no,
      quoteNo,
    )
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('smartquote-pro:quote')!))
    draft.items = [
      { id: 'seed-1', description: 'Supascreen hinged door', detail: '', quantity: 1, unitPrice: 650, room: 'Living Room', location: 'Living Room', note: '' },
    ]
    await page.addInitScript((d) => {
      const marker = `review-fixture:${d.quoteNo}`
      if (sessionStorage.getItem(marker)) return
      localStorage.setItem('smartquote-pro:quote', JSON.stringify(d))
      sessionStorage.setItem(marker, 'seeded')
    }, draft)
    await page.goto(`/quotes/${quoteNo}`)
    await expect(page.getByText('1 item', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Issue quote' })).toBeDisabled()
    await page.getByRole('button', { name: 'Submit for Office Review' }).click()
    await expect(page.getByText('Submitted for office review.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Issue quote' })).toBeDisabled()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('smartquote-pro:archive')!)[0].quote.status)).toBe('office-review')
    await signOut(page)

    await signInAs(page, 'Admin', 'admin@goldco.com.au', 'admin')
    await expect(page).toHaveURL(/\/admin\/reviews$/)
    const card = page.getByRole('article', { name: `Review ${quoteNo}` })
    await expect(card).toContainText('Sales Staff')
    await expect(card).toContainText(CUSTOMER.name)
    await card.getByRole('button', { name: 'Return to staff' }).click()
    await expect(page.getByRole('status')).toHaveText(/Add a note/)
    await card.getByPlaceholder(/Note to staff/).fill('Please double-check the living room width.')
    await card.getByRole('button', { name: 'Return to staff' }).click()
    await expect(page.getByRole('status')).toHaveText(/returned to the staff member/)
    await signOut(page)

    await signInAs(page, 'Staff', 'staff@goldco.com.au', 'staff')
    await page.goto(`/quotes/${quoteNo}`)
    await expect(page.getByRole('alert')).toHaveText(/Please double-check the living room width/)
    await expect(page.getByRole('button', { name: 'Issue quote' })).toBeDisabled()
    await page.getByRole('button', { name: 'Resubmit for review' }).click()
    await expect(page.getByText('Resubmitted for office review.')).toBeVisible()
    await signOut(page)

    await signInAs(page, 'Admin', 'admin@goldco.com.au', 'admin')
    await page.getByRole('article', { name: `Review ${quoteNo}` }).getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('status')).toHaveText(/approved/)
    await page.getByRole('button', { name: /Approved/ }).click()
    await expect(page.getByRole('article', { name: `Review ${quoteNo}` })).toBeVisible()

    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Staff' }).click()
    await page.getByRole('button', { name: /1 quote$/ }).click()
    await expect(page.getByRole('button', { name: new RegExp(`Quote ${quoteNo}`) })).toBeVisible()
    await signOut(page)

    await signInAs(page, 'Staff', 'staff@goldco.com.au', 'staff')
    await page.goto(`/quotes/${quoteNo}`)
    await expect(page.getByText(/Approved by Office Admin/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Issue quote' })).toBeEnabled()
    await page.getByLabel('Product unit price').fill('700')
    await expect(page.getByRole('alert')).toHaveText(/changed since submission/)
    await expect(page.getByRole('button', { name: 'Issue quote' })).toBeDisabled()
    await page.getByRole('button', { name: 'Resubmit for review' }).click()
    await expect(page.getByText('Resubmitted for office review.')).toBeVisible()
    await signOut(page)
    await signInAs(page, 'Admin', 'admin@goldco.com.au', 'admin')
    await page.getByRole('article', { name: `Review ${quoteNo}` }).getByRole('button', { name: 'Approve' }).click()
    await signOut(page)
    await signInAs(page, 'Staff', 'staff@goldco.com.au', 'staff')
    await page.goto(`/quotes/${quoteNo}`)
    await page.getByRole('button', { name: 'Issue quote' }).click()
    await expect(page.getByText('Issued and saved on this browser.', { exact: false })).toBeVisible()
  })

  test('admin adds a new staff member who can then sign in', async ({ page }) => {
    await signInAs(page, 'Admin', 'admin@goldco.com.au', 'admin')
    await page.goto('/admin/staff')
    const form = page.locator('form', { has: page.getByRole('heading', { name: 'Add new staff' }) })
    await form.getByLabel('Name').fill('Jamie Fitter')
    await form.getByLabel('Email').fill('jamie@goldco.com.au')
    await form.getByLabel('Temporary password').fill('Fitter-pass123')
    await form.getByRole('button', { name: 'Add staff member' }).click()
    await expect(page.getByRole('status')).toHaveText(/Jamie Fitter added/)
    await expect(page.getByRole('cell', { name: 'jamie@goldco.com.au' })).toBeVisible()
    await signOut(page)

    await signInAs(page, 'Staff', 'jamie@goldco.com.au', 'Fitter-pass123')
    await expect(page.getByText('Jamie Fitter')).toBeVisible()
  })
})
