// Tipos centrais da aplicação. Todas as entidades guardadas têm `updatedAt` (ms) para fusão segura em importações.

export type ISODate = string // YYYY-MM-DD (fuso Europe/Lisbon)

export type LogType = 'strength' | 'jump' | 'sprint' | 'agility' | 'swim' | 'checklist' | 'cardio'

export type MuscleGroup =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'isquiotibiais'
  | 'gluteos'
  | 'gemeos'
  | 'core'
  | 'corpo-inteiro'
  | 'cardio'

export type SessionKind = 'swim' | 'strength' | 'power' | 'speed' | 'rest' | 'custom'

export type JumpMetric = 'vertical-jump' | 'broad-jump'

export interface PlyoGuide {
  start: string
  arms: string
  takeoff: string
  landing: string
  knees: string
  trunk: string
  badExecution: string[]
}

export interface ExerciseDef {
  id: string
  namePt: string
  nameEn: string
  logType: LogType
  primary: MuscleGroup
  secondary: MuscleGroup[]
  equipment: string
  goal: string
  restSec: number
  instructions: string[]
  technique: string[]
  mistakes: string[]
  safety: string[]
  alternatives: string[]
  plyo?: PlyoGuide
  /** Só exercícios onde uma estimativa de 1RM faz sentido. */
  e1rm?: boolean
  /** Incremento sugerido na progressão dupla (kg). */
  incrementKg?: number
  metric?: JumpMetric
  /** O que se regista nos saltos: altura/distância do salto (por defeito), altura da caixa ('box') ou só esforço ('none'). */
  jumpInput?: 'box' | 'none'
  /** Pesquisa de vídeo (nunca um URL inventado). */
  videoQuery: string
  compound?: boolean
  bodyweight?: boolean
  custom?: boolean
  updatedAt?: number
}

export interface ExerciseMeta {
  id: string // = exerciseId
  favorite?: boolean
  notes?: string
  /** URL de vídeo escolhido pelo utilizador. */
  videoUrl?: string
  updatedAt: number
}

export interface Plan {
  sets: number
  repMin: number
  repMax: number
  /** Texto livre para a prescrição (ex.: "4–6 × 10–20 m"). */
  label?: string
}

export type PhaseNumber = 1 | 2 | 3 | 4
export type Variant = 'A' | 'B'

/** Prescrição específica de uma fase (substitui a regra genérica de volume). */
export interface PhasePrescription {
  sets?: number
  repMin?: number
  repMax?: number
  label?: string
  note?: string
}

export interface TemplateExercise {
  id: string
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  label?: string
  notes?: string
  /** Opcional: ignorá-lo não torna o treino incompleto (ex.: cardio no fim). */
  optional?: boolean
  /** Só entra na sessão na variante escolhida (treinos com variantes A/B). */
  variant?: Variant
  /** Só é incluído a partir desta fase do programa. */
  fromPhase?: PhaseNumber
  /** Prescrição por fase (sets/reps/label). */
  phases?: Partial<Record<PhaseNumber, PhasePrescription>>
}

export interface WorkoutTemplate {
  id: string
  name: string
  subtitle?: string
  kind: SessionKind
  /** 1 = segunda … 7 = domingo. Vazio = treino sem dia fixo. */
  weekday?: number
  durationLabel?: string
  /** Treinos com duas variantes selecionáveis (ex.: sábado A = saltos, B = sprints). */
  variants?: Record<Variant, string>
  /** Versão do programa a que pertence (2 = programa atual). */
  programV?: number
  exercises: TemplateExercise[]
  notes?: string
  archived?: boolean
  updatedAt: number
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure'

export interface SetEntry {
  id: string
  type: SetType
  weightKg?: number
  reps?: number
  rpe?: number
  rir?: number
  done: boolean
  notes?: string
  distanceM?: number
  timeS?: number
  heightCm?: number
  distanceCm?: number
  /** Altura da caixa (cm) nos saltos para caixa — NÃO é a altura do salto. */
  boxCm?: number
  /** Qualidade da aterragem 1–5. */
  landing?: number
  restS?: number
  doneAt?: number
}

export interface SessionExercise {
  id: string
  exerciseId: string
  name: string
  logType: LogType
  primary: MuscleGroup
  plan?: Plan
  restSec: number
  sets: SetEntry[]
  notes?: string
  surface?: string
  course?: string
  /** Descrição da prescrição ajustada à fase (informativa). */
  phaseNote?: string
  /** Opcional: não conta para o estado "concluído". */
  optional?: boolean
}

export interface SwimData {
  pool?: 25 | 50
  distanceM?: number
  laps?: number
  totalSec?: number
  effectiveSec?: number
  stroke?: string
  rpe?: number
  restsCount?: number
  notes?: string
}

export type SessionStatus = 'active' | 'completed' | 'partial'

export interface RestTimer {
  endsAt: number
  durationSec: number
  exerciseName?: string
  alerted?: boolean
}

export interface Session {
  id: string
  date: ISODate
  templateId?: string
  name: string
  kind: SessionKind
  status: SessionStatus
  startedAt: number
  endedAt?: number
  exercises: SessionExercise[]
  notes?: string
  rpe?: number
  swim?: SwimData
  programWeek?: number
  phase?: number
  /** Variante escolhida (treinos com variantes). */
  variant?: Variant
  /** Séries obrigatórias planeadas (para a fase), guardadas ao terminar; exclui exercícios opcionais. */
  plannedSets?: number
  /** 2 = sessão criada com o programa v2 (fases 1–4). Ausente = programa anterior (fases 1–3). */
  programV?: number
  planned?: boolean
  rest?: RestTimer
  updatedAt: number
}

export interface ScheduleOverride {
  id: string
  date: ISODate
  templateId: string
  action: 'add' | 'hide'
  /** Para 'hide' resultante de um adiamento: nova data. */
  movedTo?: ISODate
  updatedAt: number
}

export interface BodyLog {
  id: string // = data
  date: ISODate
  weightKg?: number
  waistCm?: number
  chestCm?: number
  armCm?: number
  thighCm?: number
  hipCm?: number
  /** Só se medida (ex.: bioimpedância/pregas). Nunca estimada pela app. */
  bodyFatPct?: number
  notes?: string
  updatedAt: number
}

export interface Photo {
  id: string
  date: ISODate
  blob: Blob
  mime: string
  note?: string
  updatedAt: number
}

export interface Food {
  id: string
  name: string
  /** Valores por 100 g ou por unidade/porção. */
  basis: '100g' | 'unit'
  unitLabel?: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  source?: string
  updatedAt: number
}

export interface MealItem {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface SavedMeal {
  id: string
  name: string
  items: MealItem[]
  updatedAt: number
}

export type MealSlot = 'pequeno-almoco' | 'almoco' | 'lanche' | 'jantar' | 'ceia' | 'pre-treino' | 'pos-treino'

export interface MealEntry {
  id: string
  date: ISODate
  slot: MealSlot
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  quantity?: number
  foodId?: string
  updatedAt: number
}

export interface DayLog {
  id: string // = data
  date: ISODate
  waterMl?: number
  supplements?: Record<string, boolean>
  rest?: { walk?: boolean; walkMin?: number; mobility?: boolean; stretching?: boolean; recovery?: boolean }
  notes?: string
  updatedAt: number
}

export interface RecoveryLog {
  id: string // = data
  date: ISODate
  sleepH?: number
  sleepQ?: number
  energy?: number
  fatigue?: number
  soreness?: number
  stress?: number
  motivation?: number
  jointPain?: number
  jointPainWhere?: string
  notes?: string
  updatedAt: number
}

export interface Assessment {
  id: string
  date: ISODate
  /** Chave de métrica, ex.: 'vertical-jump', 'sprint-20', 'agility:t-test'. */
  metric: string
  value: number
  unit: string
  protocol?: string
  notes?: string
  updatedAt: number
}

export interface SupplementDef {
  id: string
  name: string
  dose?: string
  enabled: boolean
}

export interface Settings {
  id: 'main'
  displayName: string
  heightCm: number
  startWeightKg: number
  goalText: string
  theme: 'dark' | 'light' | 'auto'
  restCompoundSec: number
  restIsolationSec: number
  sound: boolean
  vibrate: boolean
  notifications: boolean
  keepAwake: boolean
  nutrition: { kcal: number; protein: number; fat: number; carbs: number }
  waterGoalMl?: number
  supplements: SupplementDef[]
  program: {
    startDate: ISODate
    /** Semanas (1-based) em que começam as fases 2, 3 e 4. */
    phaseStarts: [number, number, number]
    /** Nível de pliometria confirmado pelo utilizador (1–3). */
    plyoLevel: 1 | 2 | 3
    /** Semana de volume reduzido (fadiga elevada / dor articular): menos 1 série por exercício. */
    reduceVolume?: boolean
  }
  /** Metas definidas pelo utilizador por métrica (ex.: { 'vertical-jump': 55 }). */
  targets?: Record<string, number>
  scoreEnabled: boolean
  /** Versão do programa de treino instalada (2 = programa atual). */
  programVersion?: number
  onboarded: boolean
  lastBackupAt?: number
  updatedAt: number
}

export const BACKUP_APP = 'winter-arc'
export const BACKUP_SCHEMA_VERSION = 1

export const BACKUP_TABLES = [
  'settings',
  'templates',
  'sessions',
  'schedule',
  'bodyLogs',
  'photos',
  'foods',
  'savedMeals',
  'meals',
  'dayLogs',
  'recovery',
  'assessments',
  'customExercises',
  'exerciseMeta',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]
