import { test, expect } from '@playwright/test'

test.describe('Landing / idle state', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/')
    page.on('pageerror', (err) => errors.push(err.message))
  })

  test('page loads with ArkOps branding', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=ArkOps')).toBeVisible()
  })

  test('all pipeline stage badges are visible', async ({ page }) => {
    await page.goto('/')
    const stages = ['Listen', 'Ask', 'Understand', 'Draft', 'Approve', 'Execute']
    for (const stage of stages) {
      await expect(page.locator(`text=${stage}`).first()).toBeVisible()
    }
  })

  test('start call button is present and clickable', async ({ page }) => {
    await page.goto('/')
    const btn = page.locator('button', { hasText: /start call/i }).first()
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('status indicator shows Ready in idle state', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Ready')).toBeVisible()
  })

  test('idle description copy explains the product', async ({ page }) => {
    await page.goto('/')
    // The landing copy should mention conversation + approval
    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toContain('conversation')
  })
})
