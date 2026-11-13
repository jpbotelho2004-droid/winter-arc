// Operações puras sobre sessões de treino (imutáveis) — usadas pela UI e pelos testes.

import { makeSet, uid } from './calc'
import { adjustPlan, programPosition } from './program'
import type {
  ExerciseDef,
  ISODate,
  Session,
  SessionExercise,
  SessionKind,
  SetEntry,
  Settings,
  WorkoutTemplate,
} from './types'

export type ExMap = Map<string, ExerciseDef>

export interface BuildOpts {
  template?: WorkoutTemplate
  name?: string
  kind?: SessionKind
  date: ISODate
  settings: Settings
  exMap: ExMap
  now?: number
}

export function sessionExerciseFromDef(def: ExerciseDef, restSec: number, plan?: SessionExercise['plan'], nSets = 3): SessionExercise {
  return {
    id: uid('sx'),
    exerciseId: def.id,
    name: def.namePt,
    logType: def.logType,
    primary: def.primary,
    plan,
    restSec,
    sets: Array.from({ length: nSets }, () => makeSet()),
  }
}

export function buildSession(o: BuildOpts): Session {
  const now = o.now ?? Date.now()
  const pos = programPosition(o.date, o.settings)
  const exercises: SessionExercise[] = []
  for (const tex of o.template?.exercises ?? []) {
    const def = o.exMap.get(tex.exerciseId)
    const adj = adjustPlan(tex, def, pos)
    exercises.push({
      id: uid('sx'),
      exerciseId: tex.exerciseId,
      name: def?.namePt ?? tex.exerciseId,
      logType: def?.logType ?? 'strength',
      primary: def?.primary ?? 'corpo-inteiro',
      plan: { sets: adj.sets, repMin: tex.repMin, repMax: tex.repMax, label: tex.label },
      restSec: tex.restSec,
      sets: Array.from({ length: Math.max(1, adj.sets) }, () => makeSet()),
      phaseNote: adj.note,
    })
  }
  return {
    id: uid('ses'),
    date: o.date,
    templateId: o.template?.id,
    name: o.template?.name ?? o.name ?? 'Treino livre',
    kind: o.template?.kind ?? o.kind ?? 'custom',
    status: 'active',
    startedAt: now,
    exercises,
    programWeek: pos.week,
    phase: pos.phase,
    planned: !!o.template,
    updatedAt: now,
  }
}

function mapEx(s: Session, exId: string, fn: (e: SessionExercise) => SessionExercise): Session {
  return { ...s, exercises: s.exercises.map((e) => (e.id === exId ? fn(e) : e)) }
}

export function addExercise(s: Session, def: ExerciseDef, restSec: number): Session {
  const nSets = def.logType === 'checklist' ? 1 : 3
  const plan = def.logType === 'strength' ? { sets: nSets, repMin: 8, repMax: 12 } : undefined
  return { ...s, exercises: [...s.exercises, sessionExerciseFromDef(def, restSec, plan, nSets)] }
}

export function removeExercise(s: Session, exId: string): Session {
  return { ...s, exercises: s.exercises.filter((e) => e.id !== exId) }
}

export function moveExercise(s: Session, exId: string, dir: -1 | 1): Session {
  const i = s.exercises.findIndex((e) => e.id === exId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= s.exercises.length) return s
  const arr = s.exercises.slice()
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  return { ...s, exercises: arr }
}

export function replaceExercise(s: Session, exId: string, def: ExerciseDef): Session {
  return mapEx(s, exId, (e) => ({
    ...e,
    exerciseId: def.id,
    name: def.namePt,
    logType: def.logType,
    primary: def.primary,
    sets: def.logType === e.logType ? e.sets : [makeSet()],
  }))
}

export function addSet(s: Session, exId: string): Session {
  return mapEx(s, exId, (e) => {
    const last = e.sets[e.sets.length - 1]
    // não copia valores realizados: a nova série começa vazia
    return { ...e, sets: [...e.sets, makeSet({ type: last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal') })] }
  })
}

export function removeSet(s: Session, exId: string, setId: string): Session {
  return mapEx(s, exId, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) }))
}

export function duplicateSet(s: Session, exId: string, setId: string): Session {
  return mapEx(s, exId, (e) => {
    const i = e.sets.findIndex((x) => x.id === setId)
    if (i < 0) return e
    const copy: SetEntry = { ...e.sets[i], id: uid('set'), done: false, doneAt: undefined }
    const sets = e.sets.slice()
    sets.splice(i + 1, 0, copy)
    return { ...e, sets }
  })
}

export function updateSet(s: Session, exId: string, setId: string, patch: Partial<SetEntry>): Session {
  return mapEx(s, exId, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) }))
}

export function updateExercise(s: Session, exId: string, patch: Partial<SessionExercise>): Session {
  return mapEx(s, exId, (e) => ({ ...e, ...patch }))
}

/** Marca/desmarca uma série. Ao concluir, arranca o descanso (se configurado). */
export function toggleSetDone(s: Session, exId: string, setId: string, now = Date.now()): Session {
  const ex = s.exercises.find((e) => e.id === exId)
  const set = ex?.sets.find((x) => x.id === setId)
  if (!ex || !set) return s
  const done = !set.done
  let next = updateSet(s, exId, setId, { done, doneAt: done ? now : undefined })
  if (done && ex.restSec > 0 && ex.logType !== 'checklist') {
    next = { ...next, rest: { endsAt: now + ex.restSec * 1000, durationSec: ex.restSec, exerciseName: ex.name } }
  }
  return next
}

export function startRest(s: Session, seconds: number, now = Date.now(), exerciseName?: string): Session {
  return { ...s, rest: { endsAt: now + seconds * 1000, durationSec: seconds, exerciseName } }
}

export function skipRest(s: Session): Session {
  return { ...s, rest: undefined }
}

export function adjustRest(s: Session, deltaSec: number, now = Date.now()): Session {
  if (!s.rest) return s
  const endsAt = Math.max(now, s.rest.endsAt + deltaSec * 1000)
  return { ...s, rest: { ...s.rest, endsAt, durationSec: Math.max(5, s.rest.durationSec + deltaSec), alerted: false } }
}

/** Uma sessão é "concluída" se todos os exercícios têm pelo menos uma série feita; caso contrário, parcial. */
export function finalStatus(s: Session): 'completed' | 'partial' {
  if (!s.exercises.length) return 'completed'
  const allTouched = s.exercises.every((e) => e.sets.some((x) => x.done))
  return allTouched ? 'completed' : 'partial'
}

export function finishSessionPure(s: Session, now = Date.now(), extra: Partial<Session> = {}): Session {
  // remove séries vazias não concluídas para não poluir o histórico
  const exercises = s.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done || hasData(x)) }))
    .filter((e) => e.sets.length > 0 || e.logType === 'swim')
  const base: Session = { ...s, ...extra, exercises, endedAt: now, rest: undefined, updatedAt: now, status: 'completed' }
  const status = finalStatus({ ...base, exercises: s.exercises })
  return { ...base, status }
}

function hasData(x: SetEntry): boolean {
  return (
    x.weightKg !== undefined ||
    x.reps !== undefined ||
    x.timeS !== undefined ||
    x.distanceM !== undefined ||
    x.heightCm !== undefined ||
    x.distanceCm !== undefined
  )
}
