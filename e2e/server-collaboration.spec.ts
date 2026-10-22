import { test, expect, type Page } from '@playwright/test'
import { acceptDialogs, startNewQuote, addOpening } from './helpers'

test.describe('database collaboration across isolated browsers', () => {
  test.skip(
    process.env.PLAYWRIGHT_SERVER_MODE !== '1',
    'Requires the isolated PostgreSQL integration server.',
  )
  test.setTimeout(90000)
  test('discounts synchronize across browsers and freeze when the quote is issued', async ({ browser, baseURL }) => {
    const a = await browser.newContext({ baseURL }), b = await browser.newContext({ baseURL })
    try {
      const first = await a.newPage(), second = await b.newPage()
      await login(first, 'staff')
      await startNewQuote(first)
      await addOpening(first)
      await first.getByLabel('Product unit price', { exact: true }).fill('100')
      await first.getByLabel('Discount (%)', { exact: true }).fill('10')
      await first.getByLabel('Discount note', { exact: true }).fill('Defence discount')
      await first.getByRole('button', { name: 'Save quote', exact: true }).click()
      await expect(first.getByText(/Saved to the shared workspace/)).toBeVisible()
      await login(second, 'admin')
      await second.goto(first.url())
      await expect(second.getByLabel('Discount (%)', { exact: true })).toHaveValue('10')
      await expect(second.getByLabel('Discount note', { exact: true })).toHaveValue('Defence discount')
      await expect(second.locator('.quote-workspace__total-line')).toHaveText('Total: $99.00')
      await second.getByLabel('Discount (%)', { exact: true }).fill('20')
      await second.getByRole('button', { name: 'Update saved quote', exact: true }).click()
      await expect(second.getByText(/Saved to the shared workspace/)).toBeVisible()
      await second.getByRole('button', { name: 'Issue quote', exact: true }).click()
      await expect(second.getByText('Issued and saved to the shared workspace.', { exact: true })).toBeVisible()
      const quoteNo = decodeURIComponent(new URL(second.url()).pathname.split('/')[2])
      await first.goto('/quotes')
      const issuedCard = first.getByRole('article').filter({ hasText: new RegExp(`\\b${quoteNo}\\b`) })
      await expect(issuedCard).toContainText('Issued')
      await issuedCard.getByRole('button', { name: 'Open', exact: true }).click()
      await expect(first.getByLabel('Discount (%)', { exact: true })).toHaveValue('20')
      await expect(first.getByLabel('Discount (%)', { exact: true })).toBeDisabled()
      await expect(first.getByLabel('Discount note', { exact: true })).toBeDisabled()
      await expect(first.locator('.quote-workspace__total-line')).toHaveText('Total: $88.00')
    } finally {
      await a.close()
      await b.close()
    }
  })
  test('server saves survive browser cache failures and reload in another browser', async ({
    browser,
    baseURL,
  }) => {
    const a = await browser.newContext({ baseURL }),
      b = await browser.newContext({ baseURL })
    try {
      const first = await a.newPage(),
        second = await b.newPage()
      await login(first, 'staff')
      await startNewQuote(first, {
        name: 'Cache failure test',
        phone: '0400000005',
        address: '6 Shared Street',
      })
      await addOpening(first)
      await first.evaluate(() => {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage)
            throw new DOMException('Simulated quota exceeded', 'QuotaExceededError')
          return original.call(this, key, value)
        }
      })
      await first.getByLabel('Product unit price').fill('776')
      await first.getByRole('button', { name: 'Save quote', exact: true }).click()
      await expect(first.getByText(/Saved to the shared workspace/)).toBeVisible()
      await expect(first.getByText(/Browser cache is unavailable/)).toBeVisible()
      await first.getByLabel('Product unit price').fill('777')
      await first.getByRole('button', { name: 'Update saved quote', exact: true }).click()
      await expect(first.getByText(/Saved to the shared workspace/)).toBeVisible()
      await login(second, 'staff')
      await second.goto(first.url())
      await expect(second.getByLabel('Product unit price')).toHaveValue('777')
      await first.reload()
      await expect(first.getByLabel('Product unit price')).toHaveValue('777')
      await expect(first.getByText(/Browser cache is unavailable/)).toHaveCount(0)
    } finally {
      await a.close()
      await b.close()
    }
  })
  test('administrator resets a forgotten password and staff must choose a new one', async ({
    browser,
    baseURL,
  }) => {
    const a = await browser.newContext({ baseURL }),
      b = await browser.newContext({ baseURL })
    try {
      const admin = await a.newPage(),
        staff = await b.newPage()
      await login(admin, 'admin')
      await admin.goto('/admin/staff')
      const name = 'Reset staff ' + Date.now(),
        email = 'reset-' + Date.now() + '@test.local'
      const create = admin.locator('form', {
        has: admin.getByRole('heading', { name: 'Add new staff' }),
      })
      await create.getByLabel('Name', { exact: true }).fill(name)
      await create.getByLabel('Email', { exact: true }).fill(email)
      await create.getByLabel('Temporary password', { exact: true }).fill('Temporary-pass123')
      await create.getByRole('button', { name: 'Add staff member' }).click()
      await expect(admin.getByRole('status')).toContainText(name + ' added')
      await admin.getByRole('button', { name: 'Reset password for ' + name, exact: true }).click()
      const reset = admin.locator('form', {
        has: admin.getByRole('heading', { name: 'Reset password for ' + name, exact: true }),
      })
      await reset.getByLabel('Your administrator password').fill('admin')
      await reset.getByLabel('New temporary password', { exact: true }).fill('Reset-pass123')
      await reset.getByLabel('Confirm temporary password', { exact: true }).fill('Reset-pass123')
      await reset.getByRole('button', { name: 'Reset password', exact: true }).click()
      await expect(admin.getByRole('status')).toContainText('Password reset for ' + name)
      await staff.goto('/login/staff')
      await staff.getByLabel('Email').fill(email)
      await staff.getByLabel('Password', { exact: true }).fill('Temporary-pass123')
      await staff.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(staff.getByRole('alert')).toContainText('incorrect')
      await staff.getByLabel('Password', { exact: true }).fill('Reset-pass123')
      await staff.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(staff).toHaveURL(/\/account$/)
      await staff.goto('/quotes')
      await expect(staff.getByRole('heading', { name: 'Change password' })).toBeVisible()
      await staff.getByLabel('Current password', { exact: true }).fill('Reset-pass123')
      await staff.getByLabel('New password', { exact: true }).fill('Final-password123')
      await staff.getByLabel('Confirm new password').fill('Final-password123')
      await staff.getByRole('button', { name: 'Change password', exact: true }).click()
      await expect(
        staff.getByText('Password changed. Other signed-in sessions have been signed out.'),
      ).toBeVisible()
      await staff
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: /^Quotes/ })
        .click()
      await expect(staff).toHaveURL(/\/quotes$/)
    } finally {
      await a.close()
      await b.close()
    }
  })
  async function login(page: Page, role: 'staff' | 'admin') {
    await page.goto(`/login/${role}`)
    await page.getByLabel('Email').fill(`${role}@goldco.com.au`)
    await page.getByLabel('Password').fill(role)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    acceptDialogs(page)
  }
  test('staff submission, admin return and approval, and staff issue share PostgreSQL', async ({
    browser,
    baseURL,
  }) => {
    const staffContext = await browser.newContext({ baseURL })
    const adminContext = await browser.newContext({ baseURL })
    try {
      const staff = await staffContext.newPage(),
        admin = await adminContext.newPage()
      await login(staff, 'staff')
      await login(admin, 'admin')
      await startNewQuote(staff, {
        name: 'Database collaboration test',
        phone: '0400000000',
        address: '1 Shared Street',
      })
      await addOpening(staff)
      const no = decodeURIComponent(new URL(staff.url()).pathname.split('/')[2])
      const card = admin.getByRole('article', { name: `Review ${no}`, exact: true })
      await staff.getByRole('button', { name: 'Submit for Office Review', exact: true }).click()
      await expect(staff.getByText('Submitted for office review.', { exact: true })).toBeVisible()
      await expect(card).toBeVisible({ timeout: 15000 })
      await card.getByPlaceholder(/Note to staff/).fill('Confirm the width.')
      await card.getByRole('button', { name: 'Return to staff' }).click()
      await expect(admin.getByRole('status')).toContainText('returned to the staff member')
      await expect(staff.getByText(/Returned by Office Admin: Confirm the width/)).toBeVisible({
        timeout: 15000,
      })
      await staff.getByRole('button', { name: 'Resubmit for review' }).click()
      await expect(staff.getByText('Resubmitted for office review.', { exact: true })).toBeVisible()
      await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible({
        timeout: 15000,
      })
      await card.getByRole('button', { name: 'Approve', exact: true }).click()
      await expect(admin.getByRole('status')).toContainText('approved')
      await expect(staff.getByRole('button', { name: 'Issue quote', exact: true })).toBeEnabled({
        timeout: 15000,
      })
      await staff.getByRole('button', { name: 'Issue quote', exact: true }).click()
      await expect(
        staff.getByText('Issued and saved to the shared workspace.', { exact: true }),
      ).toBeVisible()
      await admin
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: /^Quotes/ })
        .click()
      await expect(
        admin.getByRole('article').filter({ hasText: new RegExp(`\\b${no}\\b`) }),
      ).toContainText('Issued', { timeout: 15000 })
      await staff.reload()
      await expect(staff.getByRole('button', { name: 'Revise quote' })).toBeVisible()
    } finally {
      await staffContext.close()
      await adminContext.close()
    }
  })
  test('stale editing cannot overwrite a quote saved in another browser', async ({
    browser,
    baseURL,
  }) => {
    const firstContext = await browser.newContext({ baseURL }),
      secondContext = await browser.newContext({ baseURL })
    try {
      const first = await firstContext.newPage(),
        second = await secondContext.newPage()
      await login(first, 'staff')
      await startNewQuote(first, {
        name: 'Conflict protection test',
        phone: '0400000001',
        address: '2 Shared Street',
      })
      await addOpening(first)
      await first.getByRole('button', { name: 'Save quote', exact: true }).click()
      await expect(first.getByText(/Saved to the shared workspace/)).toBeVisible()
      const url = first.url()
      await login(second, 'staff')
      await second.goto(url)
      await expect(second.getByLabel('Product unit price')).toBeEnabled()
      await second.getByLabel('Product unit price').fill('701')
      await second.getByRole('button', { name: 'Update saved quote', exact: true }).click()
      await expect(second.getByText(/Saved to the shared workspace/)).toBeVisible()
      await first.waitForTimeout(3500)
      await first.getByLabel('Product unit price').fill('999')
      await first.getByRole('button', { name: 'Update saved quote', exact: true }).click()
      await expect(first.getByText(/This record was changed in another browser/)).toBeVisible()
      await expect(first.getByLabel('Product unit price')).toHaveValue('999')
      await second.reload()
      await expect(second.getByLabel('Product unit price')).toHaveValue('701')
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })
  test('room photos and company settings are visible in another browser', async ({
    browser,
    baseURL,
  }) => {
    const a = await browser.newContext({ baseURL }),
      b = await browser.newContext({ baseURL })
    try {
      const staff = await a.newPage(),
        admin = await b.newPage()
      await login(staff, 'staff')
      await login(admin, 'admin')
      await admin.goto('/admin')
      const original = await admin.getByLabel('Name', { exact: true }).inputValue()
      const company = 'Shared company ' + Date.now()
      await admin.getByLabel('Name', { exact: true }).fill(company)
      await admin.getByRole('button', { name: 'Save settings', exact: true }).click()
      await expect(admin.getByText('Saved to the shared workspace.', { exact: true })).toBeVisible()
      await expect
        .poll(() =>
          staff.evaluate(
            () => JSON.parse(localStorage.getItem('smartquote-pro:company') ?? '{}').name,
          ),
        )
        .toBe(company)
      await startNewQuote(staff, {
        name: 'Shared photo test ' + Date.now(),
        phone: '0400000002',
        address: '3 Shared Street',
      })
      await addOpening(staff)
      await staff.getByLabel('Living Room room photos', { exact: true }).setInputFiles({
        name: 'room.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
          'base64',
        ),
      })
      await expect(staff.locator('.room-photo-thumb img')).toHaveAttribute('src', /^data:image/)
      await staff.getByRole('button', { name: 'Save quote', exact: true }).click()
      await expect(staff.getByText(/Saved to the shared workspace/)).toBeVisible()
      await admin.goto(staff.url())
      await expect(admin.locator('.room-photo-thumb img')).toHaveAttribute('src', /^data:image/)
      await admin.getByRole('button', { name: 'Preview Customer Quote' }).click()
      await expect(admin.getByRole('img', { name: company, exact: true })).toBeVisible()
      await admin.goto('/admin')
      await admin.getByLabel('Name', { exact: true }).fill(original)
      await admin.getByRole('button', { name: 'Save settings', exact: true }).click()
      await expect(admin.getByText('Saved to the shared workspace.', { exact: true })).toBeVisible()
    } finally {
      await a.close()
      await b.close()
    }
  })
  test('admin-created accounts can sign in elsewhere and are signed out when deactivated', async ({
    browser,
    baseURL,
  }) => {
    const a = await browser.newContext({ baseURL }),
      b = await browser.newContext({ baseURL })
    try {
      const admin = await a.newPage(),
        staff = await b.newPage()
      await login(admin, 'admin')
      await admin.goto('/admin/staff')
      const name = 'Shared staff ' + Date.now(),
        email = 'shared-' + Date.now() + '@test.local'
      const form = admin.locator('form', {
        has: admin.getByRole('heading', { name: 'Add new staff' }),
      })
      await form.getByLabel('Name', { exact: true }).fill(name)
      await form.getByLabel('Email', { exact: true }).fill(email)
      await form.getByLabel('Temporary password').fill('Shared-test123')
      await form.getByRole('button', { name: 'Add staff member' }).click()
      await expect(admin.getByRole('status')).toContainText(name + ' added')
      await staff.goto('/login/staff')
      await staff.getByLabel('Email').fill(email)
      await staff.getByLabel('Password', { exact: true }).fill('Shared-test123')
      await staff.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(staff.getByRole('banner')).toContainText(name)
      await expect(staff.getByRole('heading', { name: 'Change password' })).toBeVisible()
      await staff.getByLabel('Current password', { exact: true }).fill('Shared-test123')
      await staff.getByLabel('New password', { exact: true }).fill('Personal-test123')
      await staff.getByLabel('Confirm new password').fill('Personal-test123')
      await staff.getByRole('button', { name: 'Change password', exact: true }).click()
      await expect(
        staff.getByText('Password changed. Other signed-in sessions have been signed out.'),
      ).toBeVisible()
      await admin
        .getByRole('row')
        .filter({ hasText: email })
        .getByRole('button', { name: 'Deactivate', exact: true })
        .click()
      await expect(staff.getByRole('heading', { name: 'Sign in to SmartQuote Pro' })).toBeVisible({
        timeout: 15000,
      })
    } finally {
      await a.close()
      await b.close()
    }
  })
  test('unsent local draft edits survive a connection failure and reload', async ({ page }) => {
    await login(page, 'staff')
    await startNewQuote(page, {
      name: 'Offline recovery ' + Date.now(),
      phone: '0400000003',
      address: '4 Shared Street',
    })
    await addOpening(page)
    await page.getByRole('button', { name: 'Save quote', exact: true }).click()
    await expect(page.getByText(/Saved to the shared workspace/)).toBeVisible()
    await page.route('**/api/v1/workspace*', (route) => route.abort())
    await page.getByLabel('Product unit price').fill('888')
    await expect(page.getByText(/Cannot reach the server/)).toBeVisible({ timeout: 15000 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Retry connection' })).toBeVisible()
    await page.unroute('**/api/v1/workspace*')
    await page.getByRole('button', { name: 'Retry connection' }).click()
    await expect(page.getByLabel('Product unit price')).toHaveValue('888')
    await page.getByRole('button', { name: 'Update saved quote', exact: true }).click()
    await expect(page.getByText(/Saved to the shared workspace/)).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Product unit price')).toHaveValue('888')
  })
  test('previous browser quotes import into PostgreSQL without replacing existing versions', async ({
    browser,
    baseURL,
  }) => {
    const a = await browser.newContext({ baseURL }),
      b = await browser.newContext({ baseURL })
    try {
      const legacy = await a.newPage(),
        other = await b.newPage()
      await legacy.goto('/login/admin')
      const no = 'legacy-' + Date.now()
      await legacy.evaluate((no) => {
        const quote = {
          quoteNo: no,
          quoteNumber: no,
          version: 1,
          quoteDate: '2026-10-21',
          status: 'office-review',
          dealStatus: 'open',
          items: [
            {
              id: 'legacy-line',
              description: 'Legacy door',
              detail: '',
              room: 'Living',
              note: '',
              unitPrice: 650,
              finalPrice: 650,
              quantity: 1,
            },
          ],
          gstEnabled: true,
          roomPhotos: {},
          customer: {
            name: 'Imported browser customer',
            address: '5 Shared Street',
            phone: '0400000004',
            email: '',
          },
          shipSameAsBill: true,
          shipTo: { name: '', address: '', phone: '', email: '' },
          frameColour: 'White',
          customFrameColour: '',
          colourExtraOverride: null,
          paid: 0,
          issuedSnapshot: null,
        }
        localStorage.setItem(
          'smartquote-pro:archive',
          JSON.stringify([
            {
              quoteNo: no,
              version: 1,
              quote,
              total: 715,
              itemCount: 1,
              photosOmitted: false,
              comments: [],
              savedAt: new Date().toISOString(),
            },
          ]),
        )
        localStorage.setItem('smartquote-pro:quote', JSON.stringify(quote))
      }, no)
      await legacy.getByLabel('Email').fill('admin@goldco.com.au')
      await legacy.getByLabel('Password', { exact: true }).fill('admin')
      await legacy.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(legacy.getByRole('button', { name: 'Sign out' })).toBeVisible()
      await legacy.goto('/quotes')
      await legacy.getByRole('button', { name: 'Import previous browser quotes' }).click()
      await expect(legacy.getByRole('status')).toContainText('Imported 2 quote versions')
      await login(other, 'admin')
      await expect(other.getByRole('article', { name: 'Review ' + no, exact: true })).toBeVisible()
      await legacy.getByRole('button', { name: 'Import previous browser quotes' }).click()
      await expect(legacy.getByRole('status')).toContainText('Imported 0 quote versions')
    } finally {
      await a.close()
      await b.close()
    }
  })
})
