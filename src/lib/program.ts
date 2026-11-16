// Plano semanal (programa v2), fases do programa de 12 semanas e agendamento.

import { addDays, diffDays, weekdayISO } from './dates'
import type {
  ExerciseDef,
  ISODate,
  PhaseNumber,
  PhasePrescription,
  ScheduleOverride,
  Session,
  Settings,
  TemplateExercise,
  Variant,
  WorkoutTemplate,
} from './types'

// ---------------------------------------------------------------- templates oficiais (programa v2)

export const PROGRAM_VERSION = 2

/** Treinos do programa anterior (v1). São arquivados — nunca apagados — na migração. */
export const V1_TEMPLATE_IDS = ['tpl-upper-strength', 'tpl-lower-strength', 'tpl-upper-hyp', 'tpl-speed', 'tpl-lower-power']

/** Marcador de que o programa v2 já foi instalado. */
export const V2_MARKER_ID = 'tpl-push'

interface TeOpts {
  label?: string
  optional?: boolean
  variant?: Variant
  fromPhase?: PhaseNumber
  phases?: Partial<Record<PhaseNumber, PhasePrescription>>
  notes?: string
}

function te(id: string, exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, o: TeOpts = {}): TemplateExercise {
  return { id, exerciseId, sets, repMin, repMax, restSec, ...o }
}

export function defaultTemplates(now = Date.now()): WorkoutTemplate[] {
  return [
    {
      id: 'tpl-swim',
      name: 'Swimming — Natação',
      subtitle: 'Resistência cardiovascular e capacidade aeróbica',
      kind: 'swim',
      weekday: 1,
      durationLabel: '25–35 min',
      programV: PROGRAM_VERSION,
      exercises: [
        te('s1', 'nat-aquecimento', 1, 1, 1, 0, { label: '5 min de natação suave' }),
        te('s2', 'nat-bloco-principal', 5, 1, 1, 60, { label: '5 ciclos × (2 min a nadar + 1 min de recuperação)' }),
        te('s3', 'nat-continua', 1, 1, 1, 0, { label: '5 min de natação contínua leve, se tolerada', optional: true }),
        te('s4', 'nat-retorno', 1, 1, 1, 0, { label: '5 min de retorno à calma' }),
      ],
      notes: 'Adapta a intensidade ao teu nível de natação. Sem exercícios técnicos complexos.',
      updatedAt: now,
    },
    {
      id: 'tpl-push',
      name: 'Push',
      subtitle: 'Peito, ombros e tríceps',
      kind: 'strength',
      weekday: 2,
      durationLabel: '65–80 min',
      programV: PROGRAM_VERSION,
      exercises: [
        te('pu1', 'supino-plano', 3, 6, 8, 150),
        te('pu2', 'supino-inclinado-halteres', 3, 8, 12, 120),
        te('pu3', 'desenvolvimento-ombros', 3, 8, 12, 120),
        te('pu4', 'pec-deck', 2, 12, 15, 75),
        te('pu5', 'elevacoes-laterais', 3, 12, 20, 75),
        te('pu6', 'triceps-polia', 3, 10, 15, 75),
        te('pu7', 'extensao-triceps-cabeca', 2, 10, 15, 75),
      ],
      notes: 'Prioridade: peito superior, largura dos ombros e tríceps.',
      updatedAt: now,
    },
    {
      id: 'tpl-pull',
      name: 'Pull',
      subtitle: 'Costas e bíceps',
      kind: 'strength',
      weekday: 3,
      durationLabel: '60–75 min',
      programV: PROGRAM_VERSION,
      exercises: [
        te('pl1', 'puxada-polia-alta', 3, 8, 12, 120),
        te('pl2', 'remada-apoio-peito', 3, 8, 12, 120),
        te('pl3', 'remada-sentada', 3, 10, 12, 90),
        te('pl4', 'reverse-pec-deck', 3, 12, 20, 75),
        te('pl5', 'curl-biceps', 3, 8, 12, 90),
        te('pl6', 'curl-martelo', 3, 10, 12, 75),
      ],
      notes: 'Prioridade: formato em V do tronco, largura das costas, deltoides posteriores e braços.',
      updatedAt: now,
    },
    {
      id: 'tpl-lower-vj',
      name: 'Lower Strength & Vertical Jump',
      subtitle: 'Força de pernas e salto vertical',
      kind: 'power',
      weekday: 4,
      durationLabel: '75–90 min',
      programV: PROGRAM_VERSION,
      exercises: [
        te('lv0', 'aquecimento-dinamico', 1, 1, 1, 0, { label: '8–10 min de aquecimento progressivo' }),
        te('lv1', 'salto-vertical', 3, 3, 3, 120, {
          phases: { 1: { sets: 2, label: '2 × 3 submáximos (~70–80%)', note: 'Fase 1: 2 séries de 3 saltos verticais submáximos; foco na aterragem.' } },
        }),
        te('lv2', 'salto-caixa', 3, 3, 3, 120, {
          fromPhase: 2,
          phases: { 2: { sets: 2, label: '2 × 3, caixa baixa', note: 'Fase 2: introdução com caixa baixa e estável.' } },
        }),
        te('lv3', 'agachamento', 3, 5, 8, 180),
        te('lv4', 'peso-morto-romeno', 3, 6, 10, 150),
        te('lv5', 'agachamento-bulgaro', 3, 8, 8, 120, { label: '8 por perna' }),
        te('lv6', 'leg-curl', 3, 10, 12, 90),
        te('lv7', 'gemeos', 3, 10, 15, 90),
        te('lv8', 'crunch-polia', 3, 12, 15, 60),
      ],
      notes: 'Saltos sempre antes da musculação. Qualidade, não fadiga. Descer da caixa a andar.',
      updatedAt: now,
    },
    {
      id: 'tpl-upper-core',
      name: 'Upper Hypertrophy & Core',
      subtitle: 'Hipertrofia do tronco e braços, com abdominais',
      kind: 'strength',
      weekday: 5,
      durationLabel: '65–80 min',
      programV: PROGRAM_VERSION,
      exercises: [
        te('uc1', 'supino-inclinado-maquina', 3, 8, 12, 120),
        te('uc2', 'puxada-pega-neutra', 3, 8, 12, 120),
        te('uc3', 'remada-maquina', 3, 10, 12, 90),
        te('uc4', 'elevacoes-laterais-polia', 3, 12, 20, 75),
        te('uc5', 'curl-inclinado', 3, 10, 12, 75),
        te('uc6', 'triceps-polia-barra', 3, 10, 15, 75),
        te('uc7', 'elevacao-pernas', 3, 10, 15, 60),
        te('uc8', 'bicicleta-estatica', 1, 1, 1, 0, { label: 'Cardio opcional: 10–20 min, intensidade leve', optional: true }),
      ],
      notes: 'O cardio é opcional e não deve comprometer a recuperação para sábado.',
      updatedAt: now,
    },
    {
      id: 'tpl-lower-speed',
      name: 'Lower Hypertrophy & Explosive Speed',
      subtitle: 'Pernas, potência horizontal e aceleração',
      kind: 'power',
      weekday: 6,
      durationLabel: '65–85 min',
      programV: PROGRAM_VERSION,
      variants: { A: 'Saltos', B: 'Sprints' },
      exercises: [
        te('ls0', 'aquecimento-progressivo', 1, 1, 1, 0, { label: '8–12 min: caminhada rápida ou corrida muito leve + mobilização dinâmica' }),
        // Variante A — Saltos
        te('lsA1', 'pogo-jumps', 2, 10, 10, 75, {
          variant: 'A',
          phases: { 1: { sets: 2, repMin: 6, repMax: 8, label: '2 × 6–8 suaves', note: 'Fase 1: 2 séries de 6–8 Pogo Jumps suaves.' } },
        }),
        te('lsA2', 'salto-horizontal', 3, 3, 3, 120, {
          variant: 'A',
          fromPhase: 2,
          phases: { 2: { sets: 2, label: '2 × 3 moderados', note: 'Fase 2: Broad Jumps moderados.' } },
        }),
        // Variante B — Sprints
        te('lsB1', 'aceleracao', 2, 1, 1, 90, {
          variant: 'B',
          label: '2 × 20 m, progressivas',
          phases: {
            1: { sets: 2, label: '2 × 20 m, acelerações leves (≤70%)', note: 'Fase 1: acelerações leves, sem sprints máximos.' },
            2: { sets: 4, label: '3–4 × 10–20 m a ~70–80%', note: 'Fase 2: 3–4 acelerações de 10–20 m a ~70–80% do esforço, se houver boa tolerância.' },
            3: { sets: 3, label: '3 × 20 m, cada vez mais rápidas', note: 'Fase 3: acelerações progressivamente mais rápidas (~80–90%).' },
            4: { sets: 2, label: '2 × 20 m progressivas' },
          },
        }),
        te('lsB2', 'sprint-20m', 5, 1, 1, 150, {
          variant: 'B',
          fromPhase: 3,
          label: '4–6 × 20 m',
          phases: {
            3: { sets: 4, label: '4 × 20 m, ~90%', note: 'Fase 3: sprints curtos a ~90%; aproxima a intensidade de forma gradual.' },
            4: { sets: 5, label: '4–6 × 20 m', note: 'Fase 4: intensidade alta apenas sem dor/desconforto e com boa recuperação.' },
          },
        }),
        te('ls1', 'leg-press', 3, 8, 12, 150),
        te('ls2', 'hack-squat', 3, 8, 12, 120, { notes: 'Sem Hack Squat? Substitui por agachamento na Smith Machine.' }),
        te('ls3', 'leg-extension', 2, 12, 15, 75),
        te('ls4', 'leg-curl-deitado', 3, 10, 15, 90),
        te('ls5', 'gemeos-sentado', 3, 12, 20, 75),
      ],
      notes: 'Escolhe a variante A (saltos) ou B (sprints) ao iniciar; alterna-as. Todo o trabalho explosivo é feito antes da musculação pesada. Sprints em superfície segura, plana e seca, com espaço para desacelerar.',
      updatedAt: now,
    },
    {
      id: 'tpl-rest',
      name: 'Rest & Recovery',
      subtitle: 'Descanso completo',
      kind: 'rest',
      weekday: 7,
      programV: PROGRAM_VERSION,
      exercises: [],
      notes: 'Opcional: caminhada leve, mobilidade simples, alongamentos suaves. Descansar faz parte do plano.',
      updatedAt: now,
    },
  ]
}

// ---------------------------------------------------------------- fases

export interface PhaseInfo {
  n: PhaseNumber
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
    summary: 'Recuperar a técnica e a tolerância ao treino.',
    rules: [
      'Musculação: 1–2 séries de trabalho por exercício, cargas moderadas, sem treinar até à falha.',
      'Quinta: apenas 2 séries de 3 saltos verticais submáximos.',
      'Sábado: 2 séries de 6–8 Pogo Jumps suaves ou acelerações leves.',
      'Box Jumps e Broad Jumps só mais tarde. Sem sprints máximos, sem saltos em profundidade.',
    ],
  },
  {
    n: 2,
    name: 'Construção',
    weeksLabel: 'Semanas 3–4',
    rir: '2–3 repetições de reserva',
    summary: 'Subir gradualmente o volume e introduzir saltos e acelerações.',
    rules: [
      'Musculação: aumentar gradualmente para 2–3 séries.',
      'Introduzir Box Jumps com caixa baixa e Broad Jumps moderados.',
      'Introduzir 3–4 acelerações de 10–20 m a ~70–80% do esforço, se houver boa tolerância.',
    ],
  },
  {
    n: 3,
    name: 'Desenvolvimento',
    weeksLabel: 'Semanas 5–8',
    rir: '2–3 repetições de reserva',
    summary: 'Aproximação ao volume completo e progressão das cargas.',
    rules: [
      'Volume completo das tabelas, com progressão gradual das cargas.',
      'Mais qualidade e intensidade nos saltos; acelerações progressivamente mais rápidas.',
      'Não aumentar de forma agressiva a carga, o volume e a intensidade ao mesmo tempo.',
    ],
  },
  {
    n: 4,
    name: 'Performance',
    weeksLabel: 'Semanas 9–12',
    rir: '1–3 repetições de reserva',
    summary: 'Mais intenção de velocidade e reavaliação do desempenho.',
    rules: [
      'Continuar a desenvolver força e hipertrofia.',
      'Maior intenção de velocidade nos movimentos explosivos.',
      'Saltos de alta intensidade e sprints quase máximos só com boa técnica, recuperação e sem dor.',
      'Avaliar o salto vertical, o salto horizontal e a aceleração (testes opcionais).',
    ],
  },
]

export const PLYO_LEVELS: Record<1 | 2 | 3, { name: string; guidance: string }> = {
  1: {
    name: 'Nível 1 — Aprendizagem',
    guidance: 'Saltos submáximos (~70–80%), baixo volume e aterragens estáveis. Sem saltos em profundidade nem sprints máximos.',
  },
  2: {
    name: 'Nível 2 — Desenvolvimento',
    guidance: 'Box Jumps (caixa baixa), Broad Jumps e Pogo Jumps com esforço elevado (~90%). Recupera totalmente entre repetições.',
  },
  3: {
    name: 'Nível 3 — Performance',
    guidance: 'Intensidade máxima apenas com boa técnica, aterragens estáveis, recuperação e sem dor.',
  },
}

export const DEFAULT_PHASE_STARTS: [number, number, number] = [3, 5, 9]

export type PhaseStarts = [number, number, number]

/** Converte o formato antigo (3 fases: [3, 7]) para o atual (4 fases). Idempotente. */
export function normalizePhaseStarts(ps: readonly number[] | undefined): PhaseStarts {
  if (ps && ps.length >= 3) return [ps[0], ps[1], ps[2]]
  if (ps && ps.length === 2) return [ps[0], ps[0] + 2, ps[1] + 2]
  return [...DEFAULT_PHASE_STARTS]
}

export function programWeek(date: ISODate, startDate: ISODate): number {
  return Math.floor(diffDays(date, startDate) / 7) + 1
}

export function phaseForWeek(week: number, phaseStarts: PhaseStarts): PhaseNumber {
  if (week >= phaseStarts[2]) return 4
  if (week >= phaseStarts[1]) return 3
  if (week >= phaseStarts[0]) return 2
  return 1
}

export function phaseStartWeek(phase: PhaseNumber, phaseStarts: PhaseStarts): number {
  return phase === 1 ? 1 : phaseStarts[phase - 2]
}

export function phaseEndWeek(phase: PhaseNumber, phaseStarts: PhaseStarts): number {
  return phase === 4 ? 12 : phaseStarts[phase - 1] - 1
}

export interface ProgramPosition {
  week: number
  beforeStart: boolean
  phase: PhaseNumber
  weekInPhase: number
  phaseInfo: PhaseInfo
  /** Última semana da fase atual (null na fase 4: sem fim fixo). */
  lastWeekOfPhase: number | null
  isLastWeekOfPhase: boolean
  beyondProgram: boolean
}

export function programPosition(date: ISODate, settings: Pick<Settings, 'program'>): ProgramPosition {
  const { startDate } = settings.program
  const phaseStarts = normalizePhaseStarts(settings.program.phaseStarts)
  const week = programWeek(date, startDate)
  const beforeStart = week < 1
  const w = Math.max(1, week)
  const phase = phaseForWeek(w, phaseStarts)
  const startW = phaseStartWeek(phase, phaseStarts)
  const lastWeekOfPhase = phase === 4 ? null : phaseStarts[phase - 1] - 1
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
export function extendPhase(phaseStarts: PhaseStarts, phase: 1 | 2 | 3, weeks = 1): PhaseStarts {
  const out: PhaseStarts = [...phaseStarts]
  for (let i = phase - 1; i < 3; i++) out[i] += weeks
  return out
}

// ---------------------------------------------------------------- prescrição ajustada à fase

export interface AdjustedPlan {
  sets: number
  repMin?: number
  repMax?: number
  label?: string
  note?: string
  /** O exercício ainda não faz parte do programa nesta fase. */
  skip?: boolean
}

/**
 * Ajusta a prescrição à fase do programa (sem alterar o treino-modelo do utilizador).
 * 1) fromPhase: exercícios introduzidos mais tarde ficam de fora até lá;
 * 2) `phases` do exercício: prescrição explícita por fase;
 * 3) regra genérica: Fase 1 = 1–2 séries; Fase 2 = 2 → 3 séries; Fases 3–4 = volume completo.
 * Com "reduzir volume" ativo, retira-se 1 série (mínimo 1) a exercícios com mais de uma.
 */
export function adjustPlan(
  tex: TemplateExercise,
  def: ExerciseDef | undefined,
  pos: ProgramPosition,
  opts: { reduce?: boolean } = {},
): AdjustedPlan {
  const planned = tex.sets
  const lt = def?.logType ?? 'strength'
  const p = pos.phase
  if (pos.beforeStart) return { sets: planned }
  if (tex.fromPhase && p < tex.fromPhase) return { sets: 0, skip: true }

  const ov = tex.phases?.[p]
  let sets = planned
  let note: string | undefined = ov?.note

  if (ov?.sets !== undefined) sets = ov.sets
  else if (lt === 'strength') {
    if (p === 1) sets = pos.weekInPhase === 1 ? Math.max(1, Math.round(planned / 2)) : Math.min(planned, 2)
    else if (p === 2) sets = pos.weekInPhase === 1 ? Math.min(planned, 2) : Math.min(planned, 3)
    if (sets !== planned) note = `Fase ${p}: ${sets} em vez de ${planned} séries (volume progressivo).`
  } else if (lt === 'jump') {
    if (p === 1) {
      sets = Math.min(planned, 2)
      note = `Fase 1: baixo volume de saltos${sets !== planned ? ` (${sets} em vez de ${planned} séries)` : ''}; foco na aterragem.`
    }
  } else if (lt === 'sprint') {
    if (p === 1) {
      sets = Math.min(planned, 4)
      note = 'Fase 1: acelerações submáximas (~70–80%). Sem sprints máximos.'
    }
  } else if (lt === 'agility') {
    if (p === 1) {
      sets = Math.min(planned, 3)
      note = 'Fase 1: mudanças de direção controladas, intensidade moderada.'
    }
  }

  if (opts.reduce && sets > 1 && (lt === 'strength' || lt === 'jump' || lt === 'sprint' || lt === 'agility')) {
    sets -= 1
    note = `${note ? note + ' ' : ''}Volume reduzido (fadiga/dor): −1 série.`
  }
  return { sets, repMin: ov?.repMin, repMax: ov?.repMax, label: ov?.label, note }
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
