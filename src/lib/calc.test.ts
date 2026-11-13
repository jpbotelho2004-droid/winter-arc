import { describe, expect, it } from 'vitest'
import {
  avg,
  clock,
  doubleProgression,
  estimate1RM,
  exerciseVolume,
  fmt,
  formatPace,
  humanDuration,
  makeSet,
  pacePer100,
  parseNum,
  parseTime,
  sessionVolume,
  setVolume,
  validRange,
  volumeByMuscle,
} from './calc'
import type { Session, SessionExercise } from './types'

const ex = (sets: Parameters<typeof makeSet>[0][], extra: Partial<SessionExercise> = {}): SessionExercise => ({
  id: 'x',
  exerciseId: 'supino-plano',
  name: 'Supino plano',
  logType: 'strength',
  primary: 'peito',
  restSec: 150,
  sets: sets.map((s) => makeSet(s)),
  ...extra,
})

describe('números', () => {
  it('parseNum aceita vírgula e ponto e rejeita lixo', () => {
    expect(parseNum('60,5')).toBe(60.5)
    expect(parseNum('60.5')).toBe(60.5)
    expect(parseNum('')).toBeUndefined()
    expect(parseNum('abc')).toBeUndefined()
    expect(parseNum('1,2,3')).toBeUndefined()
    expect(parseNum('-')).toBeUndefined()
  })
  it('fmt usa vírgula decimal e "—" para valores em falta', () => {
    expect(fmt(60.5)).toBe('60,5')
    expect(fmt(undefined)).toBe('—')
    expect(fmt(60, 1)).toBe('60')
  })
  it('média ignora valores em falta (não conta como zero)', () => {
    expect(avg([1, undefined, 3])).toBe(2)
    expect(avg([undefined])).toBeUndefined()
  })
  it('validRange respeita limites', () => {
    expect(validRange(700, 'weightKg')).toBe(false)
    expect(validRange(60, 'weightKg')).toBe(true)
    expect(validRange(undefined, 'weightKg')).toBe(true)
    expect(validRange(11, 'rpe')).toBe(false)
  })
})

describe('volume e 1RM', () => {
  it('só séries de trabalho concluídas contam para o volume', () => {
    const e = ex([
      { weightKg: 60, reps: 8, done: true },
      { weightKg: 60, reps: 8, done: true },
      { weightKg: 60, reps: 7, done: false },
      { weightKg: 40, reps: 10, done: true, type: 'warmup' },
    ])
    expect(exerciseVolume(e)).toBe(960)
    expect(setVolume(e.sets[3])).toBe(0)
  })
  it('sessionVolume soma exercícios de musculação', () => {
    const s = { exercises: [ex([{ weightKg: 100, reps: 5, done: true }]), ex([{ weightKg: 50, reps: 10, done: true }])] } as Session
    expect(sessionVolume(s)).toBe(1000)
  })
  it('Epley: só 1–10 reps com carga', () => {
    expect(estimate1RM(60, 8)).toBe(76)
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(60, 15)).toBeUndefined()
    expect(estimate1RM(undefined, 5)).toBeUndefined()
    expect(estimate1RM(0, 5)).toBeUndefined()
  })
  it('volume por grupo muscular', () => {
    const s = { exercises: [ex([{ weightKg: 60, reps: 8, done: true }, { weightKg: 60, reps: 8, done: true }])] } as Session
    expect(volumeByMuscle([s]).peito).toEqual({ sets: 2, volumeKg: 960 })
  })
})

describe('tempo e ritmo', () => {
  it('clock e humanDuration', () => {
    expect(clock(125)).toBe('2:05')
    expect(clock(3725)).toBe('1:02:05')
    expect(humanDuration(1500)).toBe('25 min')
    expect(humanDuration(3725)).toBe('1 h 02 min')
  })
  it('ritmo por 100 m', () => {
    expect(pacePer100(100, 105)).toBe(105)
    expect(pacePer100(200, 420)).toBe(210)
    expect(formatPace(105)).toBe('1:45 /100 m')
    expect(pacePer100(0, 100)).toBeUndefined()
  })
  it('parseTime', () => {
    expect(parseTime('1:23,5')).toBeCloseTo(83.5)
    expect(parseTime('2,84')).toBe(2.84)
    expect(parseTime('')).toBeUndefined()
  })
})

describe('progressão dupla', () => {
  const plan = { sets: 3, repMin: 5, repMax: 8 }
  it('sugere aumento quando todas as séries atingem o topo com esforço adequado', () => {
    const sets = [1, 2, 3].map(() => makeSet({ weightKg: 60, reps: 8, done: true, rpe: 8 }))
    const sug = doubleProgression(sets, plan, 2.5)
    expect(sug.kind).toBe('increase')
    expect(sug.weightKg).toBe(62.5)
  })
  it('não sugere aumento se uma série ficou abaixo do topo', () => {
    const sets = [8, 8, 7].map((r) => makeSet({ weightKg: 60, reps: r, done: true }))
    expect(doubleProgression(sets, plan, 2.5).kind).toBe('maintain')
  })
  it('não sugere aumento se o esforço foi máximo (RPE 10)', () => {
    const sets = [1, 2, 3].map(() => makeSet({ weightKg: 60, reps: 8, done: true, rpe: 10 }))
    expect(doubleProgression(sets, plan, 2.5).kind).toBe('maintain')
  })
  it('sem histórico não há sugestão', () => {
    expect(doubleProgression(undefined, plan, 2.5).kind).toBe('none')
    expect(doubleProgression([], plan, 2.5).kind).toBe('none')
  })
  it('séries de aquecimento e não concluídas são ignoradas', () => {
    const sets = [
      makeSet({ weightKg: 40, reps: 12, done: true, type: 'warmup' }),
      makeSet({ weightKg: 60, reps: 8, done: false }),
    ]
    expect(doubleProgression(sets, plan, 2.5).kind).toBe('none')
  })
})
