// Cálculos puros (sem acesso à base de dados) — totalmente testáveis.

import type { ExerciseDef, MuscleGroup, Plan, Session, SessionExercise, SetEntry } from './types'

export function uid(prefix = ''): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  const raw = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}-${raw}` : raw
}

// ---------- números ----------

const nf = new Map<number, Intl.NumberFormat>()
function formatter(d: number): Intl.NumberFormat {
  let f = nf.get(d)
  if (!f) {
    f = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: d, minimumFractionDigits: 0 })
    nf.set(d, f)
  }
  return f
}

/** 60.5 -> "60,5". Valores em falta devolvem "—" (nunca 0). */
export function fmt(n: number | undefined | null, decimals = 1): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  return formatter(decimals).format(n)
}

/** Aceita "60,5" ou "60.5". Devolve undefined para vazio/inválido. */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(',', '.')
  if (t === '') return undefined
  if (!/^-?\d*\.?\d*$/.test(t) || t === '.' || t === '-') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function round(n: number, decimals = 1): number {
  const p = 10 ** decimals
  return Math.round(n * p) / p
}

/** Média ignorando valores em falta; undefined se não houver nenhum. */
export function avg(values: Array<number | undefined | null>): number | undefined {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (!v.length) return undefined
  return v.reduce((a, b) => a + b, 0) / v.length
}

export function sum(values: Array<number | undefined | null>): number {
  return values.reduce<number>((a, b) => a + (typeof b === 'number' && Number.isFinite(b) ? b : 0), 0)
}

// ---------- validação de campos ----------

export const LIMITS = {
  weightKg: { min: 0, max: 600 },
  reps: { min: 0, max: 300 },
  rpe: { min: 1, max: 10 },
  rir: { min: 0, max: 10 },
  timeS: { min: 0, max: 36000 },
  distanceM: { min: 0, max: 100000 },
  heightCm: { min: 0, max: 200 },
  distanceCm: { min: 0, max: 800 },
} as const

export function validRange(n: number | undefined, key: keyof typeof LIMITS): boolean {
  if (n === undefined) return true
  const l = LIMITS[key]
  return n >= l.min && n <= l.max
}

// ---------- séries / volume / 1RM ----------

export function isWorkingSet(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup'
}

export function setVolume(s: SetEntry): number {
  if (!isWorkingSet(s)) return 0
  if (!s.weightKg || !s.reps) return 0
  return s.weightKg * s.reps
}

export function exerciseVolume(ex: SessionExercise): number {
  if (ex.logType !== 'strength') return 0
  return sum(ex.sets.map(setVolume))
}

export function sessionVolume(s: Session): number {
  return sum(s.exercises.map(exerciseVolume))
}

export function doneSetsCount(ex: SessionExercise): number {
  return ex.sets.filter((s) => s.done).length
}

export function sessionSetsCount(s: Session): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const ex of s.exercises) {
    total += ex.sets.length
    done += ex.sets.filter((x) => x.done).length
  }
  return { done, total }
}

/** Epley. Só para 1–10 repetições com carga; fora disso não faz sentido estimar. */
export function estimate1RM(weightKg: number | undefined, reps: number | undefined): number | undefined {
  if (!weightKg || !reps || weightKg <= 0 || reps < 1 || reps > 10) return undefined
  if (reps === 1) return weightKg
  return round(weightKg * (1 + reps / 30), 1)
}

export function sessionDurationSec(s: Session): number {
  const end = s.endedAt ?? Date.now()
  return Math.max(0, Math.round((end - s.startedAt) / 1000))
}

// ---------- tempo / ritmo ----------

/** 125 -> "2:05"; 3725 -> "1:02:05" */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** 3725 -> "1 h 02 min"; 1500 -> "25 min" */
export function humanDuration(totalSec: number | undefined): string {
  if (totalSec === undefined || !Number.isFinite(totalSec)) return '—'
  const m = Math.round(totalSec / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** Ritmo em segundos por 100 m. */
export function pacePer100(distanceM: number | undefined, timeS: number | undefined): number | undefined {
  if (!distanceM || !timeS || distanceM <= 0 || timeS <= 0) return undefined
  return (timeS / distanceM) * 100
}

/** 105 -> "1:45 /100 m" */
export function formatPace(secPer100: number | undefined): string {
  if (secPer100 === undefined) return '—'
  const total = Math.round(secPer100)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /100 m`
}

/** Tempo em segundos com décimas: 2.84 -> "2,84 s"; 83.2 -> "1:23,2" */
export function formatSeconds(t: number | undefined, decimals = 2): string {
  if (t === undefined) return '—'
  if (t < 60) return `${fmt(t, decimals)} s`
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${String(fmt(s, 1)).padStart(4, '0')}`
}

/** "mm:ss" ou "ss,d" -> segundos. */
export function parseTime(s: string): number | undefined {
  const t = s.trim()
  if (t === '') return undefined
  if (t.includes(':')) {
    const [m, sec] = t.split(':')
    const mm = Number(m)
    const ss = parseNum(sec)
    if (!Number.isFinite(mm) || ss === undefined) return undefined
    return mm * 60 + ss
  }
  return parseNum(t)
}

// ---------- progressão dupla ----------

export interface Suggestion {
  kind: 'increase' | 'maintain' | 'reduce' | 'none'
  weightKg?: number
  message: string
}

/**
 * Progressão dupla: se TODAS as séries de trabalho planeadas atingiram o topo do intervalo
 * de repetições com esforço adequado (RPE ≤ 9,5 quando registado) -> sugerir aumento pequeno.
 * Nunca é aplicado automaticamente.
 */
export function doubleProgression(
  lastSets: SetEntry[] | undefined,
  plan: Plan | undefined,
  incrementKg: number,
): Suggestion {
  if (!plan || !lastSets) return { kind: 'none', message: 'Sem sessão anterior para comparar.' }
  const working = lastSets.filter(isWorkingSet).filter((s) => s.reps && s.weightKg)
  if (!working.length) return { kind: 'none', message: 'Sem séries de trabalho anteriores com carga e repetições.' }
  const top = Math.max(...working.map((s) => s.weightKg!))
  const atTop = working.filter((s) => s.weightKg === top)
  const needed = Math.min(plan.sets, working.length)
  const allMax = atTop.length >= Math.min(needed, plan.sets) && atTop.every((s) => (s.reps ?? 0) >= plan.repMax)
  const effortOk = atTop.every((s) => s.rpe === undefined || s.rpe <= 9.5)
  if (allMax && effortOk && atTop.length >= Math.min(plan.sets, 2)) {
    return {
      kind: 'increase',
      weightKg: round(top + incrementKg, 2),
      message: `Todas as séries em ${plan.repMax} reps com ${fmt(top)} kg. Se a técnica foi boa, podes subir para ${fmt(top + incrementKg, 2)} kg.`,
    }
  }
  if (working.some((s) => s.weightKg === top && (s.reps ?? 0) < plan.repMin)) {
    return {
      kind: 'maintain',
      weightKg: top,
      message: `Alguma série ficou abaixo de ${plan.repMin} reps com ${fmt(top)} kg. Mantém (ou reduz um pouco) até chegares às ${plan.repMin}–${plan.repMax} reps.`,
    }
  }
  return {
    kind: 'maintain',
    weightKg: top,
    message: `Mantém ${fmt(top)} kg e tenta somar repetições até ${plan.repMax} em todas as séries.`,
  }
}

// ---------- agregações ----------

export function volumeByMuscle(sessions: Session[]): Record<MuscleGroup, { sets: number; volumeKg: number }> {
  const out = {} as Record<MuscleGroup, { sets: number; volumeKg: number }>
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (ex.logType !== 'strength') continue
      const sets = ex.sets.filter(isWorkingSet).length
      if (!sets) continue
      const cur = (out[ex.primary] ??= { sets: 0, volumeKg: 0 })
      cur.sets += sets
      cur.volumeKg += exerciseVolume(ex)
    }
  }
  return out
}

export function bestSet(sets: SetEntry[]): SetEntry | undefined {
  let best: SetEntry | undefined
  for (const s of sets.filter(isWorkingSet)) {
    if (!s.reps) continue
    const v = (s.weightKg ?? 0) * s.reps
    const bv = best ? (best.weightKg ?? 0) * (best.reps ?? 0) : -1
    if (v > bv || (v === bv && (s.reps ?? 0) > (best?.reps ?? 0))) best = s
  }
  return best
}

export function defaultRestFor(def: ExerciseDef | undefined, compoundSec: number, isolationSec: number): number {
  if (!def) return isolationSec
  return def.compound ? compoundSec : def.restSec || isolationSec
}

export function makeSet(partial: Partial<SetEntry> = {}): SetEntry {
  return { id: uid('set'), type: 'normal', done: false, ...partial }
}
