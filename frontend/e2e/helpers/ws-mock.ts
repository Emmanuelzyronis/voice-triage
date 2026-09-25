import type { Page } from '@playwright/test'

export interface WsMessage {
  payload: object
  delay?: number // ms before sending, default 200
}

/**
 * Intercepts the ArkOps WebSocket and replays a scripted message sequence.
 * Also silently absorbs any bytes the client sends (audio chunks, "STOP").
 */
export async function mockWebSocket(page: Page, messages: WsMessage[]) {
  await page.routeWebSocket(/ws:\/\/localhost:8001\/ws\//, (ws) => {
    // Absorb outbound messages silently
    ws.onMessage(() => {})

    // Stream scripted messages with delays
    ;(async () => {
      for (const { payload, delay = 200 } of messages) {
        await new Promise((r) => setTimeout(r, delay))
        ws.send(JSON.stringify(payload))
      }
    })()
  })
}

/** Standard server boot sequence every test needs */
export const SESSION_STARTED = (stateId = 'test-state-001'): WsMessage => ({
  payload: { type: 'session_started', state_id: stateId, tenant: 'Apex Field Services' },
  delay: 100,
})

export const AI_TURN = (text: string, delay = 400): WsMessage => ({
  payload: { type: 'conversation_turn', role: 'assistant', text },
  delay,
})

export const USER_TURN = (text: string, delay = 600): WsMessage => ({
  payload: { type: 'conversation_turn', role: 'user', text },
  delay,
})

export const USER_PARTIAL = (text: string, delay = 200): WsMessage => ({
  payload: { type: 'user_partial', text },
  delay,
})

export const CONVERSATION_COMPLETE = (stateId = 'test-state-001'): WsMessage => ({
  payload: { type: 'conversation_complete', state_id: stateId },
  delay: 300,
})

export const STAGE_UPDATE = (stage: string, status: 'running' | 'complete', delay = 300): WsMessage => ({
  payload: { type: 'stage_update', stage, status },
  delay,
})

export const APPROVAL_REQUIRED = (stateId = 'test-state-001'): WsMessage => ({
  payload: {
    type: 'approval_required',
    state_id: stateId,
    category: 'standard',
    classify_reason: 'Routine HVAC maintenance request',
    parsed: {
      intent: 'AC unit not cooling',
      entities: ['AC unit', '3rd floor', 'unit 4B'],
      urgency: 'medium',
    },
    draft: {
      subject: 'HVAC Service Request – Unit 4B',
      body: 'Customer reports AC unit on 3rd floor not cooling. Technician dispatch recommended.',
      action_items: ['Dispatch technician', 'Confirm appointment window', 'Update work order system'],
    },
    evaluation: {
      recommendation: 'approve',
      confidence: 0.92,
      notes: 'Clear request, sufficient information gathered.',
    },
  },
  delay: 400,
})
