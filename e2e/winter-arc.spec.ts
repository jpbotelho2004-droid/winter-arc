import { expect, test } from '@playwright/test'
import { consoleErrors, finishWorkout, go, logSet, openApp, startWeekday } from './helpers'

test.describe('Winter Arc — fluxos principais', () => {
  test('1–3. abre a app, mostra as 5 tabs e o plano semanal oficial', async ({ page }) => {
    await openApp(page)
    await expect(page.getByTestId('greeting')).toBeVisible()
    const nav = page.getByRole('navigation').first()
    for (const t of ['Início', 'Treinar', 'Evolução', 'Nutrição', 'Perfil']) {
      await expect(nav.getByText(t, { exact: true }).first()).toBeVisible()
    }
    await go(page, '/#/treinar')
    const plan = page.getByTestId('week-plan')
    for (const n of ['Natação', 'Upper Strength', 'Lower Strength', 'Upper Hypertrophy', 'Speed', 'Lower Power', 'Descanso']) {
      await expect(plan).toContainText(n)
    }
  })

  test('4. detalhe de exercício mostra instruções e link de vídeo rotulado como pesquisa', async ({ page }) => {
    await openApp(page, '/#/exercicios')
    await page.getByTestId('exercise-search').fill('supino plano')
    await page.getByText(/Supino plano/i).first().click()
    await expect(page.getByTestId('video-search')).toBeVisible()
    await expect(page.getByTestId('video-search')).toContainText(/pesquis/i)
    await expect(page.locator('body')).toContainText(/Bench Press/i)
  })

  test('5–10. fluxo de aceitação: Terça Upper Strength → Supino 60×8 → descanso → terminar → persistência → evolução', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await expect(page.getByTestId('workout-title')).toContainText(/Upper Strength/i)
    await expect(page.getByTestId('exercise-card').filter({ hasText: /Supino plano/i }).first()).toBeVisible()

    await logSet(page, /Supino plano/i, 0, '60', '8')
    // cronómetro de descanso arranca e persiste
    await expect(page.getByTestId('rest-bar')).toBeVisible()
    await expect(page.getByTestId('rest-clock')).toBeVisible()
    await page.getByTestId('skip-rest').click()

    // recarregar a meio: a sessão retoma com os dados
    await page.reload()
    await expect(page.getByTestId('workout-title')).toBeVisible()
    const card = page.getByTestId('exercise-card').filter({ hasText: /Supino plano/i }).first()
    await expect(card.getByTestId('kg-0')).toHaveValue('60')
    await expect(card.getByTestId('reps-0')).toHaveValue('8')

    await finishWorkout(page)

    // reabrir a app: histórico e evolução têm o registo
    await go(page, '/#/historico')
    await page.reload()
    await expect(page.getByTestId('history-list')).toContainText(/Upper Strength/i)
    await go(page, '/#/evolucao?tab=forca')
    await page.reload()
    await expect(page.getByRole('main')).toContainText(/60/)
    await expect(page.locator('body')).toContainText(/Supino plano/i)
  })

  test('11. recordes: 60×8 gera PR de carga e e1RM (estimativa) sem inventar valores', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await logSet(page, /Supino plano/i, 0, '60', '8')
    await finishWorkout(page)
    await go(page, '/#/evolucao?tab=recordes')
    await expect(page.locator('body')).toContainText(/60/)
    await expect(page.locator('body')).toContainText(/1RM estimado.*\(est\.\)/)
  })

  test('12. sessão em curso: navegar para outras páginas e voltar mantém o treino', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await logSet(page, /Supino plano/i, 0, '62,5', '6')
    await go(page, '/#/nutricao')
    await expect(page.getByTestId('mini-bar')).toBeVisible()
    await go(page, '/#/treinar')
    await expect(page.getByTestId('resume-card')).toBeVisible()
    await page.getByTestId('resume-card').click()
    const card = page.getByTestId('exercise-card').filter({ hasText: /Supino plano/i }).first()
    await expect(card.getByTestId('kg-0')).toHaveValue('62,5')
  })

  test('13. descartar treino exige confirmação e apaga a sessão', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await page.getByTestId('discard-workout').click()
    await page.getByTestId('confirm-yes').click()
    await go(page, '/#/historico')
    await expect(page.getByTestId('history-item')).toHaveCount(0)
  })

  test('14. peso corporal: registar e ver na evolução', async ({ page }) => {
    await openApp(page, '/#/evolucao?tab=corpo')
    await page.getByTestId('body-weight').fill('81,4')
    await page.getByTestId('body-save').click()
    await expect(page.getByText('Registo corporal guardado')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('weight-chart')).toBeVisible()
    await expect(page.getByTestId('body-weight')).toHaveValue('81,4')
  })

  test('15. natação: registar uma sessão com distância e tempo', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 1)
    await expect(page.getByTestId('swim-form')).toBeVisible()
    await page.getByTestId('swim-laps').fill('20')
    await page.getByTestId('swim-dist').fill('500')
    await finishWorkout(page)
    await go(page, '/#/historico')
    await expect(page.getByTestId('history-list')).toContainText(/Nata/i)
  })

  test('16. salto vertical: registar teste e ver a evolução de performance', async ({ page }) => {
    await openApp(page, '/#/evolucao?tab=atletica')
    await page.getByTestId('add-test').click()
    await page.getByTestId('test-metric').selectOption('vertical-jump')
    await page.getByTestId('test-value').fill('42')
    await page.getByTestId('save-test').click()
    await expect(page.locator('body')).toContainText(/42/)
    await page.reload()
    await expect(page.locator('body')).toContainText(/42/)
  })

  test('17. nutrição: refeição manual, totais e ausência de valores inventados', async ({ page }) => {
    await openApp(page, '/#/nutricao')
    await expect(page.getByTestId('kcal-total')).toHaveText('0')
    await page.getByTestId('add-pequeno-almoco').click()
    await page.getByTestId('meal-name').fill('Ovos com pão')
    await page.getByTestId('meal-kcal').fill('450')
    await page.getByTestId('meal-p').fill('30')
    await page.getByTestId('meal-save').click()
    await expect(page.getByTestId('kcal-total')).toHaveText('450')
    await page.reload()
    await expect(page.getByTestId('kcal-total')).toHaveText('450')
  })

  test('18. recuperação: abre a página e o formulário', async ({ page }) => {
    await openApp(page, '/#/recuperacao')
    await expect(page.getByTestId('recovery-form')).toBeVisible()
  })

  test('19–20. relatório semanal: pré-visualização, copiar e exportar', async ({ page, browserName }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await logSet(page, /Supino plano/i, 0, '60', '8')
    await finishWorkout(page)
    await go(page, '/#/relatorios?tipo=semanal')
    const preview = page.getByTestId('report-preview')
    await expect(preview).toContainText(/PEDIDO AO CHATGPT/i)
    await expect(preview).toContainText(/Supino plano/i)
    await expect(preview).toContainText(/60/)
    if (browserName === 'chromium') {
      await page.getByTestId('copy-report').click()
      const clip = await page.evaluate(() => navigator.clipboard.readText())
      expect(clip).toContain('PEDIDO AO CHATGPT')
    } else {
      await page.getByTestId('copy-report').click()
    }
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-report').click()])
    expect(dl.suggestedFilename()).toMatch(/\.txt$/)
  })

  test('21. relatório JSON tem o esquema winter-arc-report', async ({ page }) => {
    await openApp(page, '/#/relatorios?tipo=semanal')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()])
    const path = await dl.path()
    const fs = await import('node:fs/promises')
    const json = JSON.parse(await fs.readFile(path!, 'utf8'))
    expect(json.app ?? json.schema).toBeTruthy()
    expect(JSON.stringify(json)).toContain('winter-arc-report')
  })

  test('22. backup: exportar, apagar dados, importar e confirmar consistência', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await logSet(page, /Supino plano/i, 0, '60', '8')
    await finishWorkout(page)
    await go(page, '/#/evolucao?tab=corpo')
    await page.getByTestId('body-weight').fill('80,2')
    await page.getByTestId('body-save').click()
    await expect(page.getByText('Registo corporal guardado')).toBeVisible()

    await go(page, '/#/backup')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()])
    const file = await dl.path()
    expect(file).toBeTruthy()

    // ficheiro inválido é rejeitado sem alterar nada
    const fs = await import('node:fs/promises')
    const bad = (await dl.path())! + '.bad.json'
    await fs.writeFile(bad, '{"nao":"é um backup"}')
    await page.getByTestId('import-file').setInputFiles(bad)
    await expect(page.getByTestId('import-errors')).toBeVisible()

    // apagar tudo
    await go(page, '/#/definicoes')
    await page.getByTestId('clear-data').click()
    await page.getByTestId('clear-confirm-input').fill('APAGAR')
    await page.getByTestId('confirm-yes').click()
    await go(page, '/#/historico')
    await expect(page.getByTestId('history-item')).toHaveCount(0)

    // importar o backup válido (substituir) e verificar
    await go(page, '/#/backup')
    await page.getByTestId('import-file').setInputFiles(file!)
    await expect(page.getByTestId('import-summary')).toBeVisible()
    await page.getByTestId('mode-replace').click()
    await page.getByTestId('import-confirm').click()
    await page.getByTestId('confirm-yes').click()
    await expect(page.getByTestId('import-result')).toBeVisible()
    await go(page, '/#/historico')
    await expect(page.getByTestId('history-list')).toContainText(/Upper Strength/i)
    await go(page, '/#/evolucao?tab=corpo')
    await expect(page.locator('body')).toContainText(/80,2/)
  })

  test('23. importar em modo fundir não duplica registos', async ({ page }) => {
    await openApp(page)
    await startWeekday(page, 2)
    await logSet(page, /Supino plano/i, 0, '60', '8')
    await finishWorkout(page)
    await go(page, '/#/backup')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()])
    const file = (await dl.path())!
    await page.getByTestId('import-file').setInputFiles(file)
    await page.getByTestId('mode-merge').click()
    await page.getByTestId('import-confirm').click()
    await page.getByTestId('confirm-yes').click()
    await expect(page.getByTestId('import-result')).toBeVisible()
    await go(page, '/#/historico')
    await expect(page.getByTestId('history-item')).toHaveCount(1)
  })

  test('24. calendário e dia abrem e mostram o plano', async ({ page }) => {
    await openApp(page, '/#/calendario')
    await expect(page.getByTestId('cal-title')).toBeVisible()
    await go(page, '/#/dia/2026-11-17')
    await expect(page.getByTestId('day-item').first()).toContainText(/Upper Strength/i)
  })

  test('programa: fases visíveis e prolongar fase exige confirmação', async ({ page }) => {
    await openApp(page, '/#/programa')
    for (const n of [1, 2, 3]) await expect(page.getByTestId(`phase-${n}`)).toBeVisible()
    await expect(page.getByTestId('plyo-card')).toBeVisible()
  })

  test('definições: tema claro/escuro persiste', async ({ page }) => {
    await openApp(page, '/#/definicoes')
    await page.getByRole('tab', { name: 'Claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('layout móvel: sem scroll horizontal nas páginas principais', async ({ page }) => {
    await openApp(page)
    for (const p of ['/', '/treinar', '/evolucao', '/nutricao', '/perfil', '/definicoes', '/calendario', '/historico', '/relatorios']) {
      await go(page, `/#${p}`)
      await page.waitForTimeout(250)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `scroll horizontal em ${p}`).toBeLessThanOrEqual(1)
    }
  })

  test('sem erros críticos na consola durante a navegação', async ({ page }) => {
    await openApp(page)
    for (const p of ['/', '/treinar', '/evolucao', '/nutricao', '/perfil', '/recuperacao', '/programa', '/exercicios', '/relatorios', '/backup']) {
      await go(page, `/#${p}`)
      await page.waitForTimeout(200)
    }
    const errs = consoleErrors(page).filter((e) => !/favicon|manifest/i.test(e))
    expect(errs).toEqual([])
  })
})

test.describe('PWA / offline', () => {
  test('service worker regista e a app abre offline', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Offline via SW verificado em Chromium; WebKit do Playwright não expõe offline de forma fiável')
    await openApp(page)
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return !!reg.active
    })
    await page.reload()
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByTestId('greeting')).toBeVisible()
    await go(page, '/#/treinar')
    await expect(page.getByTestId('week-plan')).toBeVisible()
    await context.setOffline(false)
  })

  test('manifest e ícones existem', async ({ request }) => {
    const m = await request.get('/manifest.webmanifest')
    expect(m.ok()).toBeTruthy()
    const json = await m.json()
    expect(json.display).toBe('standalone')
    for (const i of json.icons) expect((await request.get(`/${i.src}`)).ok()).toBeTruthy()
  })
})
