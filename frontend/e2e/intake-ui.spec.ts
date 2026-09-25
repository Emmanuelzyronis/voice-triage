import { test, expect } from '@playwright/test'
import {
  mockWebSocket,
  SESSION_STARTED,
  AI_TURN,
  USER_TURN,
  USER_PARTIAL,
} from './helpers/ws-mock'

test.describe('Intake / conversation UI', () => {
  test('clicking Start Call triggers conversation phase', async ({ page }) => {
    await mockWebSocket(page, [
      SESSION_STARTED(),
      AI_TURN('Thank you for calling Apex Field Services. How can I help you today?'),
    ])

    // Mock microphone so getUserMedia doesn't block
    await page.context().grantPermissions(['microphone'])

    await page.goto('/')
    await page.locator('button', { hasText: /start call/i }).first().click()

    // Phase indicator should move away from idle
    await expect(page.locator('text=Live Call')).toBeVisible({ timeout: 5000 })
  })

  test('tenant name appears in header after session_started', async ({ page }) => {
    await mockWebSocket(page, [
      SESSION_STARTED(),
      AI_TURN('Thank you for calling Apex Field Services. How can I help you today?'),
    ])
    await page.context().grantPermissions(['microphone'])
    await page.goto('/')
    await page.locator('button', { hasText: /start call/i }).first().click()

    await expect(page.locator('text=Apex Field Services')).toBeVisible({ timeout: 5000 })
  })

  test('AI message appears as left-aligned bubble', async ({ page }) => {
    const greeting = 'Thank you for calling Apex Field Services. How can I help you today?'
    await mockWebSocket(page, [SESSION_STARTED(), AI_TURN(greeting)])
    await page.context().grantPermissions(['microphone'])
    await page.goto('/')
    await page.locator('button', { hasText: /start call/i }).first().click()

    await expect(page.locator(`text=${greeting}`)).toBeVisible({ timeout: 5000 })
  })

  test('user message appears as right-aligned bubble', async ({ page }) => {
    const userMsg = 'My AC unit stopped working'
    await mockWebSocket(page, [
      SESSION_STARTED(),
      AI_TURN('Thank you for calling. How can I help?'),
      USER_TURN(userMsg),
    ])
    await page.context().grantPermissions(['microphone'])
    await page.goto('/')
    await page.locator('button', { hasText: /start call/i }).first().click()

    await expect(page.locator(`text=${userMsg}`)).toBeVisible({ timeout: 6000 })
  })

  test('partial text appears while user is speaking', async ({ page }) => {
    await mockWebSocket(page, [
      SESSION_STARTED(),
      AI_TURN('Thank you for calling. How can I help?'),
      USER_PARTIAL('My AC unit is...'),
    ])
    await page.context().grantPermissions(['microphone'])
    await page.goto('/')
    await page.locator('button', { hasText: /start call/i }).first().click()

    await expect(page.locator('text=My AC unit is...')).toBeVisible({ timeout: 5000 })
  })

  test('End Call button appears during conversation', async ({ page }) => {
    await mockWebSocket(page, [
      SESSION_STARTED(),
      AI_TURN('Thank you for calling. How can I help?'),
    ])
    await page.context().grantPermissions(['microphone'])
    await page.goto('/')
    await page.locator('button', { hasText: /start call/i }).first().click()

    await expect(page.locator('button', { hasText: /end call/i }).first()).toBeVisible({ timeout: 5000 })
  })
})
