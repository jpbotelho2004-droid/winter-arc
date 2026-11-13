// Base de dados local (IndexedDB via Dexie). Nenhum dado sai do dispositivo.

import Dexie, { type Table } from 'dexie'
import type {
  Assessment,
  BodyLog,
  DayLog,
  ExerciseDef,
  ExerciseMeta,
  Food,
  MealEntry,
  Photo,
  RecoveryLog,
  SavedMeal,
  ScheduleOverride,
  Session,
  Settings,
  WorkoutTemplate,
} from './types'

export class WinterDB extends Dexie {
  settings!: Table<Settings, string>
  templates!: Table<WorkoutTemplate, string>
  sessions!: Table<Session, string>
  schedule!: Table<ScheduleOverride, string>
  bodyLogs!: Table<BodyLog, string>
  photos!: Table<Photo, string>
  foods!: Table<Food, string>
  savedMeals!: Table<SavedMeal, string>
  meals!: Table<MealEntry, string>
  dayLogs!: Table<DayLog, string>
  recovery!: Table<RecoveryLog, string>
  assessments!: Table<Assessment, string>
  customExercises!: Table<ExerciseDef, string>
  exerciseMeta!: Table<ExerciseMeta, string>

  constructor(name = 'winter-arc') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      templates: 'id, weekday, kind',
      sessions: 'id, date, status, templateId',
      schedule: 'id, date, templateId',
      bodyLogs: 'id, date',
      photos: 'id, date',
      foods: 'id, name',
      savedMeals: 'id',
      meals: 'id, date',
      dayLogs: 'id, date',
      recovery: 'id, date',
      assessments: 'id, date, metric',
      customExercises: 'id',
      exerciseMeta: 'id',
    })
  }
}

export const db = new WinterDB()

/** Pede ao navegador que não apague os dados automaticamente (importante no Safari). */
export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* ignorar */
  }
  return undefined
}
