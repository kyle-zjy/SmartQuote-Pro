import type { Page } from '@playwright/test'
import { test, expect, resetApp, startNewQuote, addOpening, acceptDialogs } from './helpers'

async function storedImage(page: Page, quoteNo: string) {
  return page.evaluate((no) => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open('smartquote-pro', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const read = db.transaction('photos', 'readonly').objectStore('photos').get(`${no}:v1`)
      read.onsuccess = () => {
        const images = Object.values(read.result ?? {}).flat() as Array<{ dataUrl: string }>
        resolve(images[0]?.dataUrl ?? null)
        db.close()
      }
      read.onerror = () => { db.close(); reject(read.error) }
    }
  }), quoteNo)
}

async function addRoomPhoto(page: Page) {
  await resetApp(page)
  await startNewQuote(page)
  await addOpening(page)
  const quoteNo = page.url().split('/').pop()!
  await page.getByLabel('Living Room room photos', { exact: true }).setInputFiles({
    name: 'room.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'),
  })
  await expect(page.locator('.room-photo-thumb img')).toHaveAttribute('src', /^data:image/)
  await expect.poll(() => storedImage(page, quoteNo)).toMatch(/^data:image/)
  return { quoteNo }
}

test('room photos and edited captions survive reloading a draft', async ({ page }) => {
  const { quoteNo } = await addRoomPhoto(page)
  await page.locator('.room-photo-thumb').click()
  await page.getByLabel('Note', { exact: true }).fill('Updated caption')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForFunction(() => localStorage.getItem('smartquote-pro:quote')?.includes('Updated caption'))
  await page.reload()
  await expect(page.locator('.room-photo-thumb img')).toHaveAttribute('src', /^data:image/)
  await expect(page.locator('.room-photo-thumb img')).toHaveAttribute('alt', 'Updated caption')
  expect(await storedImage(page, quoteNo)).toMatch(/^data:image/)
})

test('switching quotes preserves the prior photo cache and restores an archive without image bytes', async ({ page }) => {
  acceptDialogs(page)
  const { quoteNo } = await addRoomPhoto(page)
  await page.getByRole('button', { name: 'Save quote', exact: true }).click()
  await expect(page.getByText('Saved on this browser. Open it later from Quotes.', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('smartquote-pro:archive')!)
    for (const photos of Object.values(records[0].quote.roomPhotos) as Array<Array<{ dataUrl: string }>>) {
      photos.forEach((photo) => { photo.dataUrl = '' })
    }
    localStorage.setItem('smartquote-pro:archive', JSON.stringify(records))
  })
  // Opening the current quote must also hydrate: its number and version have not changed.
  await page.goto('/quotes')
  await page.locator('.saved-quote-card').getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.locator('.room-photo-thumb img')).toHaveAttribute('src', /^data:image/)
  await startNewQuote(page)
  expect(await storedImage(page, quoteNo)).toMatch(/^data:image/)
  await page.goto('/quotes')
  await page.locator('.saved-quote-card').getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.locator('.room-photo-thumb img')).toHaveAttribute('src', /^data:image/)
})

test('failed photo storage can be retried without discarding uploaded images', async ({ page }) => {
  const { quoteNo } = await addRoomPhoto(page)
  await page.evaluate(() => {
    const original = IDBFactory.prototype.open
    Object.defineProperty(window, 'restorePhotoStorage', { value: () => { IDBFactory.prototype.open = original } })
    IDBFactory.prototype.open = function () { throw new DOMException('Storage unavailable', 'UnknownError') }
  })
  await page.getByLabel('Living Room room photos', { exact: true }).setInputFiles({
    name: 'another-room.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'),
  })
  await expect(page.locator('.room-photo-thumb')).toHaveCount(2)
  await expect(page.getByRole('alert')).toContainText('photos could not be saved')
  await page.evaluate(() => { (window as unknown as { restorePhotoStorage: () => void }).restorePhotoStorage() })
  await page.getByRole('button', { name: 'Retry photo storage' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(() => storedImage(page, quoteNo)).toMatch(/^data:image/)
  await page.reload()
  await expect(page.locator('.room-photo-thumb img')).toHaveCount(2)
  await expect(page.locator('.room-photo-thumb img').nth(1)).toHaveAttribute('src', /^data:image/)
})
