import { expect, type Page } from '@playwright/test'

let patched = false
/**
 * No emulador iPhone do WebKit do Playwright, `click()` falha até em páginas mínimas
 * ("<html> intercepts pointer events"), enquanto `tap()` funciona e é o que um iPhone real faz.
 * Nesse caso, os cliques passam a toques.
 */
function useTapsOnMobileWebkit(page: Page) {
  if (patched) return
  const isWebkit = page.context().browser()?.browserType().name() === 'webkit'
  if (!isWebkit) return
  const proto = Object.getPrototypeOf(page.locator('body')) as { click: unknown; tap: (o?: unknown) => Promise<void> }
  proto.click = function (this: { tap: (o?: unknown) => Promise<void> }, opts?: { timeout?: number }) {
    return this.tap(opts?.timeout ? { timeout: opts.timeout } : undefined)
  }
  patched = true
}

/** Abre a app, falha em erros de consola e conclui o onboarding. */
export async function openApp(page: Page, path = '/') {
  useTapsOnMobileWebkit(page)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  ;(page as unknown as { __errors: string[] }).__errors = errors
  await page.goto('/')
  const save = page.getByTestId('onboarding-save')
  await expect(save.or(page.getByTestId('greeting')).first()).toBeVisible({ timeout: 15_000 })
  if (await save.isVisible()) {
    await save.click()
    await expect(save).toBeHidden()
  }
  if (path !== '/') await go(page, path)
  return errors
}

/** Navega dentro da SPA (HashRouter). `page.goto` só com mudança de hash bloqueia no WebKit. */
export async function go(page: Page, path: string) {
  const hash = path.startsWith('/#') ? path.slice(1) : `#${path}`
  await page.evaluate((h) => {
    location.hash = h
  }, hash)
  await page.waitForTimeout(50)
}

export function consoleErrors(page: Page): string[] {
  return (page as unknown as { __errors?: string[] }).__errors ?? []
}

/** Inicia o treino do dia da semana (1 = segunda … 7 = domingo) a partir de Treinar. */
export async function startWeekday(page: Page, weekday: number) {
  await go(page, '/#/treinar')
  await page.getByTestId(`start-${weekday}`).click()
  await expect(page.getByTestId('workout-title')).toBeVisible()
}

/** Regista kg × reps na série `i` do cartão de exercício que contém `name` e marca-a feita. */
export async function logSet(page: Page, name: string | RegExp, i: number, kg: string, reps: string) {
  const card = page.getByTestId('exercise-card').filter({ hasText: name }).first()
  await card.getByTestId(`kg-${i}`).fill(kg)
  await card.getByTestId(`reps-${i}`).fill(reps)
  await card.getByTestId(`done-${i}`).click()
}

export async function finishWorkout(page: Page) {
  await page.getByTestId('finish-workout').click()
  await page.getByTestId('confirm-finish').click()
  await expect(page.getByTestId('just-finished')).toBeVisible()
}
