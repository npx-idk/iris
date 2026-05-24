import { Page } from 'playwright'
import { RunStep, StepLog } from './types'

export async function executeStep(
  page: Page,
  step: RunStep,
): Promise<Omit<StepLog, 'durationMs'>> {
  const base = {
    stepIndex: step.stepIndex,
    testStepId: step.id,
    description: step.description,
    action: step.action,
    selector: step.selector,
    selectorType: step.selectorType,
    value: step.value,
  }

  if (step.waitBefore && step.waitBefore > 0) {
    await page.waitForTimeout(step.waitBefore)
  }

  const timeout = step.timeoutMs ?? 10_000

  try {
    switch (step.action) {

      case 'NAVIGATE': {
        if (!step.value) throw new Error('NAVIGATE requires a value (URL)')
        await page.goto(step.value, { waitUntil: 'domcontentloaded', timeout })
        break
      }

      case 'CLICK': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.click({ timeout })
        break
      }

      case 'FILL': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.fill(step.value ?? '', { timeout })
        break
      }

      case 'SELECT': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.selectOption(step.value ?? '', { timeout })
        break
      }

      case 'CHECK': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        const checked = await loc.isChecked()
        if (step.value === 'false') {
          if (checked) await loc.uncheck({ timeout })
        } else {
          if (!checked) await loc.check({ timeout })
        }
        break
      }

      case 'HOVER': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        await loc.hover({ timeout })
        break
      }

      case 'PRESS_KEY': {
        if (step.selector) {
          await getLocator(page, step).press(step.value ?? 'Enter', { timeout })
        } else {
          await page.keyboard.press(step.value ?? 'Enter')
        }
        break
      }

      case 'WAIT': {
        const ms = Math.min(parseInt(step.value ?? '1000', 10), 30_000)
        await page.waitForTimeout(ms)
        break
      }

      case 'ASSERT_TEXT': {
        if (!step.value) throw new Error('ASSERT_TEXT requires a value')
        await page.getByText(step.value).first().waitFor({ state: 'visible', timeout })
        break
      }

      case 'ASSERT_VISIBLE': {
        const loc = getLocator(page, step)
        await loc.waitFor({ state: 'visible', timeout })
        if (!await loc.isVisible()) {
          throw new Error(`Element not visible: ${step.selector}`)
        }
        break
      }

      case 'ASSERT_URL': {
        const current = page.url()
        const expected = step.value ?? ''
        if (!current.includes(expected) && !new RegExp(expected).test(current)) {
          throw new Error(`URL mismatch — expected "${expected}", got "${current}"`)
        }
        break
      }

      case 'SCROLL': {
        if (step.selector) {
          await getLocator(page, step).scrollIntoViewIfNeeded({ timeout })
        } else {
          const dir = step.value ?? 'down'
          await page.evaluate((d) => window.scrollBy(0, d === 'down' ? 500 : -500), dir)
        }
        break
      }

      default:
        throw new Error(`Unknown action: ${step.action}`)
    }

    return { ...base, result: 'PASSED' }
  } catch (err) {
    return {
      ...base,
      result: 'FAILED',
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  }
}

function getLocator(page: Page, step: RunStep) {
  if (!step.selector) {
    throw new Error(`Step ${step.stepIndex} (${step.action}) requires a selector`)
  }
  return step.selectorType === 'XPATH'
    ? page.locator(`xpath=${step.selector}`)
    : page.locator(step.selector)
}
