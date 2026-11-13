// Plano semanal oficial, fases do programa de 12 semanas e agendamento.

import { addDays, diffDays, weekdayISO } from './dates'
import type {
  ExerciseDef,
  ISODate,
  ScheduleOverride,
  Session,
  Settings,
  TemplateExercise,
  WorkoutTemplate,
} from './types'

// ---------------------------------------------------------------- templates oficiais

function te(
  id: string,
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax: number,
  restSec: number,
  label?: string,
): TemplateExercise {
  return { id, exerciseId, sets, repMin, repMax, restSec, label }
}

export function defaultTemplates(now = Date.now()): WorkoutTemplate[] {
  return [
    {
      id: 'tpl-swim',
      name: 'Natação',
      subtitle: 'Resistência cardiovascular, técnica e condicionamento',
      kind: 'swim',
      weekday: 1,
      durationLabel: '25–35 min',
      exercises: [
        te('s1', 'nat-aquecimento', 1, 1, 1, 0, '5 min de natação suave'),
        te('s2', 'nat-bloco-principal', 5, 1, 1, 60, '5 ciclos × (2 min a nadar + 1 min de descanso)'),
        te('s3', 'nat-tecnica', 1, 1, 1, 0, '5 min de exercícios técnicos'),
        te('s4', 'nat-retorno', 1, 1, 1, 0, '5 min de natação suave'),
      ],
      updatedAt: now,
    },
    {
      id: 'tpl-upper-strength',
      name: 'Upper Strength',
      subtitle: 'Força da parte superior',
      kind: 'strength',
      weekday: 2,
      durationLabel: '60–70 min',
      exercises: [
        te('u1', 'supino-plano', 3, 5, 8, 150),
        te('u2', 'puxada-polia-alta', 3, 8, 10, 120),
        te('u3', 'remada-apoio-peito', 3, 8, 10, 120),
        te('u4', 'desenvolvimento-ombros', 2, 8, 10, 120),
        te('u5', 'elevacoes-laterais', 3, 12, 15, 75),
        te('u6', 'curl-biceps', 2, 10, 12, 75),
        te('u7', 'triceps-polia', 2, 10, 12, 75),
      ],
      updatedAt: now,
    },
    {
      id: 'tpl-lower-strength',
      name: 'Lower Strength + Pliometria',
      subtitle: 'Força de pernas com saltos antes da musculação pesada',
      kind: 'power',
      weekday: 3,
      durationLabel: '70–80 min',
      exercises: [
        te('l1', 'aquecimento-dinamico', 1, 1, 1, 0, '8 min'),
        te('l2', 'aterragem-controlada', 2, 3, 3, 90),
        te('l3', 'salto-vertical', 3, 3, 3, 120),
        te('l4', 'agachamento', 3, 5, 8, 180),
        te('l5', 'peso-morto-romeno', 3, 8, 8, 150),
        te('l6', 'leg-curl', 2, 10, 12, 75),
        te('l7', 'gemeos', 3, 12, 15, 75),
        te('l8', 'crunch-polia', 3, 12, 12, 60),
      ],
      updatedAt: now,
    },
    {
      id: 'tpl-upper-hyp',
      name: 'Upper Hypertrophy',
      subtitle: 'Hipertrofia da parte superior',
      kind: 'strength',
      weekday: 4,
      durationLabel: '60–70 min',
      exercises: [
        te('h1', 'supino-inclinado-halteres', 3, 8, 12, 120),
        te('h2', 'puxada-pega-neutra', 3, 8, 12, 120),
        te('h3', 'remada-sentada', 2, 10, 12, 90),
        te('h4', 'elevacoes-laterais', 3, 12, 20, 75),
        te('h5', 'reverse-pec-deck', 2, 12, 15, 75),
        te('h6', 'curl-inclinado', 3, 10, 12, 75),
        te('h7', 'extensao-triceps-cabeca', 3, 10, 12, 75),
      ],
      updatedAt: now,
    },
    {
      id: 'tpl-speed',
      name: 'Speed & Agility',
      subtitle: 'Técnica de corrida, aceleração e agilidade',
      kind: 'speed',
      weekday: 5,
      durationLabel: '50–60 min',
      exercises: [
        te('p1', 'aquecimento-progressivo', 1, 1, 1, 0, '10–15 min, progressivo'),
        te('p2', 'marcha-tecnica', 2, 1, 1, 45, '2 × 15–20 m'),
        te('p3', 'a-skip', 2, 1, 1, 45, '2 × 15–20 m (adaptado ao teu nível)'),
        te('p4', 'elevacao-joelhos', 2, 1, 1, 45, '2 × 15–20 m'),
        te('p5', 'coordenacao-bracos', 2, 1, 1, 45, '2 séries curtas'),
        te('p6', 'aceleracao', 5, 1, 1, 120, '4–6 × 10–20 m, intensidade moderada'),
        te('p7', 'deslocamentos-laterais', 3, 1, 1, 60, '3–4 séries curtas'),
        te('p8', 'mudancas-direcao', 3, 1, 1, 75, '3–4 séries curtas'),
      ],
      notes: 'Não introduzir sprints máximos sem adaptação prévia.',
      updatedAt: now,
    },
    {
      id: 'tpl-lower-power',
      name: 'Lower Power + Hypertrophy',
      subtitle: 'Potência e hipertrofia de pernas',
      kind: 'power',
      weekday: 6,
      durationLabel: '70–80 min',
      exercises: [
        te('w1', 'aquecimento-dinamico', 1, 1, 1, 0, '8 min'),
        te('w2', 'salto-horizontal', 3, 3, 3, 120),
        te('w3', 'leg-press', 3, 8, 12, 150),
        te('w4', 'hip-thrust', 3, 8, 12, 120),
        te('w5', 'leg-extension', 2, 12, 15, 75),
        te('w6', 'leg-curl', 2, 10, 15, 75),
        te('w7', 'gemeos', 3, 12, 20, 75),
        te('w8', 'elevacao-pernas', 3, 10, 15, 60),
      ],
      updatedAt: now,
    },
    {
      id: 'tpl-rest',
      name: 'Descanso',
      subtitle: 'Sem treino obrigatório — recuperação',
      kind: 'rest',
      weekday: 7,
      exercises: [],
      notes: 'Opcional: caminhada, mobilidade suave, alongamentos. Descansar faz parte do plano.',
      updatedAt: now,
    },
  ]
}

// ---------------------------------------------------------------- fases

export interface PhaseInfo {
  n: 1 | 2 | 3
  name: string
  weeksLabel: string
  rir: string
  summary: string
  rules: string[]
}

export const PHASES: PhaseInfo[] = [
  {
    n: 1,
    name: 'Readaptação',
    weeksLabel: 'Semanas 1–2',
    rir: '3–4 repetições de reserva',
    summary: 'Retomar com baixo volume, técnica e aprendizagem das aterragens.',
    rules: [
      'Musculação com 1–2 séries por exercício, cargas moderadas, 3–4 repetições de reserva.',
      'Técnica como prioridade.',
      'Baixo volume de saltos; aprendizagem das aterragens.',
      'Corrida técnica e acelerações submáximas.',
      'Sem sprints máximos, sem saltos em profundidade e sem testes máximos de força.',
    ],
  },
  {
    n: 2,
    name: 'Desenvolvimento',
    weeksLabel: 'Semanas 3–6',
    rir: '2–3 repetições de reserva',
    summary: 'Aproximação progressiva ao volume completo e progressão das cargas.',
    rules: [
      'Aproximação progressiva ao volume completo.',
      'Progressão das cargas (progressão dupla).',
      'Introdução gradual de saltos mais exigentes — só com a tua confirmação.',
      'Desenvolvimento da força e hipertrofia, técnica de aceleração e condicionamento aeróbico.',
    ],
  },
  {
    n: 3,
    name: 'Performance',
    weeksLabel: 'Semanas 7–12',
    rir: '1–3 repetições de reserva',
    summary: 'Progressão da força e potência, com reavaliação do desempenho.',
    rules: [
      'Progressão da força e hipertrofia contínua.',
      'Maior intensidade de potência, se houver boa tolerância.',
      'Salto vertical, aceleração, agilidade e resistência.',
      'Reavaliação do desempenho no final.',
    ],
  },
]

export const PLYO_LEVELS: Record<1 | 2 | 3, { name: string; guidance: string }> = {
  1: {
    name: 'Nível 1 — Aprendizagem',
    guidance: 'Aterragens controladas e saltos a ~70–80% do esforço, volume baixo. Prioriza a qualidade.',
  },
  2: {
    name: 'Nível 2 — Desenvolvimento',
    guidance: 'Saltos com esforço elevado (~90%) e volume completo (3 × 3). Recupera totalmente entre séries.',
  },
  3: {
    name: 'Nível 3 — Performance',
    guidance: 'Esforço máximo com boa tolerância. Só avança com aterragens estáveis e sem dor.',
  },
}

export const DEFAULT_PHASE_STARTS: [number, number] = [3, 7]

export function programWeek(date: ISODate, startDate: ISODate): number {
  return Math.floor(diffDays(date, startDate) / 7) + 1
}

export function phaseForWeek(week: number, phaseStarts: [number, number]): 1 | 2 | 3 {
  if (week >= phaseStarts[1]) return 3
  if (week >= phaseStarts[0]) return 2
  return 1
}

export function phaseStartWeek(phase: 1 | 2 | 3, phaseStarts: [number, number]): number {
  return phase === 1 ? 1 : phase === 2 ? phaseStarts[0] : phaseStarts[1]
}

export interface ProgramPosition {
  week: number
  beforeStart: boolean
  phase: 1 | 2 | 3
  weekInPhase: number
  phaseInfo: PhaseInfo
  /** Última semana da fase atual (null na fase 3 após semana 12 não há fim fixo). */
  lastWeekOfPhase: number | null
  isLastWeekOfPhase: boolean
  beyondProgram: boolean
}

export function programPosition(date: ISODate, settings: Pick<Settings, 'program'>): ProgramPosition {
  const { startDate, phaseStarts } = settings.program
  const week = programWeek(date, startDate)
  const beforeStart = week < 1
  const w = Math.max(1, week)
  const phase = phaseForWeek(w, phaseStarts)
  const startW = phaseStartWeek(phase, phaseStarts)
  const lastWeekOfPhase = phase === 1 ? phaseStarts[0] - 1 : phase === 2 ? phaseStarts[1] - 1 : null
  return {
    week,
    beforeStart,
    phase,
    weekInPhase: w - startW + 1,
    phaseInfo: PHASES[phase - 1],
    lastWeekOfPhase,
    isLastWeekOfPhase: lastWeekOfPhase !== null && w === lastWeekOfPhase,
    beyondProgram: w > 12,
  }
}

/** Prolonga a fase indicada em N semanas (adia o início das fases seguintes). */
export function extendPhase(phaseStarts: [number, number], phase: 1 | 2, weeks = 1): [number, number] {
  if (phase === 1) return [phaseStarts[0] + weeks, phaseStarts[1] + weeks]
  return [phaseStarts[0], phaseStarts[1] + weeks]
}

// ---------------------------------------------------------------- prescrição ajustada à fase

export interface AdjustedPlan {
  sets: number
  note?: string
}

/**
 * Ajusta o número de séries à fase do programa (sem alterar o template do utilizador).
 * Fase 1: 1–2 séries de musculação; Fase 2 (1.ª semana): volume quase completo; depois volume completo.
 */
export function adjustPlan(
  tex: TemplateExercise,
  def: ExerciseDef | undefined,
  pos: ProgramPosition,
): AdjustedPlan {
  const planned = tex.sets
  const lt = def?.logType ?? 'strength'
  const p = pos.phase
  if (pos.beforeStart) return { sets: planned }
  if (lt === 'strength') {
    let sets = planned
    if (p === 1) sets = pos.weekInPhase === 1 ? Math.max(1, Math.round(planned / 2)) : Math.min(planned, 2)
    else if (p === 2 && pos.weekInPhase === 1) sets = planned <= 2 ? planned : Math.max(2, planned - 1)
    return {
      sets,
      note: sets !== planned ? `Fase ${p}: ${sets} em vez de ${planned} séries (volume progressivo).` : undefined,
    }
  }
  if (lt === 'jump') {
    if (p === 1) {
      const sets = Math.min(planned, 2)
      return { sets, note: `Fase 1: baixo volume de saltos${sets !== planned ? ` (${sets} em vez de ${planned} séries)` : ''}; foco na aterragem.` }
    }
    return { sets: planned }
  }
  if (lt === 'sprint') {
    if (p === 1) return { sets: Math.min(planned, 4), note: 'Fase 1: acelerações submáximas (~70–80%). Sem sprints máximos.' }
    if (p === 2 && pos.weekInPhase <= 2) return { sets: Math.min(planned, 5), note: 'Aumenta a velocidade progressivamente; mantém controlo.' }
    return { sets: planned }
  }
  if (lt === 'agility') {
    if (p === 1) return { sets: Math.min(planned, 3), note: 'Fase 1: mudanças de direção controladas, intensidade moderada.' }
    return { sets: planned }
  }
  return { sets: planned }
}

// ---------------------------------------------------------------- agendamento

export function plannedTemplatesForDate(
  date: ISODate,
  templates: WorkoutTemplate[],
  overrides: ScheduleOverride[],
): WorkoutTemplate[] {
  const wd = weekdayISO(date)
  const hidden = new Set(overrides.filter((o) => o.date === date && o.action === 'hide').map((o) => o.templateId))
  const added = new Set(overrides.filter((o) => o.date === date && o.action === 'add').map((o) => o.templateId))
  const out: WorkoutTemplate[] = []
  for (const t of templates) {
    if (t.archived) continue
    const regular = t.weekday === wd && !hidden.has(t.id)
    if (regular || added.has(t.id)) out.push(t)
  }
  return out
}

export type DayStatus = 'planeado' | 'concluido' | 'parcial' | 'nao-realizado' | 'descanso' | 'em-curso' | 'adiado' | 'sem-plano'

export interface DayItem {
  template: WorkoutTemplate
  status: DayStatus
  session?: Session
  movedTo?: ISODate
}

export function dayItems(
  date: ISODate,
  today: ISODate,
  startDate: ISODate,
  templates: WorkoutTemplate[],
  overrides: ScheduleOverride[],
  sessions: Session[],
): DayItem[] {
  const planned = plannedTemplatesForDate(date, templates, overrides)
  const items: DayItem[] = planned.map((t) => {
    const s = sessions.find((x) => x.date === date && x.templateId === t.id)
    return { template: t, status: statusFor(t, s, date, today, startDate), session: s }
  })
  // treinos adiados a partir deste dia
  const wd = weekdayISO(date)
  for (const o of overrides) {
    if (o.date === date && o.action === 'hide' && o.movedTo) {
      const t = templates.find((x) => x.id === o.templateId)
      if (t && t.weekday === wd) items.push({ template: t, status: 'adiado', movedTo: o.movedTo })
    }
  }
  return items
}

function statusFor(t: WorkoutTemplate, s: Session | undefined, date: ISODate, today: ISODate, start: ISODate): DayStatus {
  if (s) return s.status === 'active' ? 'em-curso' : s.status === 'partial' ? 'parcial' : 'concluido'
  if (t.kind === 'rest') return 'descanso'
  if (date < today && date >= start) return 'nao-realizado'
  return 'planeado'
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  planeado: 'Planeado',
  concluido: 'Concluído',
  parcial: 'Parcialmente concluído',
  'nao-realizado': 'Não realizado',
  descanso: 'Descanso',
  'em-curso': 'Em curso',
  adiado: 'Adiado',
  'sem-plano': 'Sem plano',
}

export function nextPlannedAfter(
  from: ISODate,
  templates: WorkoutTemplate[],
  overrides: ScheduleOverride[],
  includeRest = false,
): { date: ISODate; template: WorkoutTemplate } | undefined {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(from, i)
    const t = plannedTemplatesForDate(d, templates, overrides).find((x) => includeRest || x.kind !== 'rest')
    if (t) return { date: d, template: t }
  }
  return undefined
}
