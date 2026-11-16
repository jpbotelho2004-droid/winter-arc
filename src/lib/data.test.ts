import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { importBackup, exportBackup, parseBackupText, planImport, validateBackup } from './backup'
import { db } from './db'
import {
  discardSession,
  ensureSeeded,
  exerciseMap,
  finishSession,
  getActiveSession,
  saveSession,
  startSessionFromTemplate,
  upsertBodyLog,
  addMeal,
  addAssessment,
  upsertRecovery,
  updateSettings,
} from './repo'
import { addSet, toggleSetDone, updateSet, finalStatus } from './sessionOps'
import { plannedTemplatesForDate } from './program'
import { buildDailyReport, buildExerciseReport, buildJsonReport, buildMonthlyReport, buildPerformanceReport, buildWeeklyReport } from './reports'
import { loadSnapshot } from './snapshot'
import { allExercisePRs, exerciseHistory, exerciseSummary, perfRecord, prsInSession, recordProgression, recoveryAdvice } from './stats'
import { startOfWeek } from './dates'

async function reset() {
  await db.delete()
  await db.open()
  await ensureSeeded()
  // programa a começar na semana de 2026-11-09 (fase 2 para ter volume completo nos testes)
  await updateSettings({ program: { startDate: '2026-09-07', phaseStarts: [3, 5, 9], plyoLevel: 1 } })
}

/** Cria e termina uma sessão de Push com supino 60×8 ×3. */
async function doPush(date: string, weights = [60, 60, 60], reps = [8, 8, 7]) {
  let s = await startSessionFromTemplate('tpl-push', date)
  const sup = s.exercises[0]
  expect(sup.exerciseId).toBe('supino-plano')
  sup.sets.forEach((set, i) => {
    s = updateSet(s, sup.id, set.id, { weightKg: weights[i], reps: reps[i], rpe: 8 })
    s = toggleSetDone(s, sup.id, set.id, Date.parse(`${date}T10:00:00Z`) + i * 1000)
  })
  await saveSession(s)
  return (await finishSession(s.id, { notes: 'Boa sessão', rpe: 8 }))!
}

beforeEach(reset)

describe('arranque', () => {
  it('cria definições e plano oficial, mas nenhum dado de treino', async () => {
    expect(await db.templates.count()).toBe(7)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.bodyLogs.count()).toBe(0)
    const s = (await db.settings.get('main'))!
    expect(s.heightCm).toBe(181)
    expect(s.startWeightKg).toBe(80)
    expect(s.nutrition).toEqual({ kcal: 2600, protein: 160, fat: 75, carbs: 320 })
  })
  it('ensureSeeded é idempotente e não apaga alterações do utilizador', async () => {
    await updateSettings({ displayName: 'João' })
    await ensureSeeded()
    expect((await db.settings.get('main'))!.displayName).toBe('João')
  })
})

describe('migração para o programa v2', () => {
  /** Simula uma instalação com o plano antigo: modelos v1, fases [3,7] e uma sessão já feita. */
  async function makeV1State() {
    const old = (id: string, name: string, weekday: number) => ({ id, name, kind: 'strength' as const, weekday, exercises: [], updatedAt: 1 })
    await db.templates.clear()
    await db.templates.bulkPut([old('tpl-upper-strength', 'Upper Strength', 2), old('tpl-lower-strength', 'Lower Strength', 3), old('tpl-upper-hyp', 'Upper Hypertrophy', 4), old('tpl-speed', 'Speed & Agility', 5), old('tpl-lower-power', 'Lower Power', 6)])
    const cur = (await db.settings.get('main'))!
    await db.settings.put({ ...cur, programVersion: undefined, program: { ...cur.program, phaseStarts: [3, 7] as unknown as [number, number, number] } })
    const sess = {
      id: 'old-1',
      date: '2026-11-10',
      templateId: 'tpl-upper-strength',
      name: 'Upper Strength',
      kind: 'strength',
      status: 'completed',
      startedAt: 1,
      endedAt: 2,
      updatedAt: 2,
      exercises: [{ id: 'e1', exerciseId: 'supino-plano', name: 'Supino plano', logType: 'strength', restSec: 120, sets: [{ id: 's1', type: 'work', weightKg: 60, reps: 8, done: true }] }],
    }
    await db.sessions.put(sess as never)
  }

  it('arquiva o plano antigo, acrescenta o novo e preserva todo o histórico', async () => {
    await makeV1State()
    await ensureSeeded()
    const tpls = await db.templates.toArray()
    for (const id of ['tpl-upper-strength', 'tpl-lower-strength', 'tpl-upper-hyp', 'tpl-speed', 'tpl-lower-power']) {
      expect(tpls.find((t) => t.id === id)?.archived, id).toBe(true) // arquivado, não apagado
    }
    for (const id of ['tpl-swim', 'tpl-push', 'tpl-pull', 'tpl-lower-vj', 'tpl-upper-core', 'tpl-lower-speed', 'tpl-rest']) expect(tpls.find((t) => t.id === id)?.archived).toBeFalsy()
    const sess = await db.sessions.get('old-1')
    expect(sess?.status).toBe('completed')
    expect(sess?.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 8 })
    const snap = await loadSnapshot()
    // terça-feira passa a mostrar o Push (o plano antigo já não é planeado)
    expect(plannedTemplatesForDate('2026-11-17', snap.templates, snap.schedule).map((t) => t.name)).toEqual(['Push'])
    // o histórico do supino continua visível
    expect(exerciseHistory(snap.sessions, 'supino-plano')).toHaveLength(1)
  })
  it('converte as fases antigas [3,7] → 4 fases e é idempotente', async () => {
    await makeV1State()
    await ensureSeeded()
    expect((await db.settings.get('main'))!.program.phaseStarts).toEqual([3, 5, 9])
    expect((await db.settings.get('main'))!.programVersion).toBe(2)
    const before = await db.templates.count()
    await ensureSeeded()
    await ensureSeeded()
    expect(await db.templates.count()).toBe(before)
    expect((await db.settings.get('main'))!.program.phaseStarts).toEqual([3, 5, 9])
  })
  it('não apaga treinos personalizados nem altera os modelos v2 do utilizador', async () => {
    await db.templates.put({ id: 'custom-1', name: 'Meu treino', kind: 'strength', weekday: 7, exercises: [], updatedAt: 5 })
    const push = (await db.templates.get('tpl-push'))!
    await db.templates.put({ ...push, name: 'Push personalizado' })
    await ensureSeeded()
    expect(await db.templates.get('custom-1')).toBeDefined()
    expect((await db.templates.get('tpl-push'))!.name).toBe('Push personalizado')
  })
  it('importar uma cópia antiga (plano v1) também migra para o programa novo', async () => {
    await makeV1State()
    const file = await exportBackup()
    await db.delete()
    await db.open()
    await importBackup(file, 'replace')
    expect((await db.templates.get('tpl-push'))?.archived).toBeFalsy()
    expect((await db.templates.get('tpl-upper-strength'))?.archived).toBe(true)
    expect((await db.settings.get('main'))!.program.phaseStarts).toEqual([3, 5, 9])
    expect(await db.sessions.count()).toBe(1)
  })
})

describe('variantes, opcionais e saltos (programa v2)', () => {
  it('sábado variante A: Pogo + Broad Jump; sem sprints; variante B: acelerações; fase 4 inclui Sprint 20 m', async () => {
    const a = await startSessionFromTemplate('tpl-lower-speed', '2026-11-14', 'A')
    const idsA = a.exercises.map((e) => e.exerciseId)
    expect(a.variant).toBe('A')
    expect(idsA).toContain('pogo-jumps')
    expect(idsA).toContain('salto-horizontal')
    expect(idsA).not.toContain('aceleracao')
    expect(idsA).not.toContain('sprint-20m')
    expect(idsA.indexOf('pogo-jumps')).toBeLessThan(idsA.indexOf('leg-press')) // explosivo antes do pesado
    await discardSession(a.id)
    const b = await startSessionFromTemplate('tpl-lower-speed', '2026-11-14', 'B')
    const idsB = b.exercises.map((e) => e.exerciseId)
    expect(b.variant).toBe('B')
    expect(idsB).toContain('aceleracao')
    expect(idsB).toContain('sprint-20m')
    expect(idsB).not.toContain('pogo-jumps')
    expect(b.exercises.find((e) => e.exerciseId === 'sprint-20m')!.sets).toHaveLength(5)
  })
  it('na semana 1, o volume da sessão é reduzido e o Box Jump/sprints ainda não aparecem', async () => {
    await updateSettings({ program: { startDate: '2026-11-09', phaseStarts: [3, 5, 9], plyoLevel: 1 } })
    const l = await startSessionFromTemplate('tpl-lower-vj', '2026-11-12')
    expect(l.phase).toBe(1)
    expect(l.exercises.map((e) => e.exerciseId)).not.toContain('salto-caixa')
    const sq = l.exercises.find((e) => e.exerciseId === 'agachamento')!
    expect(sq.sets.length).toBeLessThanOrEqual(2)
    expect(l.exercises.find((e) => e.exerciseId === 'salto-vertical')!.sets).toHaveLength(2)
    await discardSession(l.id)
    const sat = await startSessionFromTemplate('tpl-lower-speed', '2026-11-14', 'B')
    expect(sat.exercises.map((e) => e.exerciseId)).not.toContain('sprint-20m')
  })
  it('o cardio opcional da sexta não impede a sessão de ficar concluída; o resto sim', async () => {
    let s = await startSessionFromTemplate('tpl-upper-core', '2026-11-13')
    const cardio = s.exercises.find((e) => e.exerciseId === 'bicicleta-estatica')!
    expect(cardio.optional).toBe(true)
    for (const e of s.exercises) if (!e.optional) s = toggleSetDone(s, e.id, e.sets[0].id)
    expect(finalStatus(s)).toBe('completed') // sem o cardio
    // com uma série obrigatória por fazer → parcial
    const first = s.exercises[0]
    s = toggleSetDone(s, first.id, first.sets[0].id)
    expect(finalStatus(s)).toBe('partial')
  })
  it('relatório mostra fase, variante, opcional e séries planeadas vs realizadas', async () => {
    let s = await startSessionFromTemplate('tpl-upper-core', '2026-11-13')
    for (const e of s.exercises) if (!e.optional) s = toggleSetDone(s, e.id, e.sets[0].id)
    const cardio = s.exercises.find((e) => e.optional)!
    s = updateSet(s, cardio.id, cardio.sets[0].id, { timeS: 900, done: true })
    await saveSession(s)
    await finishSession(s.id)
    const txt = buildDailyReport(await loadSnapshot(), '2026-11-13')
    expect(txt).toMatch(/Séries planeadas vs realizadas: 7\/21 \(\+ 1 de exercícios opcionais\)/)
    expect(txt).toMatch(/\[opcional\]/)
    expect(txt).toMatch(/15 min/)
    expect(txt).not.toMatch(/NaN|undefined/)
  })
  it('Box Jump guarda a altura da caixa e não conta como altura de salto', async () => {
    let s = await startSessionFromTemplate('tpl-lower-vj', '2026-11-11')
    const box = s.exercises.find((e) => e.exerciseId === 'salto-caixa')!
    s = updateSet(s, box.id, box.sets[0].id, { reps: 3, boxCm: 40, done: true })
    await saveSession(s)
    await finishSession(s.id)
    const snap = await loadSnapshot()
    expect(perfRecord(snap, 'vertical-jump')?.points ?? []).toHaveLength(0)
    const txt = buildJsonReport(snap, '2026-11-09', '2026-11-15')
    expect(JSON.stringify(txt.sessions[0].exercises.find((e) => e.exerciseId === 'salto-caixa')!.sets[0])).toContain('"boxCm":40')
  })
})

describe('sessão de treino', () => {
  it('iniciar, registar 60 kg × 8, terminar e encontrar os dados', async () => {
    const s = await doPush('2026-11-10')
    expect(s.status).toBe('partial') // só o supino foi feito; os outros exercícios ficaram vazios
    const all = await db.sessions.toArray()
    expect(all).toHaveLength(1)
    const sup = all[0].exercises.find((e) => e.exerciseId === 'supino-plano')!
    expect(sup.sets.map((x) => [x.weightKg, x.reps, x.done])).toEqual([
      [60, 8, true],
      [60, 8, true],
      [60, 7, true],
    ])
  })
  it('só existe uma sessão ativa; retoma a existente', async () => {
    const a = await startSessionFromTemplate('tpl-push', '2026-11-10')
    const b = await startSessionFromTemplate('tpl-upper-core', '2026-11-10')
    expect(b.id).toBe(a.id)
    expect((await getActiveSession())?.id).toBe(a.id)
  })
  it('descartar remove a sessão ativa; terminar não apaga outras', async () => {
    await doPush('2026-11-10')
    const a = await startSessionFromTemplate('tpl-upper-core', '2026-11-12')
    await discardSession(a.id)
    expect(await getActiveSession()).toBeUndefined()
    expect(await db.sessions.count()).toBe(1)
  })
  it('descanso arranca ao concluir uma série e usa timestamps', async () => {
    let s = await startSessionFromTemplate('tpl-push', '2026-11-10')
    const ex = s.exercises[0]
    s = toggleSetDone(s, ex.id, ex.sets[0].id, 1_000_000)
    expect(s.rest?.endsAt).toBe(1_000_000 + ex.restSec * 1000)
    s = toggleSetDone(s, ex.id, ex.sets[0].id, 2_000_000) // desmarcar
    expect(s.exercises[0].sets[0].done).toBe(false)
  })
  it('adicionar série não copia valores realizados', async () => {
    let s = await startSessionFromTemplate('tpl-push', '2026-11-10')
    const ex = s.exercises[0]
    s = updateSet(s, ex.id, ex.sets[0].id, { weightKg: 60, reps: 8, done: true })
    s = addSet(s, ex.id)
    const added = s.exercises[0].sets[s.exercises[0].sets.length - 1]
    expect(added.weightKg).toBeUndefined()
    expect(added.done).toBe(false)
  })
  it('estado parcial vs concluído', async () => {
    let s = await startSessionFromTemplate('tpl-push', '2026-11-10')
    expect(finalStatus(s)).toBe('partial')
    for (const e of s.exercises) s = toggleSetDone(s, e.id, e.sets[0].id)
    expect(finalStatus(s)).toBe('completed')
  })
})

describe('histórico, progressão e recordes', () => {
  it('resumo do exercício e e1RM estimado', async () => {
    await doPush('2026-11-10')
    await doPush('2026-11-17', [62.5, 62.5, 62.5], [8, 8, 8])
    const snap = await loadSnapshot()
    const h = exerciseHistory(snap.sessions, 'supino-plano')
    expect(h).toHaveLength(2)
    const sum = exerciseSummary(h, snap.exMap.get('supino-plano'))
    expect(sum.heaviest).toMatchObject({ weightKg: 62.5, reps: 8, date: '2026-11-17' })
    expect(sum.e1rm?.value).toBeCloseTo(62.5 * (1 + 8 / 30), 1)
    expect(sum.series.map((p) => p.topWeight)).toEqual([60, 62.5])
    expect(sum.bestSessionVolume?.volumeKg).toBe(62.5 * 8 * 3)
  })
  it('recorde só é marcado quando supera sessões anteriores', async () => {
    const first = await doPush('2026-11-10')
    const second = await doPush('2026-11-17', [62.5, 62.5, 62.5], [8, 8, 8])
    const snap = await loadSnapshot()
    expect(prsInSession(snap, snap.sessions.find((s) => s.id === first.id)!)).toEqual([]) // primeira vez: sem "recorde batido"
    expect(prsInSession(snap, snap.sessions.find((s) => s.id === second.id)!).join()).toMatch(/maior carga 62.5/)
  })
  it('lista de PRs por exercício', async () => {
    await doPush('2026-11-10')
    const prs = allExercisePRs(await loadSnapshot())
    expect(prs.map((p) => p.exerciseId)).toEqual(['supino-plano'])
  })
  it('recordProgression: melhor anterior e direção (máx./mín.)', () => {
    const p = [
      { date: '2026-11-01', value: 3.5 },
      { date: '2026-11-08', value: 3.6 },
      { date: '2026-11-15', value: 3.4 },
    ]
    expect(recordProgression(p, 'min').map((r) => [r.value, r.previous])).toEqual([
      [3.5, undefined],
      [3.4, 3.5],
    ])
    expect(recordProgression(p, 'max').map((r) => r.value)).toEqual([3.5, 3.6])
  })
})

describe('performance atlética', () => {
  it('salto vertical medido numa sessão gera recorde; não medido não gera', async () => {
    let s = await startSessionFromTemplate('tpl-lower-vj', '2026-11-11')
    const jump = s.exercises.find((e) => e.exerciseId === 'salto-vertical')!
    s = updateSet(s, jump.id, jump.sets[0].id, { reps: 3, heightCm: 42.5, done: true })
    s = updateSet(s, jump.id, jump.sets[1].id, { reps: 3, done: true }) // não medido
    await saveSession(s)
    await finishSession(s.id)
    const snap = await loadSnapshot()
    const rec = perfRecord(snap, 'vertical-jump')!
    expect(rec.points).toHaveLength(1)
    expect(rec.current?.value).toBe(42.5)
  })
  it('sprints de distâncias diferentes são métricas separadas', async () => {
    await addAssessment({ date: '2026-11-13', metric: 'sprint-10', value: 2.1, unit: 's' })
    await addAssessment({ date: '2026-11-13', metric: 'sprint-20', value: 3.5, unit: 's' })
    const snap = await loadSnapshot()
    expect(perfRecord(snap, 'sprint-10')!.current?.value).toBe(2.1)
    expect(perfRecord(snap, 'sprint-20')!.current?.value).toBe(3.5)
  })
  it('natação: ritmo e distância a partir da sessão', async () => {
    let s = await startSessionFromTemplate('tpl-swim', '2026-11-09')
    s = { ...s, swim: { pool: 25, distanceM: 400, totalSec: 1800, effectiveSec: 840, stroke: 'Crol' } }
    await saveSession(s)
    await finishSession(s.id)
    const snap = await loadSnapshot()
    expect(perfRecord(snap, 'swim-distance')!.current?.value).toBe(400)
    expect(perfRecord(snap, 'swim-pace')!.current?.value).toBe(210)
  })
})

describe('recuperação', () => {
  it('dor articular elevada gera recomendação prudente sem diagnóstico', async () => {
    await upsertRecovery('2026-11-13', { jointPain: 4, jointPainWhere: 'joelho direito', fatigue: 3 })
    const snap = await loadSnapshot()
    const adv = recoveryAdvice(snap.recovery, '2026-11-13')
    expect(adv.level).toBe('alerta')
    expect(adv.messages.join(' ')).toMatch(/reduzir ou interromper/)
    expect(adv.messages.join(' ')).toMatch(/não é um diagnóstico/)
  })
  it('sem registos não há alerta', async () => {
    expect(recoveryAdvice([], '2026-11-13').level).toBe('ok')
  })
})

describe('relatórios', () => {
  it('relatório semanal tem a estrutura pedida e não inventa dados', async () => {
    await doPush('2026-11-10')
    await upsertBodyLog('2026-11-10', { weightKg: 80.2 })
    await upsertBodyLog('2026-11-14', { weightKg: 80.6 })
    await addMeal({ date: '2026-11-10', slot: 'almoco', name: 'Frango com arroz', kcal: 800, protein: 60, carbs: 90, fat: 20 })
    const snap = await loadSnapshot()
    const txt = buildWeeklyReport(snap, '2026-11-10')
    expect(txt).toContain('WINTER ARC — RELATÓRIO SEMANAL')
    expect(txt).toContain('Período: 09/11/2026 a 15/11/2026')
    expect(txt).toContain('Peso inicial: 80,2 kg (10/11/2026)')
    expect(txt).toContain('Peso final: 80,6 kg (14/11/2026)')
    expect(txt).toContain('TERÇA — PUSH')
    expect(txt).toContain('Supino plano')
    expect(txt).toContain('Série 1: 60 kg × 8')
    expect(txt).toContain('Série 3: 60 kg × 7')
    expect(txt).toContain('PERFORMANCE')
    expect(txt).toContain('Sem testes ou resultados de performance')
    expect(txt).toContain('NUTRIÇÃO')
    expect(txt).toContain('Média de calorias: 800 kcal')
    expect(txt).toContain('RECUPERAÇÃO')
    expect(txt).toContain('Sem registos de recuperação')
    expect(txt).toContain('EVOLUÇÃO')
    expect(txt).toContain('PEDIDO AO CHATGPT')
    expect(txt).toContain('Prioridades para a próxima semana')
    expect(txt).not.toMatch(/NaN|undefined/)
  })
  it('média de nutrição ignora dias sem registo (não conta zeros)', async () => {
    await addMeal({ date: '2026-11-09', slot: 'almoco', name: 'A', kcal: 2000, protein: 100, carbs: 200, fat: 60 })
    await addMeal({ date: '2026-11-11', slot: 'almoco', name: 'B', kcal: 3000, protein: 100, carbs: 200, fat: 60 })
    const txt = buildWeeklyReport(await loadSnapshot(), '2026-11-10')
    expect(txt).toContain('Média de calorias: 2500 kcal')
    expect(txt).toContain('Dias com registo: 2 de 7')
  })
  it('relatório diário, mensal, de exercício e de performance geram texto válido', async () => {
    await doPush('2026-11-10')
    await doPush('2026-11-17', [62.5, 62.5, 62.5], [8, 8, 8])
    await addAssessment({ date: '2026-11-13', metric: 'vertical-jump', value: 45, unit: 'cm' })
    const snap = await loadSnapshot()
    expect(buildDailyReport(snap, '2026-11-10')).toContain('RELATÓRIO DIÁRIO')
    expect(buildDailyReport(snap, '2026-11-11')).toContain('Nenhum treino concluído neste dia.')
    const m = buildMonthlyReport(snap, '2026-11')
    expect(m).toContain('RELATÓRIO MENSAL')
    expect(m).toContain('Supino plano com barra: 60 kg')
    const e = buildExerciseReport(snap, 'supino-plano')
    expect(e).toContain('1RM estimado')
    expect(e).toContain('ESTIMATIVA')
    expect(e).toContain('SUGESTÃO DA APP')
    const p = buildPerformanceReport(snap)
    expect(p).toContain('Salto vertical')
    expect(p).toContain('45')
  })
  it('relatório JSON tem versão do esquema, período e dados', async () => {
    await doPush('2026-11-10')
    await addAssessment({ date: '2026-11-13', metric: 'vertical-jump', value: 45, unit: 'cm' })
    const j = buildJsonReport(await loadSnapshot(), '2026-11-09', '2026-11-15')
    expect(j.schema).toBe('winter-arc-report')
    expect(j.schemaVersion).toBe(1)
    expect(j.period).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(j.sessions).toHaveLength(1)
    expect(j.sessions[0].exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 8, done: true })
    expect(j.sessions[0].exercises[0].estimated1RMKg).toBeGreaterThan(60)
    expect(j.performance['vertical-jump'].points[0].value).toBe(45)
    expect(JSON.parse(JSON.stringify(j))).toBeTruthy()
  })
})

describe('backup e restauro', () => {
  async function seedData() {
    await doPush('2026-11-10')
    await upsertBodyLog('2026-11-10', { weightKg: 80.2, waistCm: 84 })
    await addMeal({ date: '2026-11-10', slot: 'almoco', name: 'Arroz', kcal: 500, protein: 10, carbs: 100, fat: 5 })
    await addAssessment({ date: '2026-11-13', metric: 'vertical-jump', value: 45, unit: 'cm' })
    await db.photos.add({ id: 'p1', date: '2026-11-10', mime: 'image/png', blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), updatedAt: 5 })
  }
  async function counts() {
    return {
      sessions: await db.sessions.count(),
      body: await db.bodyLogs.count(),
      meals: await db.meals.count(),
      assess: await db.assessments.count(),
      photos: await db.photos.count(),
      templates: await db.templates.count(),
    }
  }

  it('exporta e valida um ficheiro JSON versionado', async () => {
    await seedData()
    const file = await exportBackup()
    expect(file.app).toBe('winter-arc')
    expect(file.schemaVersion).toBe(1)
    const text = JSON.stringify(file)
    const v = parseBackupText(text)
    expect(v.ok).toBe(true)
    expect(v.summary.sessions).toBe(1)
    expect(v.summary.photos).toBe(1)
  })

  it('restaurar num dispositivo limpo devolve exatamente os mesmos dados', async () => {
    await seedData()
    const before = await counts()
    const snapBefore = await loadSnapshot()
    const text = JSON.stringify(await exportBackup())
    await db.delete()
    await db.open()
    expect((await counts()).sessions).toBe(0)
    const v = parseBackupText(text)
    await importBackup(v.file!, 'replace')
    expect(await counts()).toEqual(before)
    const snapAfter = await loadSnapshot()
    expect(snapAfter.sessions).toEqual(snapBefore.sessions)
    expect(snapAfter.bodyLogs).toEqual(snapBefore.bodyLogs)
    expect(snapAfter.settings).toEqual(snapBefore.settings)
    const photo = await db.photos.get('p1')
    expect(photo?.mime).toBe('image/png')
    expect(photo!.blob.size).toBe(4)
    // os cálculos dão o mesmo resultado
    expect(buildWeeklyReport(snapAfter, '2026-11-10')).toBe(buildWeeklyReport(snapBefore, '2026-11-10'))
  })

  it('fundir não duplica: importar o mesmo ficheiro duas vezes mantém os totais', async () => {
    await seedData()
    const before = await counts()
    const v = parseBackupText(JSON.stringify(await exportBackup()))
    const plan = await planImport(v.file!, 'merge')
    expect(plan.totals.add).toBe(0)
    await importBackup(v.file!, 'merge')
    await importBackup(v.file!, 'merge')
    expect(await counts()).toEqual(before)
  })

  it('fundir acrescenta o que falta e mantém os dados atuais; em conflito vence o mais recente', async () => {
    await seedData()
    const file = await exportBackup()
    // dispositivo B tem outro registo e uma versão mais antiga do peso
    await db.delete()
    await db.open()
    await ensureSeeded()
    await db.bodyLogs.put({ id: '2026-11-10', date: '2026-11-10', weightKg: 99, updatedAt: 1 }) // mais antigo
    await db.bodyLogs.put({ id: '2026-11-12', date: '2026-11-12', weightKg: 81, updatedAt: 9999999999999 })
    const v = validateBackup(JSON.parse(JSON.stringify(file)))
    await importBackup(v.file!, 'merge')
    const b10 = await db.bodyLogs.get('2026-11-10')
    expect(b10?.weightKg).toBe(80.2) // o do ficheiro é mais recente
    expect((await db.bodyLogs.get('2026-11-12'))?.weightKg).toBe(81) // o existente mantém-se
    expect(await db.sessions.count()).toBe(1)
  })

  it('rejeita ficheiros inválidos com mensagens claras e não toca nos dados', async () => {
    await seedData()
    const before = await counts()
    expect(parseBackupText('{não é json').errors[0]).toMatch(/JSON válido/)
    expect(validateBackup({ app: 'outra', schemaVersion: 1, data: {} }).errors[0]).toMatch(/não é uma cópia/)
    expect(validateBackup({ app: 'winter-arc', schemaVersion: 99, data: {} }).errors[0]).toMatch(/mais recente/)
    expect(validateBackup({ app: 'winter-arc', schemaVersion: 1 }).errors[0]).toMatch(/data/)
    const bad = validateBackup({ app: 'winter-arc', schemaVersion: 1, data: { sessions: [{ id: 'x', date: '2026-13-45', exercises: [], startedAt: 1, status: 'completed' }] } })
    expect(bad.ok).toBe(false)
    expect(bad.errors.join()).toMatch(/data inválida/)
    expect(await counts()).toEqual(before)
  })

  it('sessão ativa importada com outra já ativa passa a parcial (só uma sessão ativa)', async () => {
    await startSessionFromTemplate('tpl-upper-core', '2026-11-12')
    const file = await exportBackup()
    const sess = file.data.sessions![0] as { id: string }
    await db.sessions.clear()
    const other = await startSessionFromTemplate('tpl-push', '2026-11-13')
    await importBackup(file, 'merge')
    const active = await db.sessions.where('status').equals('active').toArray()
    expect(active.map((a) => a.id)).toEqual([other.id])
    expect((await db.sessions.get(sess.id))?.status).toBe('partial')
  })

  it('substituir sem fotografias na cópia mantém as fotografias existentes', async () => {
    await seedData()
    const file = await exportBackup({ includePhotos: false })
    await importBackup(file, 'replace')
    expect(await db.photos.count()).toBe(1)
  })
})

describe('exerciseMap', () => {
  it('inclui a biblioteca e exercícios personalizados', async () => {
    await db.customExercises.put({
      id: 'custom-1', namePt: 'Meu exercício', nameEn: 'Mine', logType: 'strength', primary: 'peito', secondary: [], equipment: 'Barra', goal: 'x', restSec: 90,
      instructions: ['a'], technique: [], mistakes: [], safety: [], alternatives: [], videoQuery: 'x', custom: true,
    })
    const m = await exerciseMap()
    expect(m.get('custom-1')?.namePt).toBe('Meu exercício')
    expect(m.get('supino-plano')).toBeDefined()
    expect(startOfWeek('2026-11-13')).toBe('2026-11-09')
  })
})
