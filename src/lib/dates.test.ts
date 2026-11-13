import { describe, expect, it } from 'vitest'
import {
  addDays,
  diffDays,
  formatDatePT,
  formatLong,
  greeting,
  isValidISO,
  monthGrid,
  startOfWeek,
  todayISO,
  weekdayISO,
} from './dates'

describe('datas (Europe/Lisbon)', () => {
  it('todayISO usa o fuso de Lisboa (não UTC)', () => {
    // 2026-06-30T23:30:00Z já é 01/07 em Lisboa (UTC+1 no verão)
    expect(todayISO(Date.UTC(2026, 5, 30, 23, 30))).toBe('2026-07-01')
    // no inverno Lisboa = UTC
    expect(todayISO(Date.UTC(2026, 10, 13, 23, 30))).toBe('2026-11-13')
  })
  it('saudação conforme a hora de Lisboa', () => {
    expect(greeting(Date.UTC(2026, 10, 13, 8, 0))).toBe('Bom dia')
    expect(greeting(Date.UTC(2026, 10, 13, 15, 0))).toBe('Boa tarde')
    expect(greeting(Date.UTC(2026, 10, 13, 22, 0))).toBe('Boa noite')
  })
  it('aritmética de datas atravessa mudanças de hora', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(diffDays('2026-11-13', '2026-11-01')).toBe(12)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
  it('dia da semana ISO e início da semana na segunda-feira', () => {
    expect(weekdayISO('2026-11-13')).toBe(5) // sexta
    expect(weekdayISO('2026-11-15')).toBe(7) // domingo
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09')
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09')
  })
  it('formatos portugueses', () => {
    expect(formatDatePT('2026-11-13')).toBe('13/11/2026')
    expect(formatLong('2026-11-13')).toBe('sexta-feira, 13 de novembro')
  })
  it('validação de datas', () => {
    expect(isValidISO('2026-02-29')).toBe(false)
    expect(isValidISO('2028-02-29')).toBe(true)
    expect(isValidISO('13/11/2026')).toBe(false)
  })
  it('grelha mensal começa na segunda-feira e cobre o mês', () => {
    const g = monthGrid('2026-11')
    expect(g[0][0]).toBe('2026-10-26')
    expect(g[g.length - 1][6] >= '2026-11-30').toBe(true)
    expect(g.every((w) => w.length === 7)).toBe(true)
  })
})
