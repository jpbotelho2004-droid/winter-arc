import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatMonthYear, formatShort, monthGrid, monthKey, shiftMonth, startOfWeek, todayISO, WEEKDAYS_SHORT, weekDates } from '../lib/dates'
import { STATUS_LABEL, dayItems, type DayStatus } from '../lib/program'
import { Loading, PageHeader, Segmented } from '../components/ui'
import { useSnap } from '../hooks/hooks'

const DOT: Record<DayStatus, string> = {
  planeado: 'border border-muted bg-transparent',
  concluido: 'bg-accent',
  parcial: 'bg-warn',
  'nao-realizado': 'bg-danger',
  descanso: 'border border-line bg-transparent',
  'em-curso': 'bg-accent animate-pulse',
  adiado: 'border border-warn bg-transparent',
  'sem-plano': 'bg-transparent',
}

export default function CalendarPage() {
  const snap = useSnap()
  const today = todayISO()
  const [view, setView] = useState<'mes' | 'semana'>('mes')
  const [month, setMonth] = useState(monthKey(today))
  const [week, setWeek] = useState(startOfWeek(today))
  const grid = useMemo(() => monthGrid(month), [month])
  if (!snap) return <Loading />
  const start = snap.settings.program.startDate
  const bodyDates = new Set(snap.bodyLogs.map((b) => b.date))
  const assessDates = new Set(snap.assessments.map((a) => a.date))

  const cell = (d: string, compact: boolean) => {
    const its = dayItems(d, today, start, snap.templates, snap.schedule, snap.sessions)
    const extra = snap.sessions.filter((s) => s.date === d && s.status !== 'active' && !its.some((i) => i.session?.id === s.id))
    return (
      <Link
        key={d}
        to={`/dia/${d}`}
        aria-label={formatShort(d)}
        data-testid={`cal-${d}`}
        className={`flex flex-col items-center rounded-xl border p-1 ${compact ? 'min-h-16' : 'min-h-20'} ${d === today ? 'border-accent' : 'border-line'} ${d.slice(0, 7) !== month && view === 'mes' ? 'opacity-40' : ''} bg-surface`}
      >
        <span className="num text-sm font-semibold">{Number(d.slice(8))}</span>
        <span className="mt-1 flex flex-wrap justify-center gap-1">
          {its.map((i, k) => (
            <span key={k} className={`size-2.5 rounded-full ${DOT[i.status]}`} title={`${i.template.name}: ${STATUS_LABEL[i.status]}`} />
          ))}
          {extra.map((s) => (
            <span key={s.id} className="size-2.5 rounded-full bg-accent" title={`${s.name} (fora do plano)`} />
          ))}
        </span>
        <span className="mt-auto flex gap-1 pt-1">
          {bodyDates.has(d) && <span className="size-1.5 rounded-[2px] bg-sky-400" title="Registo corporal" />}
          {assessDates.has(d) && <span className="size-1.5 rotate-45 bg-purple-400" title="Avaliação de performance" />}
        </span>
      </Link>
    )
  }

  return (
    <div>
      <PageHeader title="Calendário" back />
      <Segmented value={view} onChange={setView} label="Vista" options={[{ value: 'mes', label: 'Mês' }, { value: 'semana', label: 'Semana' }]} />

      <div className="mt-4 flex items-center justify-between">
        <button aria-label="Anterior" className="flex size-11 items-center justify-center rounded-xl bg-surface2" onClick={() => (view === 'mes' ? setMonth(shiftMonth(month, -1)) : setWeek(addDays(week, -7)))}>
          <ChevronLeft />
        </button>
        <p className="font-semibold capitalize" data-testid="cal-title">
          {view === 'mes' ? formatMonthYear(month) : `${formatShort(week)} – ${formatShort(addDays(week, 6))}`}
        </p>
        <button aria-label="Seguinte" className="flex size-11 items-center justify-center rounded-xl bg-surface2" onClick={() => (view === 'mes' ? setMonth(shiftMonth(month, 1)) : setWeek(addDays(week, 7)))}>
          <ChevronRight />
        </button>
      </div>

      {view === 'mes' ? (
        <div className="mt-3">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted">
            {WEEKDAYS_SHORT.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{grid.flat().map((d) => cell(d, true))}</div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {weekDates(week).map((d) => {
            const its = dayItems(d, today, start, snap.templates, snap.schedule, snap.sessions)
            const extra = snap.sessions.filter((s) => s.date === d && s.status !== 'active' && !its.some((i) => i.session?.id === s.id))
            return (
              <Link key={d} to={`/dia/${d}`} className={`card flex items-center gap-3 p-3 ${d === today ? '!border-accent' : ''}`}>
                <div className="w-12 text-center">
                  <p className="text-[10px] font-semibold uppercase text-muted">{WEEKDAYS_SHORT[weekDates(d).indexOf(d)]}</p>
                  <p className="num text-xl font-bold">{Number(d.slice(8))}</p>
                </div>
                <div className="min-w-0 flex-1">
                  {its.map((i, k) => (
                    <p key={k} className="flex items-center gap-2 text-sm">
                      <span className={`size-2.5 shrink-0 rounded-full ${DOT[i.status]}`} />
                      <span className="truncate font-medium">{i.template.name}</span>
                      <span className="text-xs text-muted">{STATUS_LABEL[i.status]}</span>
                    </p>
                  ))}
                  {extra.map((s) => (
                    <p key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 rounded-full bg-accent" />
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="text-xs text-muted">fora do plano</span>
                    </p>
                  ))}
                  {!its.length && !extra.length && <p className="text-sm text-muted">Sem plano</p>}
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        {([['concluido', 'Concluído'], ['parcial', 'Parcial'], ['planeado', 'Planeado'], ['nao-realizado', 'Não realizado'], ['adiado', 'Adiado'], ['descanso', 'Descanso']] as Array<[DayStatus, string]>).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${DOT[k]}`} /> {l}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-sky-400" /> Registo corporal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rotate-45 bg-purple-400" /> Avaliação
        </span>
      </div>
    </div>
  )
}
