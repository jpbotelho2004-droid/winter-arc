// Utilitários de datas. Todas as datas "de calendário" são strings YYYY-MM-DD no fuso Europe/Lisbon.
// A aritmética é feita em UTC sobre a data pura, para evitar problemas de mudança de hora.

import type { ISODate } from './types'

export const TZ = 'Europe/Lisbon'

const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false })
const timeFmt = new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-PT', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const WEEKDAYS_LONG = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']
export const WEEKDAYS_SHORT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
export const WEEKDAYS_UPPER = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO']
export const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function todayISO(ms: number = Date.now()): ISODate {
  return isoFmt.format(new Date(ms))
}

export function lisbonHour(ms: number = Date.now()): number {
  return Number(hourFmt.format(new Date(ms))) % 24
}

export function isValidISO(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function toUTC(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * 86400000)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000)
}

/** 1 = segunda … 7 = domingo */
export function weekdayISO(iso: ISODate): number {
  const d = new Date(toUTC(iso)).getUTCDay()
  return d === 0 ? 7 : d
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, 1 - weekdayISO(iso))
}

export function endOfWeek(iso: ISODate): ISODate {
  return addDays(startOfWeek(iso), 6)
}

export function weekDates(iso: ISODate): ISODate[] {
  const s = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7)
}

export function monthRange(key: string): { from: ISODate; to: ISODate } {
  const [y, m] = key.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` }
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Grelha mensal: semanas (segunda→domingo) com as datas que cobrem o mês. */
export function monthGrid(key: string): ISODate[][] {
  const { from, to } = monthRange(key)
  const weeks: ISODate[][] = []
  let cur = startOfWeek(from)
  while (cur <= to) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)))
    cur = addDays(cur, 7)
  }
  return weeks
}

export function rangeDates(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** 13/11/2026 */
export function formatDatePT(iso: ISODate): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** sexta-feira, 13 de novembro */
export function formatLong(iso: ISODate): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS_LONG[weekdayISO(iso) - 1]}, ${d} de ${MONTHS_LONG[m - 1]}`
}

/** sex, 13 nov */
export function formatShort(iso: ISODate): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS_SHORT[weekdayISO(iso) - 1]}, ${d} ${MONTHS_SHORT[m - 1]}`
}

export function formatDayMonth(iso: ISODate): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export function formatMonthYear(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS_LONG[m - 1]} de ${y}`
}

export function formatTimePT(ms: number): string {
  return timeFmt.format(new Date(ms))
}

export function formatDateTimePT(ms: number): string {
  return dateTimeFmt.format(new Date(ms)).replace(',', '')
}

export function greeting(ms: number = Date.now()): string {
  const h = lisbonHour(ms)
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 20) return 'Boa tarde'
  return 'Boa noite'
}
