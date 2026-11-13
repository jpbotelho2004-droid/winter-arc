import { db } from './db'
import { defaultSettings, exerciseMap } from './repo'
import type { Snapshot } from './stats'

/** Lê todos os dados (sem fotografias) para cálculos, relatórios e dashboards. */
export async function loadSnapshot(): Promise<Snapshot> {
  const [settings, templates, sessions, schedule, bodyLogs, foods, savedMeals, meals, dayLogs, recovery, assessments, customExercises, exerciseMeta, exMap] =
    await Promise.all([
      db.settings.get('main').then((s) => s ?? defaultSettings()),
      db.templates.toArray(),
      db.sessions.toArray(),
      db.schedule.toArray(),
      db.bodyLogs.toArray(),
      db.foods.toArray(),
      db.savedMeals.toArray(),
      db.meals.toArray(),
      db.dayLogs.toArray(),
      db.recovery.toArray(),
      db.assessments.toArray(),
      db.customExercises.toArray(),
      db.exerciseMeta.toArray(),
      exerciseMap(),
    ])
  return { settings, templates, sessions, schedule, bodyLogs, foods, savedMeals, meals, dayLogs, recovery, assessments, customExercises, exerciseMeta, exMap }
}
