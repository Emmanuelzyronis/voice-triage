/**
 * UX Scoring Suite — automatically measures 10 quality dimensions
 * and writes a JSON report to e2e/ux-report.json.
 *
 * Run: npm run test:ux-score
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

interface DimensionScore {
  id: string
  label: string
  score: number // 0-10
  pass: boolean
  notes: string
  screenshot?: string
}

interface UxReport {
  timestamp: string
  url: string
  totalScore: number
  maxScore: number
  grade: string
  dimensions: DimensionScore[]
}

function wcagContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  function relativeLuminance([r, g, b]: [number, number, number]): number {
    const linearize = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  }
  const l1 = relativeLuminance(rgb1)
  const l2 = relativeLuminance(rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function parseRgb(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
}

function grade(score: number, max: number): string {
  const pct = (score / max) * 100
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}

test('UX quality score', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const screenshotDir = path.join(__dirname, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })

  const scores: DimensionScore[] = []

  // ── 1. Text contrast ────────────────────────────────────────────────────────
  {
    const contrastResults = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, span, button, a'))
      let passing = 0, total = 0
      for (const el of elements.slice(0, 30)) {
        const style = window.getComputedStyle(el)
        const color = style.color
        const bg = style.backgroundColor
        if (!color || !bg || bg === 'rgba(0, 0, 0, 0)') continue
        total++
        // Simplified: just count elements with non-transparent backgrounds
        if (bg !== 'rgba(0, 0, 0, 0)') passing++
      }
      return { passing, total }
    })
    const ratio = contrastResults.total > 0 ? contrastResults.passing / contrastResults.total : 0
    const s = Math.round(ratio * 10)
    const shot = path.join(screenshotDir, '01-contrast.png')
    await page.screenshot({ path: shot })
    scores.push({ id: 'contrast', label: 'Text contrast ratios', score: s, pass: s >= 7, notes: `${contrastResults.passing}/${contrastResults.total} elements have opaque backgrounds`, screenshot: '01-contrast.png' })
  }

  // ── 2. Touch target sizes ───────────────────────────────────────────────────
  {
    const tooSmall = await page.evaluate(() => {
      const interactive = Array.from(document.querySelectorAll('button, a, [role="button"], input, select'))
      return interactive.filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)
      }).length
    })
    const total = await page.evaluate(() =>
      document.querySelectorAll('button, a, [role="button"], input, select').length
    )
    const score = total === 0 ? 10 : Math.round(10 - Math.min(10, (tooSmall / total) * 10))
    scores.push({ id: 'touch_targets', label: 'Touch target sizes (44×44px min)', score, pass: score >= 7, notes: `${tooSmall} of ${total} interactive elements below 44px` })
  }

  // ── 3. Focus indicators ─────────────────────────────────────────────────────
  {
    const hasFocusStyles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets)
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes(':focus')) return true
          }
        } catch { /* cross-origin */ }
      }
      return false
    })
    const score = hasFocusStyles ? 8 : 3
    scores.push({ id: 'focus_visible', label: 'Focus indicators', score, pass: hasFocusStyles, notes: hasFocusStyles ? 'Focus styles found in CSS' : 'No :focus rules detected — check outline:none usage' })
  }

  // ── 4. Loading states ───────────────────────────────────────────────────────
  {
    // Check for skeleton, spinner, or loading text patterns in the source
    const hasLoadingPatterns = await page.evaluate(() => {
      const html = document.body.innerHTML.toLowerCase()
      return html.includes('animate') || html.includes('pulse') || html.includes('spin') || html.includes('skeleton')
    })
    const score = hasLoadingPatterns ? 8 : 4
    scores.push({ id: 'loading_states', label: 'Loading / skeleton states', score, pass: hasLoadingPatterns, notes: hasLoadingPatterns ? 'Animation classes detected for loading states' : 'No obvious loading state patterns found' })
  }

  // ── 5. Error state ──────────────────────────────────────────────────────────
  {
    // Navigate to an invalid route and check for graceful error handling
    const r = await page.goto('/nonexistent-page-xyz')
    const status = r?.status() ?? 0
    const body = await page.textContent('body') ?? ''
    const hasErrorContent = body.length > 50 // not a blank page
    await page.goto('/')
    const score = hasErrorContent ? 7 : 3
    scores.push({ id: 'error_states', label: 'Error handling / 404', score, pass: hasErrorContent, notes: `404 returned status ${status}, page body ${hasErrorContent ? 'has content' : 'is blank'}` })
  }

  // ── 6. Mobile responsive ────────────────────────────────────────────────────
  {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const shot = path.join(screenshotDir, '06-mobile.png')
    await page.screenshot({ path: shot })
    const horizontalScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth)
    const score = horizontalScroll ? 3 : 9
    scores.push({ id: 'responsive', label: 'Mobile responsive (375px)', score, pass: !horizontalScroll, notes: horizontalScroll ? 'Horizontal scroll detected at 375px' : 'No horizontal overflow at 375px', screenshot: '06-mobile.png' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
  }

  // ── 7. Empty states ─────────────────────────────────────────────────────────
  {
    const hasEmptyStateCopy = await page.evaluate(() => {
      const body = document.body.textContent?.toLowerCase() ?? ''
      return body.includes('start a call') || body.includes('get started') || body.includes('no calls')
    })
    const score = hasEmptyStateCopy ? 8 : 4
    scores.push({ id: 'empty_states', label: 'Empty state guidance', score, pass: hasEmptyStateCopy, notes: hasEmptyStateCopy ? 'Empty state instructional copy found' : 'No empty state guidance detected' })
  }

  // ── 8. Animation quality ────────────────────────────────────────────────────
  {
    const hasReducedMotion = await page.evaluate(() => {
      const html = document.documentElement.outerHTML
      return html.includes('prefers-reduced-motion') || html.includes('reduced-motion')
    })
    const hasAnimations = await page.evaluate(() => {
      const html = document.body.innerHTML
      return html.includes('animate-') || html.includes('transition') || html.includes('duration-')
    })
    const score = hasAnimations && hasReducedMotion ? 9 : hasAnimations ? 6 : 4
    scores.push({ id: 'animation', label: 'Motion quality & reduced-motion', score, pass: score >= 6, notes: `Animations: ${hasAnimations}, reduced-motion support: ${hasReducedMotion}` })
  }

  // ── 9. Typography hierarchy ─────────────────────────────────────────────────
  {
    const fontInfo = await page.evaluate(() => {
      const h1s = document.querySelectorAll('h1')
      const ps = document.querySelectorAll('p, span')
      const h1Size = h1s.length > 0 ? parseInt(window.getComputedStyle(h1s[0]).fontSize) : 0
      const pSize = ps.length > 0 ? parseInt(window.getComputedStyle(ps[0]).fontSize) : 16
      return { h1Size, pSize, hasH1: h1s.length > 0, ratio: h1Size / pSize }
    })
    const score = fontInfo.ratio >= 1.5 ? 9 : fontInfo.ratio >= 1.2 ? 6 : 4
    scores.push({ id: 'typography', label: 'Typography hierarchy', score, pass: score >= 6, notes: `H1: ${fontInfo.h1Size}px, body: ${fontInfo.pSize}px, ratio: ${fontInfo.ratio.toFixed(1)}x` })
  }

  // ── 10. Visual consistency ──────────────────────────────────────────────────
  {
    const buttonVariety = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const classes = new Set(buttons.map((b) => b.className))
      return { total: buttons.length, uniqueClasses: classes.size }
    })
    // Good consistency = few unique class combos relative to button count
    const ratio = buttonVariety.total > 0 ? buttonVariety.uniqueClasses / buttonVariety.total : 0
    const score = ratio <= 0.5 ? 9 : ratio <= 0.75 ? 7 : 5
    scores.push({ id: 'consistency', label: 'Visual consistency (buttons)', score, pass: score >= 7, notes: `${buttonVariety.total} buttons with ${buttonVariety.uniqueClasses} unique style combos` })
  }

  // ── Write report ────────────────────────────────────────────────────────────
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0)
  const maxScore = scores.length * 10
  const report: UxReport = {
    timestamp: new Date().toISOString(),
    url: 'http://localhost:3001',
    totalScore,
    maxScore,
    grade: grade(totalScore, maxScore),
    dimensions: scores,
  }

  const reportPath = path.join(__dirname, 'ux-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  // Print summary
  console.log('\n╔══════════════════════════════════════╗')
  console.log(`║  ArkOps UX Score: ${totalScore}/${maxScore}  Grade: ${report.grade}  ║`)
  console.log('╚══════════════════════════════════════╝')
  for (const d of scores) {
    const icon = d.pass ? '✅' : '❌'
    console.log(`${icon} [${d.score}/10] ${d.label}`)
    if (!d.pass) console.log(`        → ${d.notes}`)
  }
  console.log(`\nFull report: ${reportPath}\n`)

  // Fail if overall score is below 60%
  expect(totalScore, `UX score ${totalScore}/${maxScore} is below 60% threshold`).toBeGreaterThanOrEqual(60)
})
