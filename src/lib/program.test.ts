import { describe, expect, it } from 'vitest'
import { LIBRARY, builtinExercise } from './exercises'
import {
  adjustPlan,
  defaultTemplates,
  normalizePhaseStarts,
  phaseEndWeek,
  phaseStartWeek,
  dayItems,
  extendPhase,
  phaseForWeek,
  plannedTemplatesForDate,
  programPosition,
  programWeek,
} from './program'
import type { PhaseStarts } from './program'
import type { ScheduleOverride, Session } from './types'

const prog = (startDate: string, phaseStarts: PhaseStarts = [3, 5, 9]) => ({ program: { startDate, phaseStarts, plyoLevel: 1 as const } })
const tplOf = (id: string) => defaultTemplates().find((x) => x.id === id)!
const spec = (id: string) => tplOf(id).exercises.map((e) => [e.exerciseId, e.sets])
const lifting = (id: string) => tplOf(id).exercises.filter((e) => builtinExercise(e.exerciseId)?.logType === 'strength').reduce((a, e) => a + e.sets, 0)

describe('plano oficial (versão 2)', () => {
  const t = defaultTemplates()
  it('tem o plano semanal oficial', () => {
    const byDay = Object.fromEntries(t.map((x) => [x.weekday, x.name]))
    expect(byDay[1]).toMatch(/Natação/)
    expect(byDay[2]).toBe('Push')
    expect(byDay[3]).toBe('Pull')
    expect(byDay[4]).toBe('Lower Strength & Vertical Jump')
    expect(byDay[5]).toBe('Upper Hypertrophy & Core')
    expect(byDay[6]).toBe('Lower Hypertrophy & Explosive Speed')
    expect(byDay[7]).toMatch(/Rest/)
  })
  it('Push: 7 exercícios, 19 séries', () => {
    expect(spec('tpl-push')).toEqual([
      ['supino-plano', 3],
      ['supino-inclinado-halteres', 3],
      ['desenvolvimento-ombros', 3],
      ['pec-deck', 2],
      ['elevacoes-laterais', 3],
      ['triceps-polia', 3],
      ['extensao-triceps-cabeca', 2],
    ])
    expect(lifting('tpl-push')).toBe(19)
  })
  it('Pull: 6 exercícios, 18 séries', () => {
    expect(tplOf('tpl-pull').exercises).toHaveLength(6)
    expect(lifting('tpl-pull')).toBe(18)
  })
  it('Lower Strength & Vertical Jump: CMJ e Box Jump antes da musculação; 18 séries de força', () => {
    const ids = tplOf('tpl-lower-vj').exercises.map((e) => e.exerciseId)
    expect(ids).toEqual(['aquecimento-dinamico', 'salto-vertical', 'salto-caixa', 'agachamento', 'peso-morto-romeno', 'agachamento-bulgaro', 'leg-curl', 'gemeos', 'crunch-polia'])
    const jumps = tplOf('tpl-lower-vj').exercises.filter((e) => ['salto-vertical', 'salto-caixa'].includes(e.exerciseId))
    expect(jumps.map((j) => [j.sets, j.repMin, j.repMax])).toEqual([[3, 3, 3], [3, 3, 3]])
    expect(lifting('tpl-lower-vj')).toBe(18)
  })
  it('Upper Hypertrophy & Core: 21 séries e cardio opcional', () => {
    expect(lifting('tpl-upper-core')).toBe(21)
    const cardio = tplOf('tpl-upper-core').exercises.find((e) => e.exerciseId === 'bicicleta-estatica')!
    expect(cardio.optional).toBe(true)
  })
  it('Lower Hypertrophy & Explosive Speed: variantes A/B e 14 séries de força', () => {
    const l = tplOf('tpl-lower-speed')
    expect(l.variants).toEqual({ A: 'Saltos', B: 'Sprints' })
    const a = l.exercises.filter((e) => e.variant === 'A').map((e) => e.exerciseId)
    const b = l.exercises.filter((e) => e.variant === 'B').map((e) => e.exerciseId)
    expect(a).toEqual(['pogo-jumps', 'salto-horizontal'])
    expect(b).toEqual(['aceleracao', 'sprint-20m'])
    expect(lifting('tpl-lower-speed')).toBe(14)
    const order = l.exercises.map((e) => e.exerciseId)
    expect(order.indexOf('leg-press')).toBeGreaterThan(order.indexOf('sprint-20m')) // explosivo antes do pesado
  })
  it('nada de drops isolados, depth jumps, olímpicos, kettlebell, circuitos no plano obrigatório', () => {
    const banned = /(drop|depth|clean|snatch|kettlebell|swing|crossfit|agilidade|escada)/i
    for (const tpl of t) for (const e of tpl.exercises) expect(e.exerciseId, e.exerciseId).not.toMatch(banned)
  })
  it('todos os exercícios dos templates existem na biblioteca', () => {
    for (const tpl of t) for (const e of tpl.exercises) expect(builtinExercise(e.exerciseId), e.exerciseId).toBeDefined()
  })
  it('biblioteca: campos obrigatórios preenchidos e sem URLs inventados', () => {
    for (const e of LIBRARY) {
      expect(e.namePt && e.nameEn && e.goal && e.equipment).toBeTruthy()
      expect(e.instructions.length).toBeGreaterThan(0)
      expect(e.videoQuery.length).toBeGreaterThan(3)
      expect(JSON.stringify(e)).not.toMatch(/https?:\/\//)
      if (e.logType === 'jump') expect(e.plyo, e.id).toBeDefined()
    }
  })
  it('exercícios novos têm nome PT/EN, músculos, erros comuns e segurança', () => {
    for (const id of ['salto-vertical', 'salto-caixa', 'salto-horizontal', 'pogo-jumps', 'sprint-20m', 'hack-squat', 'bicicleta-estatica', 'pec-deck']) {
      const e = builtinExercise(id)!
      expect(e, id).toBeDefined()
      expect(e.namePt && e.nameEn).toBeTruthy()
      expect(e.primary.length, id).toBeGreaterThan(0)
      expect(e.mistakes.length, id).toBeGreaterThan(0)
      expect(e.safety, id).toBeTruthy()
    }
  })
  it('só CMJ e Broad Jump contam como métricas de salto; a altura da caixa não é altura de salto', () => {
    expect(builtinExercise('salto-vertical')!.metric).toBe('vertical-jump')
    expect(builtinExercise('salto-horizontal')!.metric).toBe('broad-jump')
    expect(builtinExercise('salto-caixa')!.metric).toBeUndefined()
    expect(builtinExercise('salto-caixa')!.jumpInput).toBe('box')
    expect(builtinExercise('pogo-jumps')!.metric).toBeUndefined()
  })
})

describe('fases do programa', () => {
  it('semana do programa e fase (4 fases)', () => {
    expect(programWeek('2026-11-09', '2026-11-09')).toBe(1)
    expect(programWeek('2026-11-22', '2026-11-09')).toBe(2)
    expect(programWeek('2026-11-23', '2026-11-09')).toBe(3)
    const ps: PhaseStarts = [3, 5, 9]
    expect([1, 2, 3, 4, 5, 8, 9, 12].map((w) => phaseForWeek(w, ps))).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    expect([1, 2, 3, 4].map((p) => [phaseStartWeek(p as 1, ps), phaseEndWeek(p as 1, ps)])).toEqual([[1, 2], [3, 4], [5, 8], [9, 12]])
  })
  it('converte o formato antigo de 3 fases sem perder a posição', () => {
    expect(normalizePhaseStarts([3, 7])).toEqual([3, 5, 9])
    expect(normalizePhaseStarts([3, 5, 9])).toEqual([3, 5, 9])
    expect(normalizePhaseStarts(undefined)).toEqual([3, 5, 9])
  })
  it('prolongar uma fase adia as seguintes', () => {
    expect(extendPhase([3, 5, 9], 1, 1)).toEqual([4, 6, 10])
    expect(extendPhase([3, 5, 9], 2, 2)).toEqual([3, 7, 11])
    expect(extendPhase([3, 5, 9], 3, 1)).toEqual([3, 5, 10])
    const pos = programPosition('2026-11-23', prog('2026-11-09', [4, 6, 10]))
    expect(pos.phase).toBe(1) // ainda na fase 1 apesar de ser a semana 3
    expect(pos.week).toBe(3)
  })
  it('antes do início', () => {
    expect(programPosition('2026-11-02', prog('2026-11-09')).beforeStart).toBe(true)
  })
  it('musculação: fase 1 = 1–2 séries, fase 2 = 2–3, fases 3–4 = volume completo', () => {
    const tex = tplOf('tpl-push').exercises[0] // 3 séries
    const sup = builtinExercise('supino-plano')
    const at = (d: string) => adjustPlan(tex, sup, programPosition(d, prog('2026-11-09'))).sets
    expect(at('2026-11-09')).toBe(2) // S1 (3 → 2)
    expect(at('2026-11-16')).toBe(2) // S2
    expect(at('2026-11-23')).toBe(2) // S3
    expect(at('2026-11-30')).toBe(3) // S4
    expect(at('2026-12-07')).toBe(3) // S5
    expect(at('2027-01-04')).toBe(3) // S9
    const small = tplOf('tpl-push').exercises[3] // 2 séries
    expect(adjustPlan(small, builtinExercise('pec-deck'), programPosition('2026-11-09', prog('2026-11-09'))).sets).toBe(1)
  })
  it('semana de readaptação nunca ultrapassa 2 séries', () => {
    for (const id of ['tpl-push', 'tpl-pull', 'tpl-upper-core', 'tpl-lower-vj']) {
      for (const tex of tplOf(id).exercises) {
        const def = builtinExercise(tex.exerciseId)
        if (def?.logType !== 'strength') continue
        for (const d of ['2026-11-09', '2026-11-16']) expect(adjustPlan(tex, def, programPosition(d, prog('2026-11-09'))).sets, `${id} ${tex.exerciseId}`).toBeLessThanOrEqual(2)
      }
    }
  })
  it('saltos: fase 1 baixa volume; Box Jump só entra na fase 2 (caixa baixa)', () => {
    const l = tplOf('tpl-lower-vj').exercises
    const cmj = l.find((e) => e.exerciseId === 'salto-vertical')!
    const box = l.find((e) => e.exerciseId === 'salto-caixa')!
    expect(adjustPlan(cmj, builtinExercise('salto-vertical'), programPosition('2026-11-09', prog('2026-11-09'))).sets).toBe(2)
    expect(adjustPlan(cmj, builtinExercise('salto-vertical'), programPosition('2026-12-07', prog('2026-11-09'))).sets).toBe(3)
    expect(adjustPlan(box, builtinExercise('salto-caixa'), programPosition('2026-11-09', prog('2026-11-09'))).skip).toBe(true)
    const p2 = adjustPlan(box, builtinExercise('salto-caixa'), programPosition('2026-11-23', prog('2026-11-09')))
    expect(p2.skip).toBeFalsy()
    expect(p2.sets).toBe(2)
    expect(p2.note).toMatch(/caixa baixa/i)
  })
  it('sábado: sprint de 20 m só a partir da fase 3; acelerações de 10–20 m na fase 2', () => {
    const l = tplOf('tpl-lower-speed').exercises
    const acc = l.find((e) => e.exerciseId === 'aceleracao')!
    const sp = l.find((e) => e.exerciseId === 'sprint-20m')!
    const p1 = programPosition('2026-11-09', prog('2026-11-09'))
    const p2 = programPosition('2026-11-23', prog('2026-11-09'))
    const p3 = programPosition('2026-12-07', prog('2026-11-09'))
    expect(adjustPlan(acc, builtinExercise('aceleracao'), p1).note).toMatch(/leves|submáx/i)
    expect(adjustPlan(acc, builtinExercise('aceleracao'), p2).label).toMatch(/10–20 m/)
    expect(adjustPlan(sp, builtinExercise('sprint-20m'), p1).skip).toBe(true)
    expect(adjustPlan(sp, builtinExercise('sprint-20m'), p2).skip).toBe(true)
    expect(adjustPlan(sp, builtinExercise('sprint-20m'), p3).skip).toBeFalsy()
  })
  it('reduzir volume tira 1 série (mínimo 1) e nunca aplica pesos', () => {
    const tex = tplOf('tpl-push').exercises[0]
    const pos = programPosition('2026-12-07', prog('2026-11-09'))
    expect(adjustPlan(tex, builtinExercise('supino-plano'), pos).sets).toBe(3)
    const r = adjustPlan(tex, builtinExercise('supino-plano'), pos, { reduce: true })
    expect(r.sets).toBe(2)
    expect(r.note).toMatch(/reduzido/i)
    const one = { ...tex, sets: 1 }
    expect(adjustPlan(one, builtinExercise('supino-plano'), pos, { reduce: true }).sets).toBe(1)
  })
})

describe('agendamento', () => {
  const templates = defaultTemplates()
  it('dia da semana → treino previsto', () => {
    expect(plannedTemplatesForDate('2026-11-10', templates, []).map((t) => t.name)).toEqual(['Push']) // terça
    expect(plannedTemplatesForDate('2026-11-15', templates, []).map((t) => t.kind)).toEqual(['rest'])
  })
  it('adiar move o treino só nessa ocorrência', () => {
    const ov: ScheduleOverride[] = [
      { id: 'a', date: '2026-11-10', templateId: 'tpl-push', action: 'hide', movedTo: '2026-11-11', updatedAt: 1 },
      { id: 'b', date: '2026-11-11', templateId: 'tpl-push', action: 'add', updatedAt: 1 },
    ]
    expect(plannedTemplatesForDate('2026-11-10', templates, ov)).toHaveLength(0)
    expect(plannedTemplatesForDate('2026-11-11', templates, ov).map((t) => t.id)).toContain('tpl-push')
    expect(plannedTemplatesForDate('2026-11-17', templates, ov).map((t) => t.id)).toEqual(['tpl-push'])
    const items = dayItems('2026-11-10', '2026-11-12', '2026-11-09', templates, ov, [])
    expect(items[0].status).toBe('adiado')
  })
  it('um dia passado sem sessão é "não realizado"; nunca "concluído" automaticamente', () => {
    const items = dayItems('2026-11-10', '2026-11-13', '2026-11-09', templates, [], [])
    expect(items[0].status).toBe('nao-realizado')
    const sess = { id: 's', date: '2026-11-10', templateId: 'tpl-push', status: 'completed' } as Session
    expect(dayItems('2026-11-10', '2026-11-13', '2026-11-09', templates, [], [sess])[0].status).toBe('concluido')
    const part = { ...sess, status: 'partial' } as Session
    expect(dayItems('2026-11-10', '2026-11-13', '2026-11-09', templates, [], [part])[0].status).toBe('parcial')
  })
  it('hoje ou futuro sem sessão é "planeado"', () => {
    expect(dayItems('2026-11-13', '2026-11-13', '2026-11-09', templates, [], [])[0].status).toBe('planeado')
    expect(dayItems('2026-11-14', '2026-11-13', '2026-11-09', templates, [], [])[0].status).toBe('planeado')
  })
})
