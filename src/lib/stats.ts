// Estatísticas, recordes e métricas de performance — funções puras sobre um Snapshot dos dados.

import { addDays, endOfWeek, startOfWeek, weekDates } from './dates'
import {
  avg,
  bestSet,
  estimate1RM,
  exerciseVolume,
  isWorkingSet,
  pacePer100,
  round,
  sessionVolume,
  sum,
  volumeByMuscle,
} from './calc'
import { plannedTemplatesForDate } from './program'
import type {
  Assessment,
  BodyLog,
  DayLog,
  ExerciseDef,
  ExerciseMeta,
  Food,
  ISODate,
  MealEntry,
  RecoveryLog,
  SavedMeal,
  ScheduleOverride,
  Session,
  SessionExercise,
  SetEntry,
  Settings,
  WorkoutTemplate,
} from './types'

export interface Snapshot {
  settings: Settings
  templates: WorkoutTemplate[]
  sessions: Session[]
  schedule: ScheduleOverride[]
  bodyLogs: BodyLog[]
  foods: Food[]
  savedMeals: SavedMeal[]
  meals: MealEntry[]
  dayLogs: DayLog[]
  recovery: RecoveryLog[]
  assessments: Assessment[]
  customExercises: ExerciseDef[]
  exerciseMeta: ExerciseMeta[]
  exMap: Map<string, ExerciseDef>
}

// ---------------------------------------------------------------- sessões

export function finished(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.status !== 'active')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
}

export function sessionsBetween(sessions: Session[], from: ISODate, to: ISODate): Session[] {
  return finished(sessions).filter((s) => s.date >= from && s.date <= to)
}

export interface HistoryEntry {
  session: Session
  ex: SessionExercise
}

export function exerciseHistory(sessions: Session[], exerciseId: string): HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (const session of finished(sessions)) {
    for (const ex of session.exercises) {
      if (ex.exerciseId === exerciseId && ex.sets.some((s) => s.done)) out.push({ session, ex })
    }
  }
  return out
}

/** Ordenação cronológica por (data, hora de início) — sessões registadas retroativamente ficam no sítio certo. */
export function sessionBefore(a: Pick<Session, 'date' | 'startedAt'>, b: Pick<Session, 'date' | 'startedAt'>): boolean {
  return a.date < b.date || (a.date === b.date && a.startedAt < b.startedAt)
}

/** A sessão anterior (estritamente) com este exercício, antes da sessão `ref`. */
export function lastPerformance(
  sessions: Session[],
  exerciseId: string,
  ref: Pick<Session, 'date' | 'startedAt' | 'id'>,
): HistoryEntry | undefined {
  const h = exerciseHistory(sessions, exerciseId).filter((e) => e.session.id !== ref.id && sessionBefore(e.session, ref))
  return h[h.length - 1]
}

export interface ExerciseSummary {
  sessionsCount: number
  last?: HistoryEntry
  heaviest?: { weightKg: number; reps: number; date: ISODate }
  maxReps?: { reps: number; weightKg?: number; date: ISODate }
  best?: { weightKg: number; reps: number; date: ISODate; volumeKg: number }
  bestSessionVolume?: { volumeKg: number; date: ISODate }
  e1rm?: { value: number; weightKg: number; reps: number; date: ISODate }
  series: Array<{ date: ISODate; topWeight?: number; volume: number; e1rm?: number; bestReps?: number }>
}

export function exerciseSummary(history: HistoryEntry[], def?: ExerciseDef): ExerciseSummary {
  const out: ExerciseSummary = { sessionsCount: history.length, last: history[history.length - 1], series: [] }
  for (const { session, ex } of history) {
    const working = ex.sets.filter(isWorkingSet)
    let topWeight: number | undefined
    let bestE1: number | undefined
    let bestReps: number | undefined
    for (const s of working) {
      if (s.weightKg && s.reps) {
        if (!out.heaviest || s.weightKg > out.heaviest.weightKg || (s.weightKg === out.heaviest.weightKg && s.reps > out.heaviest.reps))
          out.heaviest = { weightKg: s.weightKg, reps: s.reps, date: session.date }
        topWeight = Math.max(topWeight ?? 0, s.weightKg)
        const vol = s.weightKg * s.reps
        if (!out.best || vol > out.best.volumeKg) out.best = { weightKg: s.weightKg, reps: s.reps, date: session.date, volumeKg: vol }
        if (def?.e1rm) {
          const e = estimate1RM(s.weightKg, s.reps)
          if (e) {
            bestE1 = Math.max(bestE1 ?? 0, e)
            if (!out.e1rm || e > out.e1rm.value) out.e1rm = { value: e, weightKg: s.weightKg, reps: s.reps, date: session.date }
          }
        }
      }
      if (s.reps) {
        bestReps = Math.max(bestReps ?? 0, s.reps)
        if (!out.maxReps || s.reps > out.maxReps.reps) out.maxReps = { reps: s.reps, weightKg: s.weightKg, date: session.date }
      }
    }
    const volume = exerciseVolume(ex)
    if (volume > 0 && (!out.bestSessionVolume || volume > out.bestSessionVolume.volumeKg))
      out.bestSessionVolume = { volumeKg: volume, date: session.date }
    out.series.push({ date: session.date, topWeight, volume, e1rm: bestE1, bestReps })
  }
  return out
}

/** Progressão face à sessão anterior (para o relatório semanal). */
export type ProgressVerdict = 'progressao' | 'sem-progressao' | 'sem-referencia'

export function compareToPrevious(current: SessionExercise, previous: SessionExercise | undefined): ProgressVerdict {
  if (!previous) return 'sem-referencia'
  const cw = current.sets.filter(isWorkingSet).filter((s) => s.reps)
  const pw = previous.sets.filter(isWorkingSet).filter((s) => s.reps)
  if (!cw.length || !pw.length) return 'sem-referencia'
  const topW = (a: SetEntry[]) => Math.max(...a.map((s) => s.weightKg ?? 0))
  const cTop = topW(cw)
  const pTop = topW(pw)
  if (cTop > pTop) return 'progressao'
  if (cTop < pTop) return 'sem-progressao'
  const repsAt = (a: SetEntry[], w: number) => Math.max(...a.filter((s) => (s.weightKg ?? 0) === w).map((s) => s.reps ?? 0))
  if (repsAt(cw, cTop) > repsAt(pw, pTop)) return 'progressao'
  // mais volume total com a mesma carga máxima também conta
  if (exerciseVolume(current) > exerciseVolume(previous) && exerciseVolume(previous) > 0) return 'progressao'
  return 'sem-progressao'
}

// ---------------------------------------------------------------- semana

export interface WeekStats {
  from: ISODate
  to: ISODate
  sessions: Session[]
  plannedCount: number
  completedCount: number
  volumeKg: number
  setsDone: number
  durationSec: number
  muscle: ReturnType<typeof volumeByMuscle>
}

export function weekStats(snap: Snapshot, anyDateInWeek: ISODate): WeekStats {
  const from = startOfWeek(anyDateInWeek)
  const to = endOfWeek(anyDateInWeek)
  const sessions = sessionsBetween(snap.sessions, from, to)
  let plannedCount = 0
  for (const d of weekDates(from)) {
    plannedCount += plannedTemplatesForDate(d, snap.templates, snap.schedule).filter((t) => t.kind !== 'rest').length
  }
  const completed = sessions.filter((s) => s.status === 'completed' || s.status === 'partial')
  return {
    from,
    to,
    sessions,
    plannedCount,
    completedCount: completed.length,
    volumeKg: sum(sessions.map(sessionVolume)),
    setsDone: sum(sessions.map((s) => sum(s.exercises.map((e) => e.sets.filter((x) => x.done).length)))),
    durationSec: sum(sessions.map((s) => (s.endedAt ? (s.endedAt - s.startedAt) / 1000 : 0))),
    muscle: volumeByMuscle(sessions),
  }
}

// ---------------------------------------------------------------- performance

export type PerfCategory = 'forca' | 'potencia' | 'velocidade' | 'agilidade' | 'resistencia' | 'mobilidade'

export const CATEGORY_LABEL: Record<PerfCategory, string> = {
  forca: 'Força',
  potencia: 'Potência',
  velocidade: 'Velocidade',
  agilidade: 'Agilidade',
  resistencia: 'Resistência',
  mobilidade: 'Mobilidade',
}

export interface PerfMetricDef {
  key: string
  label: string
  category: PerfCategory
  unit: string
  better: 'max' | 'min'
  decimals: number
  /** Descrição do protocolo (para não comparar protocolos diferentes). */
  protocol: string
  /** Se o registo manual é possível. */
  manual?: boolean
}

export const FIXED_METRICS: PerfMetricDef[] = [
  { key: 'vertical-jump', label: 'Salto vertical', category: 'potencia', unit: 'cm', better: 'max', decimals: 1, protocol: 'Salto com contramovimento, altura medida', manual: true },
  { key: 'broad-jump', label: 'Salto horizontal', category: 'potencia', unit: 'cm', better: 'max', decimals: 0, protocol: 'Salto em comprimento a pés juntos, parado', manual: true },
  { key: 'sprint-10', label: 'Sprint 10 m', category: 'velocidade', unit: 's', better: 'min', decimals: 2, protocol: '10 m cronometrados', manual: true },
  { key: 'sprint-20', label: 'Sprint 20 m', category: 'velocidade', unit: 's', better: 'min', decimals: 2, protocol: '20 m cronometrados', manual: true },
  { key: 'run-1km', label: 'Corrida 1 km', category: 'resistencia', unit: 's', better: 'min', decimals: 0, protocol: '1 km o mais rápido possível', manual: true },
  { key: 'swim-pace', label: 'Ritmo de natação', category: 'resistencia', unit: 's/100 m', better: 'min', decimals: 0, protocol: 'Ritmo médio por 100 m', manual: false },
  { key: 'swim-distance', label: 'Distância nadada', category: 'resistencia', unit: 'm', better: 'max', decimals: 0, protocol: 'Distância total na sessão', manual: false },
  { key: 'mobility-knee-wall', label: 'Knee-to-wall', category: 'mobilidade', unit: 'cm', better: 'max', decimals: 1, protocol: 'Distância do pé à parede com o joelho a tocar (tornozelo), melhor dos dois lados', manual: true },
  { key: 'mobility-sit-reach', label: 'Sit-and-reach', category: 'mobilidade', unit: 'cm', better: 'max', decimals: 1, protocol: 'Sentado, pernas esticadas; alcance em cm (negativo = antes dos pés)', manual: true },
  { key: 'mobility-squat', label: 'Agachamento profundo (autoavaliação)', category: 'mobilidade', unit: '/5', better: 'max', decimals: 0, protocol: 'Qualidade do agachamento profundo, 1–5 (subjetivo)', manual: true },
]

export function normalizeCourse(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-')
}

export function metricDefFor(key: string): PerfMetricDef | undefined {
  const fixed = FIXED_METRICS.find((m) => m.key === key)
  if (fixed) return fixed
  if (key.startsWith('sprint-')) {
    const d = key.slice(7)
    return { key, label: `Sprint ${d} m`, category: 'velocidade', unit: 's', better: 'min', decimals: 2, protocol: `${d} m cronometrados`, manual: true }
  }
  if (key.startsWith('agility:')) {
    const c = key.slice(8)
    return { key, label: `Agilidade — ${c.replace(/-/g, ' ')}`, category: 'agilidade', unit: 's', better: 'min', decimals: 2, protocol: `Percurso: ${c.replace(/-/g, ' ')}`, manual: true }
  }
  return undefined
}

export interface PerfPoint {
  date: ISODate
  value: number
  source: 'sessao' | 'teste'
  note?: string
}

function pushBest(map: Map<string, PerfPoint[]>, key: string, p: PerfPoint, better: 'max' | 'min', sessionId?: string, seen?: Map<string, number>) {
  const arr = map.get(key) ?? []
  if (sessionId && seen) {
    const k = `${key}|${sessionId}`
    const idx = seen.get(k)
    if (idx !== undefined) {
      const cur = arr[idx]
      if ((better === 'max' && p.value > cur.value) || (better === 'min' && p.value < cur.value)) arr[idx] = p
      map.set(key, arr)
      return
    }
    seen.set(k, arr.length)
  }
  arr.push(p)
  map.set(key, arr)
}

/** Todos os pontos medidos por métrica (um por sessão = melhor da sessão; um por teste manual). */
export function perfPointsAll(snap: Snapshot): Map<string, PerfPoint[]> {
  const map = new Map<string, PerfPoint[]>()
  const seen = new Map<string, number>()
  for (const s of finished(snap.sessions)) {
    for (const ex of s.exercises) {
      const def = snap.exMap.get(ex.exerciseId)
      const done = ex.sets.filter((x) => x.done)
      if (ex.logType === 'jump' && def?.metric === 'vertical-jump') {
        for (const x of done) if (x.heightCm && x.heightCm > 0)
          pushBest(map, 'vertical-jump', { date: s.date, value: x.heightCm, source: 'sessao' }, 'max', s.id, seen)
      } else if (ex.logType === 'jump' && def?.metric === 'broad-jump') {
        for (const x of done) if (x.distanceCm && x.distanceCm > 0)
          pushBest(map, 'broad-jump', { date: s.date, value: x.distanceCm, source: 'sessao' }, 'max', s.id, seen)
      } else if (ex.logType === 'sprint') {
        for (const x of done) if (x.distanceM && x.timeS && x.timeS > 0) {
          const key = `sprint-${Math.round(x.distanceM)}`
          pushBest(map, key, { date: s.date, value: x.timeS, source: 'sessao' }, 'min', s.id, seen)
        }
      } else if (ex.logType === 'agility') {
        const course = normalizeCourse(ex.course || ex.name)
        for (const x of done) if (x.timeS && x.timeS > 0)
          pushBest(map, `agility:${course}`, { date: s.date, value: x.timeS, source: 'sessao' }, 'min', s.id, seen)
      }
    }
    if (s.swim?.distanceM && s.swim.distanceM > 0) {
      pushBest(map, 'swim-distance', { date: s.date, value: s.swim.distanceM, source: 'sessao' }, 'max', s.id, seen)
      const t = s.swim.effectiveSec ?? s.swim.totalSec
      const pace = pacePer100(s.swim.distanceM, t)
      if (pace) pushBest(map, 'swim-pace', { date: s.date, value: round(pace, 1), source: 'sessao' }, 'min', s.id, seen)
    }
  }
  for (const a of snap.assessments) {
    pushBest(map, a.metric, { date: a.date, value: a.value, source: 'teste', note: a.notes }, metricDefFor(a.metric)?.better ?? 'max')
  }
  for (const arr of map.values()) arr.sort((a, b) => a.date.localeCompare(b.date))
  return map
}

export interface RecordEvent {
  date: ISODate
  value: number
  previous?: number
}

/** Cada novo recorde (estritamente melhor do que todos os anteriores), com o valor superado. */
export function recordProgression(points: Array<{ date: ISODate; value: number }>, better: 'max' | 'min'): RecordEvent[] {
  const out: RecordEvent[] = []
  let best: number | undefined
  const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date))
  for (const p of sorted) {
    const isBetter = best === undefined || (better === 'max' ? p.value > best : p.value < best)
    if (isBetter) {
      out.push({ date: p.date, value: p.value, previous: best })
      best = p.value
    }
  }
  return out
}

export interface PerfRecord {
  def: PerfMetricDef
  current?: RecordEvent
  history: RecordEvent[]
  points: PerfPoint[]
}

export function perfRecord(snap: Snapshot, key: string, pointsMap = perfPointsAll(snap)): PerfRecord | undefined {
  const def = metricDefFor(key)
  if (!def) return undefined
  const points = pointsMap.get(key) ?? []
  const history = recordProgression(points, def.better)
  return { def, points, history, current: history[history.length - 1] }
}

export const PR_METRIC_KEYS = [
  'vertical-jump',
  'broad-jump',
  'sprint-10',
  'sprint-20',
  'run-1km',
  'swim-pace',
  'swim-distance',
]

/** Todas as métricas existentes (fixas + sprints/agilidade com dados). */
export function allMetricKeys(snap: Snapshot, pointsMap = perfPointsAll(snap)): string[] {
  const keys = new Set<string>(FIXED_METRICS.map((m) => m.key))
  for (const k of pointsMap.keys()) keys.add(k)
  return [...keys]
}

// ---------------------------------------------------------------- força (para o painel)

export const STRENGTH_PANEL = [
  { exerciseId: 'supino-plano', label: 'Supino plano' },
  { exerciseId: 'agachamento', label: 'Agachamento' },
  { exerciseId: 'remada-apoio-peito', label: 'Remada (apoio de peito)' },
]

export function strengthSeries(snap: Snapshot, exerciseId: string): Array<{ date: ISODate; value: number }> {
  const def = snap.exMap.get(exerciseId)
  const s = exerciseSummary(exerciseHistory(snap.sessions, exerciseId), def)
  return s.series.filter((p) => p.topWeight).map((p) => ({ date: p.date, value: p.topWeight! }))
}

export interface ExercisePR {
  exerciseId: string
  name: string
  summary: ExerciseSummary
}

export function allExercisePRs(snap: Snapshot): ExercisePR[] {
  const ids = new Set<string>()
  for (const s of finished(snap.sessions)) for (const e of s.exercises) if (e.logType === 'strength' && e.sets.some(isWorkingSet)) ids.add(e.exerciseId)
  return [...ids]
    .map((id) => {
      const def = snap.exMap.get(id)
      return { exerciseId: id, name: def?.namePt ?? id, summary: exerciseSummary(exerciseHistory(snap.sessions, id), def) }
    })
    .filter((x) => x.summary.heaviest || x.summary.maxReps)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/** Séries onde um recorde de carga foi batido numa sessão (para marcar PRs no histórico). */
export function prsInSession(snap: Snapshot, session: Session): string[] {
  const out: string[] = []
  const prior = finished(snap.sessions).filter((s) => s.id !== session.id && sessionBefore(s, session))
  for (const ex of session.exercises) {
    if (ex.logType !== 'strength') continue
    const priorSummary = exerciseSummary(exerciseHistory(prior, ex.exerciseId))
    const cur = exerciseSummary([{ session, ex }])
    if (!priorSummary.sessionsCount) continue // primeira vez: sem recorde "batido"
    if (cur.heaviest && (!priorSummary.heaviest || cur.heaviest.weightKg > priorSummary.heaviest.weightKg))
      out.push(`${ex.name}: maior carga ${cur.heaviest.weightKg} kg × ${cur.heaviest.reps}`)
    else if (cur.best && priorSummary.best && cur.best.volumeKg > priorSummary.best.volumeKg)
      out.push(`${ex.name}: melhor série ${cur.best.weightKg} kg × ${cur.best.reps}`)
  }
  return out
}

// ---------------------------------------------------------------- corpo

export function sortedBody(logs: BodyLog[]): BodyLog[] {
  return logs.slice().sort((a, b) => a.date.localeCompare(b.date))
}

export function latestWeight(logs: BodyLog[]): { weightKg: number; date: ISODate } | undefined {
  const l = sortedBody(logs).filter((x) => x.weightKg !== undefined)
  const last = l[l.length - 1]
  return last ? { weightKg: last.weightKg!, date: last.date } : undefined
}

export function weeklyWeightAverages(logs: BodyLog[]): Array<{ week: ISODate; avg: number; n: number }> {
  const by = new Map<ISODate, number[]>()
  for (const l of logs) if (l.weightKg !== undefined) {
    const w = startOfWeek(l.date)
    by.set(w, [...(by.get(w) ?? []), l.weightKg])
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, v]) => ({ week, avg: round(avg(v)!, 2), n: v.length }))
}

// ---------------------------------------------------------------- nutrição

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export function totalsOf(meals: Array<Pick<MealEntry, 'kcal' | 'protein' | 'carbs' | 'fat'>>): Macros {
  return {
    kcal: sum(meals.map((m) => m.kcal)),
    protein: sum(meals.map((m) => m.protein)),
    carbs: sum(meals.map((m) => m.carbs)),
    fat: sum(meals.map((m) => m.fat)),
  }
}

export function mealsOn(meals: MealEntry[], date: ISODate): MealEntry[] {
  return meals.filter((m) => m.date === date)
}

/** Médias apenas sobre os dias com alimentação registada (dias sem registo não contam como zero). */
export function nutritionAverages(meals: MealEntry[], from: ISODate, to: ISODate): { days: number; avg?: Macros } {
  const byDay = new Map<ISODate, MealEntry[]>()
  for (const m of meals) if (m.date >= from && m.date <= to) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m])
  if (!byDay.size) return { days: 0 }
  const totals = [...byDay.values()].map(totalsOf)
  return {
    days: byDay.size,
    avg: {
      kcal: avg(totals.map((t) => t.kcal))!,
      protein: avg(totals.map((t) => t.protein))!,
      carbs: avg(totals.map((t) => t.carbs))!,
      fat: avg(totals.map((t) => t.fat))!,
    },
  }
}

/** Consistência: dias registados em que as calorias ficaram a ±10% do objetivo. */
export function nutritionConsistency(meals: MealEntry[], from: ISODate, to: ISODate, targetKcal: number) {
  const byDay = new Map<ISODate, number>()
  for (const m of meals) if (m.date >= from && m.date <= to) byDay.set(m.date, (byDay.get(m.date) ?? 0) + m.kcal)
  const days = byDay.size
  const onTarget = [...byDay.values()].filter((k) => Math.abs(k - targetKcal) <= targetKcal * 0.1).length
  return { days, onTarget }
}

// ---------------------------------------------------------------- recuperação

export interface RecoveryAdvice {
  level: 'ok' | 'atencao' | 'alerta'
  messages: string[]
}

export const NO_DIAGNOSIS =
  'Esta indicação é genérica e não é um diagnóstico. Se a dor persistir, piorar ou limitar o dia a dia, procura avaliação de um profissional de saúde.'

export function recoveryAdvice(logs: RecoveryLog[], today: ISODate): RecoveryAdvice {
  const recent = logs.filter((l) => l.date <= today && l.date >= addDays(today, -2)).sort((a, b) => b.date.localeCompare(a.date))
  const messages: string[] = []
  let level: RecoveryAdvice['level'] = 'ok'
  const bump = (l: RecoveryAdvice['level']) => {
    if (l === 'alerta' || (l === 'atencao' && level === 'ok')) level = l
  }
  const joint = recent.find((l) => (l.jointPain ?? 0) >= 3)
  if (joint) {
    bump('alerta')
    messages.push(
      `Registaste dor articular (${joint.jointPain}/5${joint.jointPainWhere ? ` — ${joint.jointPainWhere}` : ''}). Considera reduzir ou interromper os exercícios que a provocam e evita saltos e cargas elevadas nessa zona até melhorar.`,
    )
  } else if (recent.some((l) => (l.jointPain ?? 0) >= 1)) {
    bump('atencao')
    messages.push('Registaste algum desconforto articular. Vai monitorizando e ajusta a amplitude ou a carga se aumentar.')
  }
  if (recent.length && (avg(recent.map((l) => l.fatigue)) ?? 0) >= 4) {
    bump('alerta')
    messages.push('Fadiga elevada nos últimos dias. Considera reduzir o volume ou a intensidade (sobretudo saltos e sprints), dormir mais e prolongar a fase atual do programa.')
  }
  if (recent.some((l) => (l.soreness ?? 0) >= 5)) {
    bump('atencao')
    messages.push('Dores musculares muito elevadas: dá preferência a mobilidade suave e recuperação antes de treinos intensos.')
  }
  const sleep = avg(recent.map((l) => l.sleepH))
  if (sleep !== undefined && sleep < 6 && recent.filter((l) => l.sleepH !== undefined).length >= 2) {
    bump('atencao')
    messages.push('Sono médio inferior a 6 h nos últimos dias — a recuperação pode ficar comprometida.')
  }
  if (level !== 'ok') messages.push(NO_DIAGNOSIS)
  return { level, messages }
}

// ---------------------------------------------------------------- indicador interno (opcional)

export interface AthleticIndex {
  perCategory: Partial<Record<PerfCategory, { changePct: number; metrics: number }>>
  overall?: number
}

/**
 * Indicador interno da app (NÃO é uma pontuação científica):
 * para cada métrica com ≥ 2 registos, variação % do melhor valor mais recente face ao primeiro registo
 * (sinal ajustado: menos tempo = melhor). Cada categoria é a média das suas métricas; o geral, a média das categorias.
 */
export function athleticIndex(snap: Snapshot): AthleticIndex {
  const pm = perfPointsAll(snap)
  const acc: Partial<Record<PerfCategory, number[]>> = {}
  for (const [key, pts] of pm) {
    const def = metricDefFor(key)
    if (!def || pts.length < 2) continue
    const first = pts[0].value
    const best = def.better === 'max' ? Math.max(...pts.map((p) => p.value)) : Math.min(...pts.map((p) => p.value))
    if (!first) continue
    const change = def.better === 'max' ? ((best - first) / first) * 100 : ((first - best) / first) * 100
    ;(acc[def.category] ??= []).push(change)
  }
  for (const { exerciseId } of STRENGTH_PANEL) {
    const ser = strengthSeries(snap, exerciseId)
    if (ser.length >= 2) {
      const first = ser[0].value
      const best = Math.max(...ser.map((p) => p.value))
      ;(acc.forca ??= []).push(((best - first) / first) * 100)
    }
  }
  const perCategory: AthleticIndex['perCategory'] = {}
  for (const [cat, arr] of Object.entries(acc) as Array<[PerfCategory, number[]]>) {
    perCategory[cat] = { changePct: round(avg(arr)!, 1), metrics: arr.length }
  }
  const vals = Object.values(perCategory).map((v) => v!.changePct)
  return { perCategory, overall: vals.length ? round(avg(vals)!, 1) : undefined }
}

export { bestSet }
