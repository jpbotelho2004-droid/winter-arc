import { describe, expect, it } from 'vitest'
import { LIBRARY, builtinExercise } from './exercises'
import {
  adjustPlan,
  defaultTemplates,
  dayItems,
  extendPhase,
  phaseForWeek,
  plannedTemplatesForDate,
  programPosition,
  programWeek,
} from './program'
import type { ScheduleOverride, Session } from './types'

const prog = (startDate: string, phaseStarts: [number, number] = [3, 7]) => ({ program: { startDate, phaseStarts, plyoLevel: 1 as const } })

describe('plano oficial', () => {
  const t = defaultTemplates()
  it('tem o plano semanal oficial', () => {
    const byDay = Object.fromEntries(t.map((x) => [x.weekday, x.name]))
    expect(byDay[1]).toBe('Natação')
    expect(byDay[2]).toBe('Upper Strength')
    expect(byDay[3]).toMatch(/Lower Strength/)
    expect(byDay[4]).toBe('Upper Hypertrophy')
    expect(byDay[5]).toBe('Speed & Agility')
    expect(byDay[6]).toMatch(/Lower Power/)
    expect(byDay[7]).toBe('Descanso')
  })
  it('Upper Strength tem séries e repetições oficiais', () => {
    const u = t.find((x) => x.id === 'tpl-upper-strength')!
    const spec = u.exercises.map((e) => [e.exerciseId, e.sets, e.repMin, e.repMax])
    expect(spec).toEqual([
      ['supino-plano', 3, 5, 8],
      ['puxada-polia-alta', 3, 8, 10],
      ['remada-apoio-peito', 3, 8, 10],
      ['desenvolvimento-ombros', 2, 8, 10],
      ['elevacoes-laterais', 3, 12, 15],
      ['curl-biceps', 2, 10, 12],
      ['triceps-polia', 2, 10, 12],
    ])
  })
  it('Lower Strength: aquecimento, aterragem 2×3, saltos 3×3 antes da musculação', () => {
    const l = t.find((x) => x.id === 'tpl-lower-strength')!.exercises
    expect(l.map((e) => e.exerciseId)).toEqual([
      'aquecimento-dinamico',
      'aterragem-controlada',
      'salto-vertical',
      'agachamento',
      'peso-morto-romeno',
      'leg-curl',
      'gemeos',
      'crunch-polia',
    ])
    expect(l[1]).toMatchObject({ sets: 2, repMin: 3 })
    expect(l[2]).toMatchObject({ sets: 3, repMin: 3 })
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
})

describe('fases do programa', () => {
  it('semana do programa e fase', () => {
    expect(programWeek('2026-11-09', '2026-11-09')).toBe(1)
    expect(programWeek('2026-11-22', '2026-11-09')).toBe(2)
    expect(programWeek('2026-11-23', '2026-11-09')).toBe(3)
    expect(phaseForWeek(2, [3, 7])).toBe(1)
    expect(phaseForWeek(3, [3, 7])).toBe(2)
    expect(phaseForWeek(7, [3, 7])).toBe(3)
    expect(phaseForWeek(12, [3, 7])).toBe(3)
  })
  it('prolongar uma fase adia as seguintes', () => {
    expect(extendPhase([3, 7], 1, 1)).toEqual([4, 8])
    expect(extendPhase([3, 7], 2, 2)).toEqual([3, 9])
    const pos = programPosition('2026-11-23', prog('2026-11-09', [4, 8]))
    expect(pos.phase).toBe(1) // ainda na fase 1 apesar de ser a semana 3
    expect(pos.week).toBe(3)
  })
  it('antes do início', () => {
    expect(programPosition('2026-11-02', prog('2026-11-09')).beforeStart).toBe(true)
  })
  it('fase 1 reduz o volume de musculação para 1–2 séries', () => {
    const tex = defaultTemplates().find((x) => x.id === 'tpl-upper-strength')!.exercises[0] // 3 séries
    const sup = builtinExercise('supino-plano')
    const w1 = adjustPlan(tex, sup, programPosition('2026-11-09', prog('2026-11-09')))
    const w2 = adjustPlan(tex, sup, programPosition('2026-11-16', prog('2026-11-09')))
    const w3 = adjustPlan(tex, sup, programPosition('2026-11-23', prog('2026-11-09')))
    const w4 = adjustPlan(tex, sup, programPosition('2026-11-30', prog('2026-11-09')))
    expect(w1.sets).toBeLessThanOrEqual(2)
    expect(w2.sets).toBe(2)
    expect(w3.sets).toBe(2) // 1.ª semana da fase 2: quase completo
    expect(w4.sets).toBe(3)
  })
  it('fase 1: saltos com baixo volume e sprints submáximos', () => {
    const jump = defaultTemplates().find((x) => x.id === 'tpl-lower-strength')!.exercises[2]
    const sprint = defaultTemplates().find((x) => x.id === 'tpl-speed')!.exercises[5]
    const pos = programPosition('2026-11-09', prog('2026-11-09'))
    expect(adjustPlan(jump, builtinExercise('salto-vertical'), pos).sets).toBe(2)
    const a = adjustPlan(sprint, builtinExercise('aceleracao'), pos)
    expect(a.sets).toBeLessThanOrEqual(4)
    expect(a.note).toMatch(/submáximas/)
  })
})

describe('agendamento', () => {
  const templates = defaultTemplates()
  it('dia da semana → treino previsto', () => {
    expect(plannedTemplatesForDate('2026-11-10', templates, []).map((t) => t.name)).toEqual(['Upper Strength']) // terça
    expect(plannedTemplatesForDate('2026-11-15', templates, []).map((t) => t.kind)).toEqual(['rest'])
  })
  it('adiar move o treino só nessa ocorrência', () => {
    const ov: ScheduleOverride[] = [
      { id: 'a', date: '2026-11-10', templateId: 'tpl-upper-strength', action: 'hide', movedTo: '2026-11-11', updatedAt: 1 },
      { id: 'b', date: '2026-11-11', templateId: 'tpl-upper-strength', action: 'add', updatedAt: 1 },
    ]
    expect(plannedTemplatesForDate('2026-11-10', templates, ov)).toHaveLength(0)
    expect(plannedTemplatesForDate('2026-11-11', templates, ov).map((t) => t.id)).toContain('tpl-upper-strength')
    expect(plannedTemplatesForDate('2026-11-17', templates, ov).map((t) => t.id)).toEqual(['tpl-upper-strength'])
    const items = dayItems('2026-11-10', '2026-11-12', '2026-11-09', templates, ov, [])
    expect(items[0].status).toBe('adiado')
  })
  it('um dia passado sem sessão é "não realizado"; nunca "concluído" automaticamente', () => {
    const items = dayItems('2026-11-10', '2026-11-13', '2026-11-09', templates, [], [])
    expect(items[0].status).toBe('nao-realizado')
    const sess = { id: 's', date: '2026-11-10', templateId: 'tpl-upper-strength', status: 'completed' } as Session
    expect(dayItems('2026-11-10', '2026-11-13', '2026-11-09', templates, [], [sess])[0].status).toBe('concluido')
    const part = { ...sess, status: 'partial' } as Session
    expect(dayItems('2026-11-10', '2026-11-13', '2026-11-09', templates, [], [part])[0].status).toBe('parcial')
  })
  it('hoje ou futuro sem sessão é "planeado"', () => {
    expect(dayItems('2026-11-13', '2026-11-13', '2026-11-09', templates, [], [])[0].status).toBe('planeado')
    expect(dayItems('2026-11-14', '2026-11-13', '2026-11-09', templates, [], [])[0].status).toBe('planeado')
  })
})
