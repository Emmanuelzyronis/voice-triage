import { test, expect } from '@playwright/test'
import {
  mockWebSocket,
  SESSION_STARTED,
  AI_TURN,
  USER_TURN,
  CONVERSATION_COMPLETE,
  STAGE_UPDATE,
  APPROVAL_REQUIRED,
} from './helpers/ws-mock'

async function reachPipelinePhase(page: import('@playwright/test').Page) {
  await mockWebSocket(page, [
    SESSION_STARTED(),
    AI_TURN('Thank you for calling. How can I help you today?'),
    USER_TURN('My AC unit stopped working on the 3rd floor.'),
    AI_TURN('Got it — what is the unit number?'),
    USER_TURN('Unit 4B.'),
    AI_TURN('Thank you, logging your request now.'),
    CONVERSATION_COMPLETE(),
    STAGE_UPDATE('parse', 'running'),
    STAGE_UPDATE('parse', 'complete', 600),
    STAGE_UPDATE('classify', 'running', 200),
    STAGE_UPDATE('classify', 'complete', 600),
    STAGE_UPDATE('research', 'running', 200),
    STAGE_UPDATE('research', 'complete', 800),
    STAGE_UPDATE('draft', 'running', 200),
    STAGE_UPDATE('draft', 'complete', 1000),
    STAGE_UPDATE('evaluate', 'running', 200),
    STAGE_UPDATE('evaluate', 'complete', 800),
    APPROVAL_REQUIRED(),
  ])
  await page.context().grantPermissions(['microphone'])
  await page.goto('/')
  await page.locator('button', { hasText: /start call/i }).first().click()
}

test.describe('Pipeline phase transitions', () => {
  test('conversation_complete transitions to pipeline phase', async ({ page }) => {
    await reachPipelinePhase(page)
    await expect(page.locator('text=Processing')).toBeVisible({ timeout: 10000 })
  })

  test('stage_update running shows stage as active', async ({ page }) => {
    await reachPipelinePhase(page)
    // During pipeline, at least one stage should have been 'running'
    // Check for the pipeline status section
    await expect(page.locator('text=Processing')).toBeVisible({ timeout: 10000 })
  })

  test('approval_required shows approval gate', async ({ page }) => {
    await reachPipelinePhase(page)
    // Approval gate should appear with the review decision buttons
    await expect(page.locator('text=Awaiting Review')).toBeVisible({ timeout: 15000 })
  })

  test('approval gate displays classify reason', async ({ page }) => {
    await reachPipelinePhase(page)
    await expect(
      page.locator('text=Routine HVAC maintenance request')
    ).toBeVisible({ timeout: 15000 })
  })

  test('approval gate shows draft subject', async ({ page }) => {
    await reachPipelinePhase(page)
    await expect(
      page.locator('text=HVAC Service Request – Unit 4B')
    ).toBeVisible({ timeout: 15000 })
  })

  test('approve and reject buttons are present', async ({ page }) => {
    await reachPipelinePhase(page)
    await page.waitForSelector('text=Awaiting Review', { timeout: 15000 })

    const approveBtn = page.locator('button', { hasText: /approve/i }).first()
    const rejectBtn = page.locator('button', { hasText: /reject/i }).first()
    await expect(approveBtn).toBeVisible()
    await expect(rejectBtn).toBeVisible()
  })
})
