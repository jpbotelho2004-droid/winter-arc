// Operações de dados (leitura/escrita) sobre a base de dados local.

import { db } from './db'
import { addDays, startOfWeek, todayISO, weekdayISO } from './dates'
import { builtinExercise, LIBRARY } from './exercises'
import { DEFAULT_PHASE_STARTS, PROGRAM_VERSION, V1_TEMPLATE_IDS, V2_MARKER_ID, defaultTemplates, normalizePhaseStarts } from './program'
import { buildSession, finishSessionPure, type ExMap } from './sessionOps'
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
  Settings,
  Variant,
  WorkoutTemplate,
} from './types'
import { uid } from './calc'

export function defaultSettings(today: ISODate = todayISO(), now = Date.now()): Settings {
  // início do programa: hoje, se for segunda-feira; caso contrário, a próxima segunda-feira
  const start = weekdayISO(today) === 1 ? today : addDays(startOfWeek(today), 7)
  return {
    id: 'main',
    displayName: '',
    heightCm: 181,
    startWeightKg: 80,
    goalText: 'Físico atlético, musculado e definido, com força, potência, velocidade e resistência.',
    theme: 'dark',
    restCompoundSec: 150,
    restIsolationSec: 75,
    sound: true,
    vibrate: true,
    notifications: false,
    keepAwake: true,
    nutrition: { kcal: 2600, protein: 160, fat: 75, carbs: 320 },
    supplements: [{ id: 'creatina', name: 'Creatina', dose: '3–5 g/dia', enabled: true }],
    program: { startDate: start, phaseStarts: [...DEFAULT_PHASE_STARTS], plyoLevel: 1 },
    scoreEnabled: false,
    onboarded: false,
    updatedAt: now,
  }
}

/**
 * Instala o programa v2 sem apagar nada: os 5 treinos de musculação do programa anterior são
 * ARQUIVADOS (as sessões já registadas ficam intactas, pois guardam uma cópia dos exercícios),
 * os treinos novos são acrescentados e Natação/Descanso são atualizados. Converte também as
 * fases do formato antigo (3 fases) para o novo (4 fases). Idempotente e seguro de repetir
 * (ex.: depois de importar uma cópia de segurança antiga). Deve correr dentro de uma transação.
 */
export async function applyProgramV2(now = Date.now()): Promise<void> {
  const hasV2 = !!(await db.templates.get(V2_MARKER_ID))
  if (!hasV2) await db.templates.bulkPut(defaultTemplates(now))
  for (const id of V1_TEMPLATE_IDS) {
    const t = await db.templates.get(id)
    if (t && !t.archived) await db.templates.put({ ...t, archived: true, updatedAt: now })
  }
  const s = await db.settings.get('main')
  if (s) {
    const phaseStarts = normalizePhaseStarts(s.program?.phaseStarts)
    if (s.program?.phaseStarts?.length !== 3 || s.programVersion !== PROGRAM_VERSION) {
      await db.settings.put({ ...s, program: { ...s.program, phaseStarts }, programVersion: PROGRAM_VERSION, updatedAt: now })
    }
  }
}

/** Cria as definições e o plano na primeira utilização e migra para o programa v2. Nunca cria dados de treino. */
export async function ensureSeeded(): Promise<Settings> {
  return db.transaction('rw', db.settings, db.templates, async () => {
    let s = await db.settings.get('main')
    if (!s) {
      s = { ...defaultSettings(), programVersion: PROGRAM_VERSION }
      await db.settings.put(s)
    }
    if ((await db.templates.count()) === 0) await db.templates.bulkPut(defaultTemplates())
    await applyProgramV2()
    return (await db.settings.get('main')) as Settings
  })
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? (await ensureSeeded())
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const cur = await getSettings()
  const next = { ...cur, ...patch, id: 'main' as const, updatedAt: Date.now() }
  await db.settings.put(next)
  return next
}

/** Repõe o plano oficial (v2). Mantém treinos personalizados, o plano anterior arquivado e todo o histórico. */
export async function resetOfficialPlan(): Promise<void> {
  await db.templates.bulkPut(defaultTemplates())
}

export async function exerciseMap(): Promise<ExMap> {
  const customs = await db.customExercises.toArray()
  return new Map<string, ExerciseDef>([...LIBRARY, ...customs].map((e) => [e.id, e]))
}

// ---------------------------------------------------------------- sessões

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first()
}

export async function startSessionFromTemplate(templateId: string, date: ISODate = todayISO(), variant?: Variant): Promise<Session> {
  const existing = await getActiveSession()
  if (existing) return existing
  const template = await db.templates.get(templateId)
  if (!template) throw new Error('Treino não encontrado.')
  const settings = await getSettings()
  const session = buildSession({ template, date, settings, exMap: await exerciseMap(), variant })
  await db.sessions.add(session)
  return session
}

export async function startFreeSession(name = 'Treino livre', date: ISODate = todayISO()): Promise<Session> {
  const existing = await getActiveSession()
  if (existing) return existing
  const settings = await getSettings()
  const session = buildSession({ name, kind: 'custom', date, settings, exMap: await exerciseMap() })
  await db.sessions.add(session)
  return session
}

export async function saveSession(s: Session): Promise<void> {
  await db.sessions.put({ ...s, updatedAt: Date.now() })
}

export async function finishSession(id: string, extra: Partial<Session> = {}): Promise<Session | undefined> {
  const s = await db.sessions.get(id)
  if (!s) return undefined
  const done = finishSessionPure(s, Date.now(), extra)
  await db.sessions.put(done)
  return done
}

export async function discardSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

// ---------------------------------------------------------------- registos diários

export async function upsertBodyLog(date: ISODate, patch: Partial<BodyLog>): Promise<BodyLog> {
  const cur = (await db.bodyLogs.get(date)) ?? { id: date, date, updatedAt: 0 }
  const next: BodyLog = { ...cur, ...patch, id: date, date, updatedAt: Date.now() }
  await db.bodyLogs.put(next)
  return next
}

export async function upsertDayLog(date: ISODate, patch: Partial<DayLog>): Promise<DayLog> {
  const cur = (await db.dayLogs.get(date)) ?? { id: date, date, updatedAt: 0 }
  const next: DayLog = { ...cur, ...patch, id: date, date, updatedAt: Date.now() }
  await db.dayLogs.put(next)
  return next
}

export async function upsertRecovery(date: ISODate, patch: Partial<RecoveryLog>): Promise<RecoveryLog> {
  const cur = (await db.recovery.get(date)) ?? { id: date, date, updatedAt: 0 }
  const next: RecoveryLog = { ...cur, ...patch, id: date, date, updatedAt: Date.now() }
  await db.recovery.put(next)
  return next
}

export async function addMeal(m: Omit<MealEntry, 'id' | 'updatedAt'>): Promise<MealEntry> {
  const entry: MealEntry = { ...m, id: uid('meal'), updatedAt: Date.now() }
  await db.meals.add(entry)
  return entry
}

export async function saveFood(f: Omit<Food, 'id' | 'updatedAt'> & { id?: string }): Promise<Food> {
  const food: Food = { ...f, id: f.id ?? uid('food'), updatedAt: Date.now() }
  await db.foods.put(food)
  return food
}

export async function saveMealTemplate(name: string, items: SavedMeal['items']): Promise<SavedMeal> {
  const m: SavedMeal = { id: uid('sm'), name, items, updatedAt: Date.now() }
  await db.savedMeals.put(m)
  return m
}

export async function addAssessment(a: Omit<Assessment, 'id' | 'updatedAt'>): Promise<Assessment> {
  const x: Assessment = { ...a, id: uid('as'), updatedAt: Date.now() }
  await db.assessments.add(x)
  return x
}

export async function setExerciseMeta(id: string, patch: Partial<ExerciseMeta>): Promise<void> {
  const cur = (await db.exerciseMeta.get(id)) ?? { id, updatedAt: 0 }
  await db.exerciseMeta.put({ ...cur, ...patch, id, updatedAt: Date.now() })
}

export async function saveTemplate(t: WorkoutTemplate): Promise<void> {
  await db.templates.put({ ...t, updatedAt: Date.now() })
}

export async function duplicateTemplate(id: string): Promise<WorkoutTemplate | undefined> {
  const t = await db.templates.get(id)
  if (!t) return undefined
  const copy: WorkoutTemplate = {
    ...t,
    id: uid('tpl'),
    name: `${t.name} (cópia)`,
    weekday: undefined,
    exercises: t.exercises.map((e) => ({ ...e, id: uid('te') })),
    updatedAt: Date.now(),
  }
  await db.templates.put(copy)
  return copy
}

/** Remove um treino do plano. O histórico de sessões não é tocado (as sessões guardam cópia dos dados). */
export async function archiveTemplate(id: string): Promise<void> {
  const t = await db.templates.get(id)
  if (t) await db.templates.put({ ...t, archived: true, updatedAt: Date.now() })
}

export async function moveTemplateToWeekday(id: string, weekday: number | undefined): Promise<void> {
  const t = await db.templates.get(id)
  if (t) await db.templates.put({ ...t, weekday, updatedAt: Date.now() })
}

/** Adia um treino de `from` para `to` (apenas nessa ocorrência). */
export async function postponeTemplate(templateId: string, from: ISODate, to: ISODate): Promise<void> {
  const now = Date.now()
  const hide: ScheduleOverride = { id: `hide-${templateId}-${from}`, date: from, templateId, action: 'hide', movedTo: to, updatedAt: now }
  const add: ScheduleOverride = { id: `add-${templateId}-${to}`, date: to, templateId, action: 'add', updatedAt: now }
  await db.schedule.bulkPut([hide, add])
}

/** Planeia um treino numa data específica (sem alterar o dia habitual). */
export async function scheduleTemplate(templateId: string, date: ISODate): Promise<void> {
  await db.schedule.put({ id: `add-${templateId}-${date}`, date, templateId, action: 'add', updatedAt: Date.now() })
}

export async function unschedule(templateId: string, date: ISODate): Promise<void> {
  await db.schedule.delete(`add-${templateId}-${date}`)
}

export { builtinExercise }
