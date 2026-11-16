// Relatórios em texto (para colar no ChatGPT) e relatório estruturado em JSON.
// Regras: nunca inventar dados; ausência de registo != zero; incluir datas e unidades.

import { avg, doubleProgression, estimate1RM, exerciseVolume, fmt, formatPace, formatSeconds, humanDuration, isWorkingSet, pacePer100, round, sessionVolume, sum } from './calc'
import {
  WEEKDAYS_UPPER,
  addDays,
  endOfWeek,
  formatDatePT,
  monthRange,
  formatMonthYear,
  rangeDates,
  startOfWeek,
  weekdayISO,
} from './dates'
import { MUSCLE_LABEL } from './exercises'
import { programPosition, plannedTemplatesForDate } from './program'
import {
  CATEGORY_LABEL,
  FIXED_METRICS,
  allMetricKeys,
  compareToPrevious,
  exerciseHistory,
  exerciseSummary,
  finished,
  lastPerformance,
  metricDefFor,
  mealsOn,
  nutritionAverages,
  perfPointsAll,
  perfRecord,
  prsInSession,
  totalsOf,
  weeklyWeightAverages,
  sortedBody,
  weekStats,
  type Snapshot,
} from './stats'
import type { ISODate, Session, SessionExercise, SetEntry } from './types'

export const REPORT_SCHEMA = 'winter-arc-report'
export const REPORT_SCHEMA_VERSION = 1

const NO_DATA = 'sem registo'

const hr = '────────────────────────────'

function n(v: number | undefined, d = 1, unit = ''): string {
  return v === undefined ? NO_DATA : `${fmt(v, d)}${unit ? ' ' + unit : ''}`
}

function scale(v: number | undefined): string {
  return v === undefined ? NO_DATA : `${fmt(v, 1)}/5`
}

export function metricValueText(key: string, v: number | undefined): string {
  const def = metricDefFor(key)
  if (v === undefined || !def) return NO_DATA
  if (def.unit === 's' && key !== 'run-1km') return formatSeconds(v, def.decimals)
  if (key === 'run-1km') return formatSeconds(v, 0)
  if (key === 'swim-pace') return formatPace(v)
  return `${fmt(v, def.decimals)} ${def.unit}`
}

// ---------------------------------------------------------------- séries

export function setText(s: SetEntry, ex: SessionExercise): string {
  const bits: string[] = []
  switch (ex.logType) {
    case 'strength': {
      const label = s.type === 'warmup' ? 'aquecimento' : s.type === 'drop' ? 'dropset' : s.type === 'failure' ? 'até à falha' : ''
      const w = s.weightKg !== undefined ? `${fmt(s.weightKg, 2)} kg` : 'peso corporal/sem carga registada'
      const r = s.reps !== undefined ? `${s.reps}` : '? reps'
      bits.push(`${w} × ${r}`)
      if (label) bits.push(label)
      if (s.rpe !== undefined) bits.push(`RPE ${fmt(s.rpe)}`)
      if (s.rir !== undefined) bits.push(`RIR ${fmt(s.rir, 0)}`)
      break
    }
    case 'jump': {
      if (s.reps !== undefined) bits.push(`${s.reps} reps`)
      if (s.heightCm !== undefined) bits.push(`altura do salto ${fmt(s.heightCm)} cm`)
      else if (s.distanceCm !== undefined) bits.push(`distância ${fmt(s.distanceCm, 0)} cm`)
      else if (s.boxCm === undefined) bits.push('altura/distância não medida')
      if (s.boxCm !== undefined) bits.push(`caixa ${fmt(s.boxCm, 0)} cm (altura da caixa, não do salto)`)
      if (s.landing !== undefined) bits.push(`aterragem ${s.landing}/5`)
      if (s.rpe !== undefined) bits.push(`esforço ${fmt(s.rpe)}/10`)
      break
    }
    case 'sprint': {
      if (s.distanceM !== undefined) bits.push(`${fmt(s.distanceM, 0)} m`)
      if (s.timeS !== undefined) bits.push(`${formatSeconds(s.timeS)}`)
      else bits.push('tempo não registado')
      if (s.rpe !== undefined) bits.push(`intensidade ${fmt(s.rpe)}/10`)
      if (s.restS !== undefined) bits.push(`descanso ${fmt(s.restS, 0)} s`)
      break
    }
    case 'cardio': {
      bits.push(s.timeS !== undefined ? `${fmt(s.timeS / 60, 0)} min` : 'duração não registada')
      if (s.rpe !== undefined) bits.push(`esforço ${fmt(s.rpe)}/10`)
      break
    }
    case 'agility': {
      if (s.timeS !== undefined) bits.push(formatSeconds(s.timeS))
      else bits.push('tempo não registado')
      if (s.rpe !== undefined) bits.push(`esforço ${fmt(s.rpe)}/10`)
      break
    }
    default:
      if (s.distanceM !== undefined) bits.push(`${fmt(s.distanceM, 0)} m`)
      bits.push(s.done ? 'feito' : 'não feito')
  }
  if (s.notes) bits.push(`nota: ${s.notes}`)
  return bits.join(' | ')
}

function exerciseLines(snap: Snapshot, session: Session, ex: SessionExercise, indent = '  '): string[] {
  const def = snap.exMap.get(ex.exerciseId)
  const lines: string[] = []
  const plan = ex.plan && ex.logType === 'strength' ? ` (plano ${ex.plan.sets} × ${ex.plan.repMin === ex.plan.repMax ? ex.plan.repMin : `${ex.plan.repMin}–${ex.plan.repMax}`})` : ex.plan?.label ? ` (${ex.plan.label})` : ''
  lines.push(`${ex.name}${ex.optional ? ' [opcional]' : ''}${plan}:`)
  const done = ex.sets.filter((s) => s.done)
  if (!done.length) {
    lines.push(`${indent}${ex.optional ? 'opcional — não realizado (não penaliza)' : 'não realizado'}`)
    return lines
  }
  if (ex.logType === 'checklist') {
    lines.push(`${indent}feito`)
    if (ex.notes) lines.push(`${indent}Nota: ${ex.notes}`)
    return lines
  }
  done.forEach((s, i) => lines.push(`${indent}Série ${i + 1}: ${setText(s, ex)}`))
  if (ex.logType === 'strength') {
    const work = done.filter(isWorkingSet)
    const vol = exerciseVolume(ex)
    if (vol > 0) lines.push(`${indent}Volume: ${fmt(vol, 0)} kg`)
    if (def?.e1rm) {
      const best = work.map((s) => estimate1RM(s.weightKg, s.reps)).filter((x): x is number => !!x)
      if (best.length) lines.push(`${indent}1RM estimado (Epley, estimativa — não medido): ${fmt(Math.max(...best), 1)} kg`)
    }
    const prev = lastPerformance(snap.sessions, ex.exerciseId, session)
    if (prev) {
      const pw = prev.ex.sets.filter(isWorkingSet).filter((s) => s.weightKg && s.reps)
      if (pw.length) {
        const top = Math.max(...pw.map((s) => s.weightKg!))
        const repsTop = Math.max(...pw.filter((s) => s.weightKg === top).map((s) => s.reps!))
        lines.push(`${indent}Sessão anterior (${formatDatePT(prev.session.date)}): melhor carga ${fmt(top, 2)} kg × ${repsTop}`)
      }
    }
  }
  if (ex.logType === 'jump') {
    const h = done.map((s) => s.heightCm).filter((x): x is number => !!x)
    const dd = done.map((s) => s.distanceCm).filter((x): x is number => !!x)
    if (h.length) lines.push(`${indent}Melhor: ${fmt(Math.max(...h))} cm | Média dos válidos: ${fmt(avg(h)!)} cm (n=${h.length})`)
    if (dd.length) lines.push(`${indent}Melhor: ${fmt(Math.max(...dd), 0)} cm | Média dos válidos: ${fmt(avg(dd)!, 0)} cm (n=${dd.length})`)
  }
  if (ex.logType === 'sprint') {
    const by = new Map<number, number[]>()
    for (const s of done) if (s.distanceM && s.timeS) by.set(s.distanceM, [...(by.get(s.distanceM) ?? []), s.timeS])
    for (const [dist, times] of by)
      lines.push(`${indent}${fmt(dist, 0)} m: melhor ${formatSeconds(Math.min(...times))} | média ${formatSeconds(avg(times))} (n=${times.length})`)
    if (ex.surface) lines.push(`${indent}Superfície: ${ex.surface}`)
  }
  if (ex.logType === 'agility') {
    const t = done.map((s) => s.timeS).filter((x): x is number => !!x)
    if (ex.course) lines.push(`${indent}Percurso: ${ex.course}`)
    if (t.length) lines.push(`${indent}Melhor: ${formatSeconds(Math.min(...t))} | média ${formatSeconds(avg(t))} (n=${t.length})`)
  }
  if (ex.notes) lines.push(`${indent}Nota: ${ex.notes}`)
  return lines
}

function swimLines(s: Session, indent = '  '): string[] {
  const w = s.swim
  if (!w) return []
  const lines: string[] = ['Natação:']
  if (w.pool) lines.push(`${indent}Piscina: ${w.pool} m`)
  if (w.laps !== undefined) lines.push(`${indent}Piscinas (comprimentos): ${w.laps}`)
  if (w.distanceM !== undefined) lines.push(`${indent}Distância: ${fmt(w.distanceM, 0)} m`)
  if (w.totalSec !== undefined) lines.push(`${indent}Tempo total: ${humanDuration(w.totalSec)}`)
  if (w.effectiveSec !== undefined) lines.push(`${indent}Tempo efetivo a nadar: ${humanDuration(w.effectiveSec)}`)
  const pace = pacePer100(w.distanceM, w.effectiveSec ?? w.totalSec)
  if (pace) lines.push(`${indent}Ritmo médio: ${formatPace(pace)}${w.effectiveSec ? ' (tempo efetivo)' : ' (tempo total)'}`)
  if (w.stroke) lines.push(`${indent}Estilo: ${w.stroke}`)
  if (w.restsCount !== undefined) lines.push(`${indent}Pausas: ${w.restsCount}`)
  if (w.rpe !== undefined) lines.push(`${indent}Esforço: ${fmt(w.rpe)}/10`)
  if (w.notes) lines.push(`${indent}Notas: ${w.notes}`)
  return lines
}

/** Séries planeadas (fase atual) vs. concluídas; os exercícios opcionais não entram na contagem do plano. */
export function plannedVsDone(s: Session): { planned: number; done: number; optionalDone: number } {
  let planned = 0
  let done = 0
  let optionalDone = 0
  for (const ex of s.exercises) {
    const d = ex.sets.filter((x) => x.done).length
    if (ex.optional) {
      optionalDone += d
      continue
    }
    if (ex.logType === 'swim') continue
    planned += ex.plan?.sets ?? ex.sets.length
    done += d
  }
  return { planned: s.plannedSets ?? planned, done, optionalDone }
}

function statusPT(s: Session): string {
  return s.status === 'completed' ? 'concluído' : s.status === 'partial' ? 'parcialmente concluído' : 'em curso'
}

export function sessionBlock(snap: Snapshot, s: Session): string[] {
  const wd = WEEKDAYS_UPPER[weekdayISO(s.date) - 1]
  const lines: string[] = [`${wd} — ${s.name.toUpperCase()}`]
  const meta = [`Data: ${formatDatePT(s.date)}`, `Estado: ${statusPT(s)}`]
  if (s.endedAt) meta.push(`Duração: ${humanDuration((s.endedAt - s.startedAt) / 1000)}`)
  if (s.rpe !== undefined) meta.push(`Esforço da sessão: ${fmt(s.rpe)}/10`)
  if (s.phase) meta.push(`Fase ${s.phase}${s.programWeek ? `, semana ${s.programWeek}` : ''}`)
  if (s.variant) meta.push(`Variante ${s.variant}`)
  lines.push(meta.join(' | '))
  const pr = plannedVsDone(s)
  if (pr.planned > 0) lines.push(`Séries planeadas vs realizadas: ${pr.done}/${pr.planned}${pr.optionalDone ? ` (+ ${pr.optionalDone} de exercícios opcionais)` : ''}`)
  for (const ex of s.exercises) {
    if (ex.logType === 'swim') continue
    lines.push(...exerciseLines(snap, s, ex))
  }
  lines.push(...swimLines(s))
  if (s.notes) lines.push(`Notas da sessão: ${s.notes}`)
  const prs = prsInSession(snap, s)
  if (prs.length) lines.push(`Recordes na sessão: ${prs.join('; ')}`)
  return lines
}

// ---------------------------------------------------------------- comuns

function header(snap: Snapshot, title: string, period: string): string[] {
  const { heightCm, startWeightKg } = snap.settings
  return [
    `WINTER ARC — ${title}`,
    `Período: ${period}`,
    `Perfil: ${heightCm} cm | peso inicial definido: ${fmt(startWeightKg)} kg`,
    'Objetivo: força, massa muscular, potência, velocidade, resistência e físico atlético.',
    'Nota: “sem registo” significa que não foi registado — não é zero.',
    hr,
  ]
}

function bodyBlock(snap: Snapshot, from: ISODate, to: ISODate): string[] {
  const logs = sortedBody(snap.bodyLogs).filter((l) => l.date >= from && l.date <= to)
  const w = logs.filter((l) => l.weightKg !== undefined)
  const lines = ['CORPO']
  if (!w.length) lines.push('  Peso: sem registo no período')
  else {
    const first = w[0]
    const last = w[w.length - 1]
    lines.push(`  Peso inicial: ${fmt(first.weightKg)} kg (${formatDatePT(first.date)})`)
    lines.push(`  Peso final: ${fmt(last.weightKg)} kg (${formatDatePT(last.date)})`)
    lines.push(`  Média: ${fmt(avg(w.map((x) => x.weightKg))!, 2)} kg (${w.length} registo${w.length > 1 ? 's' : ''})`)
  }
  const measures: Array<[string, keyof (typeof logs)[number]]> = [
    ['Cintura', 'waistCm'],
    ['Peito', 'chestCm'],
    ['Braços', 'armCm'],
    ['Coxas', 'thighCm'],
    ['Ancas', 'hipCm'],
  ]
  for (const [label, key] of measures) {
    const v = logs.filter((l) => typeof l[key] === 'number')
    if (v.length) {
      const last = v[v.length - 1]
      lines.push(`  ${label}: ${fmt(last[key] as number)} cm (${formatDatePT(last.date)})`)
    }
  }
  const bf = logs.filter((l) => l.bodyFatPct !== undefined)
  if (bf.length) lines.push(`  Gordura corporal (medida pelo utilizador): ${fmt(bf[bf.length - 1].bodyFatPct)} % (${formatDatePT(bf[bf.length - 1].date)})`)
  lines.push('  Nota: variações de peso não indicam, por si só, melhoria da composição corporal.')
  return lines
}

function nutritionBlock(snap: Snapshot, from: ISODate, to: ISODate): string[] {
  const { avg: a, days } = nutritionAverages(snap.meals, from, to)
  const t = snap.settings.nutrition
  const total = rangeDates(from, to).length
  const lines = ['NUTRIÇÃO']
  if (!a) {
    lines.push('  Sem alimentação registada no período')
    return lines
  }
  lines.push(`  Dias com registo: ${days} de ${total}`)
  lines.push(`  Média de calorias: ${fmt(a.kcal, 0)} kcal (objetivo ${t.kcal} kcal)`)
  lines.push(`  Média de proteína: ${fmt(a.protein, 0)} g (objetivo ${t.protein} g)`)
  lines.push(`  Média de hidratos: ${fmt(a.carbs, 0)} g (objetivo ${t.carbs} g)`)
  lines.push(`  Média de gordura: ${fmt(a.fat, 0)} g (objetivo ${t.fat} g)`)
  lines.push('  (médias apenas sobre os dias com registo)')
  const water = snap.dayLogs.filter((d) => d.date >= from && d.date <= to && d.waterMl !== undefined)
  if (water.length) lines.push(`  Água: média ${fmt(avg(water.map((d) => d.waterMl))! / 1000, 2)} L/dia (${water.length} dias com registo)`)
  const supps = snap.settings.supplements.filter((s) => s.enabled)
  for (const sp of supps) {
    const logged = snap.dayLogs.filter((d) => d.date >= from && d.date <= to && d.supplements && sp.id in d.supplements)
    if (logged.length) lines.push(`  ${sp.name}: tomada em ${logged.filter((d) => d.supplements![sp.id]).length} de ${logged.length} dias com registo`)
  }
  return lines
}

function recoveryBlock(snap: Snapshot, from: ISODate, to: ISODate): string[] {
  const r = snap.recovery.filter((x) => x.date >= from && x.date <= to)
  const lines = ['RECUPERAÇÃO']
  if (!r.length) {
    lines.push('  Sem registos de recuperação no período')
    return lines
  }
  lines.push(`  Dias com registo: ${r.length}`)
  lines.push(`  Sono médio: ${n(avg(r.map((x) => x.sleepH)), 1, 'h')} (qualidade ${scale(avg(r.map((x) => x.sleepQ)))})`)
  lines.push(`  Energia média: ${scale(avg(r.map((x) => x.energy)))} (5 = muita energia)`)
  lines.push(`  Fadiga média: ${scale(avg(r.map((x) => x.fatigue)))} (5 = muito fatigado)`)
  lines.push(`  Dores musculares médias: ${scale(avg(r.map((x) => x.soreness)))} (5 = muitas dores)`)
  lines.push(`  Stress médio: ${scale(avg(r.map((x) => x.stress)))} (5 = muito stress)`)
  lines.push(`  Motivação média: ${scale(avg(r.map((x) => x.motivation)))} (5 = muito motivado)`)
  const joint = r.filter((x) => x.jointPain !== undefined)
  if (joint.length)
    lines.push(`  Dor articular registada em ${joint.length} dia(s): ${joint.map((x) => `${formatDatePT(x.date)} ${x.jointPain}/5${x.jointPainWhere ? ` (${x.jointPainWhere})` : ''}`).join('; ')}`)
  return lines
}

function performanceBlock(snap: Snapshot, from: ISODate, to: ISODate, pm = perfPointsAll(snap)): string[] {
  const lines = ['PERFORMANCE']
  let any = false
  for (const key of allMetricKeys(snap, pm)) {
    const def = metricDefFor(key)
    if (!def) continue
    const pts = (pm.get(key) ?? []).filter((p) => p.date >= from && p.date <= to)
    if (!pts.length) continue
    any = true
    const best = def.better === 'max' ? Math.max(...pts.map((p) => p.value)) : Math.min(...pts.map((p) => p.value))
    const bp = pts.find((p) => p.value === best)!
    lines.push(`  ${def.label}: melhor ${metricValueText(key, best)} (${formatDatePT(bp.date)}) — protocolo: ${def.protocol}`)
  }
  if (!any) lines.push('  Sem testes ou resultados de performance registados no período')
  lines.push('  Nota: só são comparáveis resultados com o mesmo protocolo (ex.: 10 m vs 20 m são métricas separadas).')
  return lines
}

function recordsInPeriod(snap: Snapshot, from: ISODate, to: ISODate): string[] {
  const out: string[] = []
  for (const s of finished(snap.sessions).filter((x) => x.date >= from && x.date <= to)) out.push(...prsInSession(snap, s).map((t) => `${formatDatePT(s.date)} — ${t}`))
  const pm = perfPointsAll(snap)
  for (const key of allMetricKeys(snap, pm)) {
    const rec = perfRecord(snap, key, pm)
    if (!rec) continue
    for (const ev of rec.history) {
      if (ev.date >= from && ev.date <= to)
        out.push(
          `${formatDatePT(ev.date)} — ${rec.def.label}: ${metricValueText(key, ev.value)}${ev.previous !== undefined ? ` (anterior ${metricValueText(key, ev.previous)})` : ' (primeiro registo)'}`,
        )
    }
  }
  return out
}

const ASK_FOOTER_STYLE = [
  'Responde em português de Portugal, de forma objetiva. Não assumas dados que não estão neste relatório.',
]

// ---------------------------------------------------------------- diário

export function buildDailyReport(snap: Snapshot, date: ISODate): string {
  const lines = header(snap, 'RELATÓRIO DIÁRIO', formatDatePT(date))
  const pos = programPosition(date, snap.settings)
  lines.push(`Programa: ${pos.beforeStart ? 'antes do início' : `semana ${pos.week}, fase ${pos.phase} (${pos.phaseInfo.name})`}`)
  const sessions = finished(snap.sessions).filter((s) => s.date === date)
  const planned = plannedTemplatesForDate(date, snap.templates, snap.schedule).filter((t) => t.kind !== 'rest')
  lines.push(`Treino planeado: ${planned.length ? planned.map((t) => t.name).join(', ') : 'nenhum (descanso ou sem plano)'}`)
  lines.push('')
  if (!sessions.length) lines.push('TREINO', '  Nenhum treino concluído neste dia.')
  for (const s of sessions) {
    lines.push(...sessionBlock(snap, s), '')
  }
  const day = snap.dayLogs.find((d) => d.date === date)
  if (day?.rest && (day.rest.walk || day.rest.mobility || day.rest.stretching || day.rest.recovery)) {
    const bits = [day.rest.walk ? `caminhada${day.rest.walkMin ? ` ${day.rest.walkMin} min` : ''}` : '', day.rest.mobility ? 'mobilidade suave' : '', day.rest.stretching ? 'alongamentos' : '', day.rest.recovery ? 'recuperação' : ''].filter(Boolean)
    lines.push('ATIVIDADE DE RECUPERAÇÃO', `  ${bits.join(', ')}`, '')
  }
  lines.push(...bodyBlock(snap, date, date), '')
  const meals = mealsOn(snap.meals, date)
  if (meals.length) {
    const t = totalsOf(meals)
    const g = snap.settings.nutrition
    lines.push('NUTRIÇÃO')
    lines.push(`  Calorias: ${fmt(t.kcal, 0)} kcal (objetivo ${g.kcal})`)
    lines.push(`  Proteína: ${fmt(t.protein, 0)} g (objetivo ${g.protein}) | Hidratos: ${fmt(t.carbs, 0)} g (objetivo ${g.carbs}) | Gordura: ${fmt(t.fat, 0)} g (objetivo ${g.fat})`)
    if (day?.waterMl !== undefined) lines.push(`  Água: ${fmt(day.waterMl / 1000, 2)} L`)
  } else lines.push('NUTRIÇÃO', '  Sem alimentação registada neste dia')
  if (day?.supplements) {
    for (const sp of snap.settings.supplements.filter((x) => x.enabled)) if (sp.id in day.supplements) lines.push(`  ${sp.name}: ${day.supplements[sp.id] ? 'tomada' : 'não tomada'}`)
  }
  lines.push('')
  lines.push(...recoveryBlock(snap, date, date), '')
  const notes = [day?.notes].filter(Boolean)
  if (notes.length) lines.push('NOTAS DO UTILIZADOR', ...notes.map((x) => `  ${x}`), '')
  lines.push(hr, 'PEDIDO AO CHATGPT')
  lines.push('Analisa o meu dia de treino e recuperação tendo em conta o objetivo de desenvolver força, massa muscular, potência, velocidade, resistência e um físico atlético.')
  lines.push('Identifica:', '1. O que correu bem.', '2. Possíveis sinais de fadiga ou risco de lesão.', '3. Exercícios onde devo progredir ou manter a carga na próxima sessão.', '4. Ajustes recomendados para as próximas 24–48 horas (alimentação, sono, recuperação).')
  lines.push(...ASK_FOOTER_STYLE)
  return lines.join('\n')
}

// ---------------------------------------------------------------- semanal

export function buildWeeklyReport(snap: Snapshot, anyDate: ISODate): string {
  const ws = weekStats(snap, anyDate)
  const lines = header(snap, 'RELATÓRIO SEMANAL', `${formatDatePT(ws.from)} a ${formatDatePT(ws.to)}`)
  const pos = programPosition(ws.from, snap.settings)
  lines.push(`Programa: ${pos.beforeStart ? 'antes do início' : `semana ${pos.week}, fase ${pos.phase} (${pos.phaseInfo.name}; alvo ${pos.phaseInfo.rir})`}`)
  lines.push(`Treinos planeados: ${ws.plannedCount}`)
  lines.push(`Treinos realizados: ${ws.sessions.filter((s) => s.status === 'completed').length} concluídos, ${ws.sessions.filter((s) => s.status === 'partial').length} parciais`)
  lines.push(`Volume total (musculação): ${fmt(ws.volumeKg, 0)} kg | Séries concluídas: ${ws.setsDone} | Tempo de treino: ${humanDuration(ws.durationSec)}`)
  lines.push('')
  lines.push(...bodyBlock(snap, ws.from, ws.to), '')
  if (!ws.sessions.length) lines.push('TREINOS', '  Nenhum treino registado nesta semana.', '')
  for (const s of ws.sessions) lines.push(...sessionBlock(snap, s), '')
  lines.push(...performanceBlock(snap, ws.from, ws.to), '')
  lines.push(...nutritionBlock(snap, ws.from, ws.to), '')
  lines.push(...recoveryBlock(snap, ws.from, ws.to), '')

  // evolução
  lines.push('EVOLUÇÃO')
  const recs = recordsInPeriod(snap, ws.from, ws.to)
  lines.push(`  Recordes pessoais: ${recs.length ? '' : 'nenhum nesta semana'}`)
  recs.forEach((r) => lines.push(`    - ${r}`))
  const prog: string[] = []
  const noProg: string[] = []
  const noRef: string[] = []
  const seen = new Set<string>()
  for (const s of ws.sessions) {
    for (const ex of s.exercises) {
      if (ex.logType !== 'strength' || seen.has(ex.exerciseId) || !ex.sets.some(isWorkingSet)) continue
      seen.add(ex.exerciseId)
      const prev = lastPerformance(snap.sessions, ex.exerciseId, s)
      const v = compareToPrevious(ex, prev?.ex)
      ;(v === 'progressao' ? prog : v === 'sem-progressao' ? noProg : noRef).push(ex.name)
    }
  }
  lines.push(`  Exercícios com progressão: ${prog.length ? prog.join(', ') : 'nenhum identificado'}`)
  lines.push(`  Exercícios sem progressão: ${noProg.length ? noProg.join(', ') : 'nenhum identificado'}`)
  if (noRef.length) lines.push(`  Sem sessão anterior para comparar: ${noRef.join(', ')}`)
  const mv = Object.entries(ws.muscle)
  if (mv.length) {
    lines.push('  Séries de trabalho por grupo muscular:')
    mv.sort((a, b) => b[1].sets - a[1].sets).forEach(([m, v]) => lines.push(`    ${MUSCLE_LABEL[m as keyof typeof MUSCLE_LABEL]}: ${v.sets} séries, ${fmt(v.volumeKg, 0)} kg de volume`))
  }
  lines.push('')
  const notes: string[] = []
  for (const s of ws.sessions) if (s.notes) notes.push(`${formatDatePT(s.date)} (${s.name}): ${s.notes}`)
  for (const d of snap.dayLogs) if (d.date >= ws.from && d.date <= ws.to && d.notes) notes.push(`${formatDatePT(d.date)}: ${d.notes}`)
  for (const r of snap.recovery) if (r.date >= ws.from && r.date <= ws.to && r.notes) notes.push(`${formatDatePT(r.date)}: ${r.notes}`)
  lines.push('NOTAS DO UTILIZADOR', ...(notes.length ? notes.map((x) => `  ${x}`) : ['  Sem notas']), '')
  lines.push(hr, 'PEDIDO AO CHATGPT')
  lines.push('Analisa a minha semana de treino tendo em conta o objetivo de desenvolver força, massa muscular, potência, velocidade, resistência e um físico atlético.')
  lines.push('Identifica:', '1. Progressos.', '2. Possíveis sinais de fadiga.', '3. Exercícios onde devo progredir.', '4. Exercícios onde devo manter a carga.', '5. Ajustes recomendados.', '6. Prioridades para a próxima semana.')
  lines.push(...ASK_FOOTER_STYLE)
  return lines.join('\n')
}

// ---------------------------------------------------------------- mensal

export function buildMonthlyReport(snap: Snapshot, key: string): string {
  const { from, to } = monthRange(key)
  const lines = header(snap, 'RELATÓRIO MENSAL', `${formatMonthYear(key)} (${formatDatePT(from)} a ${formatDatePT(to)})`)
  const sessions = finished(snap.sessions).filter((s) => s.date >= from && s.date <= to)
  lines.push(`Sessões registadas: ${sessions.length} (${sessions.filter((s) => s.status === 'completed').length} concluídas, ${sessions.filter((s) => s.status === 'partial').length} parciais)`)
  lines.push(`Volume total (musculação): ${fmt(sum(sessions.map(sessionVolume)), 0)} kg`)
  lines.push('')
  lines.push('SEMANAS')
  const weeks: ISODate[] = []
  for (let d = startOfWeek(from); d <= to; d = addDays(d, 7)) weeks.push(d)
  const wavg = new Map(weeklyWeightAverages(snap.bodyLogs).map((w) => [w.week, w]))
  for (const w of weeks) {
    const st = weekStats(snap, w)
    const wa = wavg.get(w)
    lines.push(`  ${formatDatePT(w)} a ${formatDatePT(endOfWeek(w))}: ${st.sessions.length}/${st.plannedCount} sessões | volume ${fmt(st.volumeKg, 0)} kg | peso médio ${wa ? `${fmt(wa.avg, 2)} kg` : NO_DATA}`)
  }
  lines.push('')
  lines.push(...bodyBlock(snap, from, to), '')
  // progressão por exercício
  lines.push('PROGRESSÃO POR EXERCÍCIO (melhor carga de trabalho no mês: primeira → última sessão)')
  const ids = new Set<string>()
  sessions.forEach((s) => s.exercises.forEach((e) => e.logType === 'strength' && ids.add(e.exerciseId)))
  let anyEx = false
  for (const id of ids) {
    const h = exerciseHistory(sessions, id)
    if (!h.length) continue
    const top = (e: SessionExercise) => Math.max(0, ...e.sets.filter(isWorkingSet).map((s) => s.weightKg ?? 0))
    const f = h[0]
    const l = h[h.length - 1]
    if (!top(f.ex) && !top(l.ex)) continue
    anyEx = true
    lines.push(`  ${f.ex.name}: ${fmt(top(f.ex), 2)} kg (${formatDatePT(f.session.date)}) → ${fmt(top(l.ex), 2)} kg (${formatDatePT(l.session.date)}) em ${h.length} sessão(ões)`)
  }
  if (!anyEx) lines.push('  Sem dados de musculação')
  lines.push('')
  lines.push(...performanceBlock(snap, from, to), '')
  lines.push(...nutritionBlock(snap, from, to), '')
  lines.push(...recoveryBlock(snap, from, to), '')
  const recs = recordsInPeriod(snap, from, to)
  lines.push('RECORDES PESSOAIS', ...(recs.length ? recs.map((r) => `  - ${r}`) : ['  Nenhum no mês']), '')
  lines.push(hr, 'PEDIDO AO CHATGPT')
  lines.push('Analisa o meu mês de treino tendo em conta o objetivo de desenvolver força, massa muscular, potência, velocidade, resistência e um físico atlético.')
  lines.push('Identifica:', '1. Tendências de progressão (força, massa, performance).', '2. Consistência e carga de treino ao longo das semanas.', '3. Sinais de fadiga acumulada ou plateau.', '4. Ajustes ao programa para o próximo mês.', '5. Prioridades de nutrição e recuperação.')
  lines.push(...ASK_FOOTER_STYLE)
  return lines.join('\n')
}

// ---------------------------------------------------------------- exercício

export function buildExerciseReport(snap: Snapshot, exerciseId: string, maxSessions = 12): string {
  const def = snap.exMap.get(exerciseId)
  const name = def?.namePt ?? exerciseId
  const h = exerciseHistory(snap.sessions, exerciseId)
  const lines = header(snap, `RELATÓRIO DE EVOLUÇÃO — ${name.toUpperCase()}`, h.length ? `${formatDatePT(h[0].session.date)} a ${formatDatePT(h[h.length - 1].session.date)}` : 'sem sessões')
  if (!h.length) {
    lines.push('Sem sessões registadas deste exercício.')
    return lines.join('\n')
  }
  const sum_ = exerciseSummary(h, def)
  lines.push(`Sessões com este exercício: ${h.length}`)
  if (sum_.heaviest) lines.push(`Maior carga: ${fmt(sum_.heaviest.weightKg, 2)} kg × ${sum_.heaviest.reps} (${formatDatePT(sum_.heaviest.date)})`)
  if (sum_.maxReps) lines.push(`Maior nº de repetições numa série: ${sum_.maxReps.reps}${sum_.maxReps.weightKg ? ` com ${fmt(sum_.maxReps.weightKg, 2)} kg` : ''} (${formatDatePT(sum_.maxReps.date)})`)
  if (sum_.best) lines.push(`Melhor série (carga × reps): ${fmt(sum_.best.weightKg, 2)} kg × ${sum_.best.reps} (${formatDatePT(sum_.best.date)})`)
  if (sum_.bestSessionVolume) lines.push(`Maior volume numa sessão: ${fmt(sum_.bestSessionVolume.volumeKg, 0)} kg (${formatDatePT(sum_.bestSessionVolume.date)})`)
  if (sum_.e1rm) lines.push(`1RM estimado (Epley — ESTIMATIVA, não medido): ${fmt(sum_.e1rm.value, 1)} kg (${formatDatePT(sum_.e1rm.date)})`)
  lines.push('', `HISTÓRICO (últimas ${Math.min(maxSessions, h.length)} sessões)`)
  for (const e of h.slice(-maxSessions)) {
    lines.push(`${formatDatePT(e.session.date)} — ${e.session.name}`)
    e.ex.sets.filter((s) => s.done).forEach((s, i) => lines.push(`  Série ${i + 1}: ${setText(s, e.ex)}`))
    const v = exerciseVolume(e.ex)
    if (v > 0) lines.push(`  Volume: ${fmt(v, 0)} kg`)
  }
  const last = h[h.length - 1]
  if (def?.logType === 'strength' && last.ex.plan) {
    const sug = doubleProgression(last.ex.sets, last.ex.plan, def.incrementKg ?? 2.5)
    lines.push('', `SUGESTÃO DA APP (progressão dupla; não aplicada): ${sug.message}`)
  }
  lines.push('', hr, 'PEDIDO AO CHATGPT')
  lines.push(`Analisa a evolução do exercício "${name}" e diz-me se devo aumentar a carga, manter ou ajustar repetições/séries, e que fatores técnicos ou de recuperação devo observar.`)
  lines.push(...ASK_FOOTER_STYLE)
  return lines.join('\n')
}

// ---------------------------------------------------------------- performance

export function buildPerformanceReport(snap: Snapshot): string {
  const pm = perfPointsAll(snap)
  const lines = header(snap, 'RELATÓRIO DE PERFORMANCE ATLÉTICA', 'todo o histórico')
  const keys = allMetricKeys(snap, pm).filter((k) => (pm.get(k) ?? []).length)
  if (!keys.length) lines.push('Sem resultados de performance registados.')
  const byCat = new Map<string, string[]>()
  for (const key of keys) {
    const rec = perfRecord(snap, key, pm)!
    const pts = rec.points
    const l: string[] = []
    l.push(`  ${rec.def.label} (protocolo: ${rec.def.protocol})`)
    l.push(`    Melhor: ${metricValueText(key, rec.current?.value)}${rec.current ? ` em ${formatDatePT(rec.current.date)}` : ''}`)
    l.push(`    Último: ${metricValueText(key, pts[pts.length - 1].value)} em ${formatDatePT(pts[pts.length - 1].date)} | registos: ${pts.length}`)
    l.push(`    Evolução: ${pts.slice(-8).map((p) => `${formatDatePT(p.date)} ${metricValueText(key, p.value)}`).join('; ')}`)
    const cat = CATEGORY_LABEL[rec.def.category]
    byCat.set(cat, [...(byCat.get(cat) ?? []), ...l])
  }
  for (const [cat, ls] of byCat) lines.push(cat.toUpperCase(), ...ls, '')
  // força
  const strengthIds = ['supino-plano', 'agachamento', 'remada-apoio-peito']
  const str: string[] = []
  for (const id of strengthIds) {
    const s = exerciseSummary(exerciseHistory(snap.sessions, id), snap.exMap.get(id))
    if (s.heaviest) str.push(`  ${snap.exMap.get(id)?.namePt}: maior carga ${fmt(s.heaviest.weightKg, 2)} kg × ${s.heaviest.reps} (${formatDatePT(s.heaviest.date)})${s.e1rm ? ` | 1RM estimado ${fmt(s.e1rm.value, 1)} kg (estimativa)` : ''}`)
  }
  lines.push('FORÇA', ...(str.length ? str : ['  Sem dados']), '')
  const w = sortedBody(snap.bodyLogs).filter((l) => l.weightKg !== undefined)
  if (w.length) lines.push('PESO CORPORAL', `  Último: ${fmt(w[w.length - 1].weightKg)} kg (${formatDatePT(w[w.length - 1].date)})`, '')
  lines.push(hr, 'PEDIDO AO CHATGPT')
  lines.push('Analisa a minha evolução atlética (força, potência, velocidade, agilidade, resistência, mobilidade). Identifica as capacidades que mais progrediram, as que estagnaram, e o que devo priorizar nas próximas 4 semanas. Só compares resultados com o mesmo protocolo.')
  lines.push(...ASK_FOOTER_STYLE)
  return lines.join('\n')
}

// ---------------------------------------------------------------- JSON

export interface JsonReport {
  schema: typeof REPORT_SCHEMA
  schemaVersion: number
  generatedAt: string
  period: { from: ISODate; to: ISODate }
  profile: { heightCm: number; startWeightKg: number }
  sessions: Array<{
    id: string
    date: ISODate
    name: string
    kind: string
    status: string
    startedAt: string
    endedAt?: string
    durationSec?: number
    programWeek?: number
    phase?: number
    variant?: string
    plannedSets?: number
    doneSets?: number
    rpe?: number
    notes?: string
    volumeKg: number
    exercises: Array<{
      exerciseId: string
      name: string
      logType: string
      optional?: boolean
      plan?: { sets: number; repMin: number; repMax: number }
      notes?: string
      surface?: string
      course?: string
      volumeKg?: number
      estimated1RMKg?: number
      sets: Array<Omit<SetEntry, 'id'>>
    }>
    swim?: Session['swim']
  }>
  body: Array<Record<string, unknown>>
  nutrition: Array<{ date: ISODate; totals: ReturnType<typeof totalsOf>; target: Snapshot['settings']['nutrition']; meals: Array<{ slot: string; name: string; kcal: number; protein: number; carbs: number; fat: number }> }>
  hydrationSupplements: Array<Record<string, unknown>>
  recovery: Array<Record<string, unknown>>
  performance: Record<string, { label: string; unit: string; protocol: string; better: 'max' | 'min'; points: Array<{ date: ISODate; value: number; source: string }> }>
}

export function buildJsonReport(snap: Snapshot, from: ISODate, to: ISODate): JsonReport {
  const sessions = finished(snap.sessions).filter((s) => s.date >= from && s.date <= to)
  const pm = perfPointsAll(snap)
  const performance: JsonReport['performance'] = {}
  for (const key of allMetricKeys(snap, pm)) {
    const def = metricDefFor(key)
    const pts = (pm.get(key) ?? []).filter((p) => p.date >= from && p.date <= to)
    if (!def || !pts.length) continue
    performance[key] = { label: def.label, unit: def.unit, protocol: def.protocol, better: def.better, points: pts.map((p) => ({ date: p.date, value: p.value, source: p.source })) }
  }
  const nutDays = [...new Set(snap.meals.filter((m) => m.date >= from && m.date <= to).map((m) => m.date))].sort()
  return {
    schema: REPORT_SCHEMA,
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    period: { from, to },
    profile: { heightCm: snap.settings.heightCm, startWeightKg: snap.settings.startWeightKg },
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      name: s.name,
      kind: s.kind,
      status: s.status,
      startedAt: new Date(s.startedAt).toISOString(),
      endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : undefined,
      durationSec: s.endedAt ? Math.round((s.endedAt - s.startedAt) / 1000) : undefined,
      programWeek: s.programWeek,
      phase: s.phase,
      variant: s.variant,
      plannedSets: plannedVsDone(s).planned,
      doneSets: plannedVsDone(s).done,
      rpe: s.rpe,
      notes: s.notes,
      volumeKg: sessionVolume(s),
      exercises: s.exercises.map((e) => {
        const def = snap.exMap.get(e.exerciseId)
        const e1 = def?.e1rm ? Math.max(0, ...e.sets.filter(isWorkingSet).map((x) => estimate1RM(x.weightKg, x.reps) ?? 0)) : 0
        return {
          exerciseId: e.exerciseId,
          name: e.name,
          logType: e.logType,
          optional: e.optional,
          plan: e.plan ? { sets: e.plan.sets, repMin: e.plan.repMin, repMax: e.plan.repMax } : undefined,
          notes: e.notes,
          surface: e.surface,
          course: e.course,
          volumeKg: e.logType === 'strength' ? exerciseVolume(e) : undefined,
          estimated1RMKg: e1 > 0 ? round(e1, 1) : undefined,
          sets: e.sets.map(({ id: _id, ...rest }) => rest),
        }
      }),
      swim: s.swim,
    })),
    body: sortedBody(snap.bodyLogs).filter((l) => l.date >= from && l.date <= to).map(({ id: _i, updatedAt: _u, ...r }) => r),
    nutrition: nutDays.map((date) => {
      const m = mealsOn(snap.meals, date)
      return { date, totals: totalsOf(m), target: snap.settings.nutrition, meals: m.map((x) => ({ slot: x.slot, name: x.name, kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat })) }
    }),
    hydrationSupplements: snap.dayLogs.filter((d) => d.date >= from && d.date <= to).map(({ id: _i, updatedAt: _u, ...r }) => r),
    recovery: snap.recovery.filter((r) => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map(({ id: _i, updatedAt: _u, ...r }) => r),
    performance,
  }
}

export const FIXED_METRIC_KEYS = FIXED_METRICS.map((m) => m.key)
