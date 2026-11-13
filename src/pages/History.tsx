import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'
import { fmt, humanDuration, sessionSetsCount, sessionVolume } from '../lib/calc'
import { endOfWeek, formatShort, monthRange, startOfWeek, todayISO } from '../lib/dates'
import { MUSCLE_GROUPS, MUSCLE_LABEL } from '../lib/exercises'
import { finished, prsInSession } from '../lib/stats'
import type { MuscleGroup, SessionKind } from '../lib/types'
import { Empty, Field, Loading, PageHeader } from '../components/ui'
import { useSnap } from '../hooks/hooks'

type Period = 'tudo' | 'semana' | 'mes' | 'intervalo'

export default function History() {
  const snap = useSnap()
  const today = todayISO()
  const [period, setPeriod] = useState<Period>('tudo')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<SessionKind | 'todos'>('todos')
  const [status, setStatus] = useState<'todos' | 'completed' | 'partial'>('todos')
  const [muscle, setMuscle] = useState<MuscleGroup | 'todos'>('todos')
  const [ex, setEx] = useState('')

  const list = useMemo(() => {
    if (!snap) return []
    let a: [string, string] = ['0000-00-00', '9999-99-99']
    if (period === 'semana') a = [startOfWeek(today), endOfWeek(today)]
    if (period === 'mes') {
      const r = monthRange(today.slice(0, 7))
      a = [r.from, r.to]
    }
    if (period === 'intervalo') a = [from || a[0], to || a[1]]
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return finished(snap.sessions)
      .filter((s) => s.date >= a[0] && s.date <= a[1])
      .filter((s) => kind === 'todos' || s.kind === kind)
      .filter((s) => status === 'todos' || s.status === status)
      .filter((s) => muscle === 'todos' || s.exercises.some((e) => e.primary === muscle && e.sets.some((x) => x.done)))
      .filter((s) => !ex.trim() || s.exercises.some((e) => norm(e.name).includes(norm(ex))))
      .reverse()
  }, [snap, period, from, to, kind, status, muscle, ex, today])

  if (!snap) return <Loading />
  return (
    <div>
      <PageHeader title="Histórico" subtitle={`${list.length} sessão(ões)`} back />
      <div className="card space-y-3 p-4" data-testid="history-filters">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Período">
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Período">
              <option value="tudo">Tudo</option>
              <option value="semana">Esta semana</option>
              <option value="mes">Este mês</option>
              <option value="intervalo">Intervalo de datas</option>
            </select>
          </Field>
          <Field label="Tipo de treino">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as SessionKind | 'todos')} aria-label="Tipo de treino">
              <option value="todos">Todos</option>
              <option value="strength">Musculação</option>
              <option value="power">Potência + força</option>
              <option value="speed">Velocidade / agilidade</option>
              <option value="swim">Natação</option>
              <option value="custom">Livre / personalizado</option>
            </select>
          </Field>
        </div>
        {period === 'intervalo' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="De">
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
            </Field>
            <Field label="Até">
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Estado">
              <option value="todos">Todos</option>
              <option value="completed">Concluído</option>
              <option value="partial">Parcial</option>
            </select>
          </Field>
          <Field label="Grupo muscular">
            <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | 'todos')} aria-label="Grupo muscular">
              <option value="todos">Todos</option>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Exercício">
          <input className="input" value={ex} onChange={(e) => setEx(e.target.value)} placeholder="ex.: supino" aria-label="Filtrar por exercício" />
        </Field>
      </div>

      <div className="mt-4 space-y-3" data-testid="history-list">
        {list.length === 0 && <Empty title="Sem sessões" text="Nenhuma sessão corresponde aos filtros — ou ainda não terminaste nenhum treino." />}
        {list.map((s) => {
          const c = sessionSetsCount(s)
          const prs = prsInSession(snap, s)
          return (
            <Link key={s.id} to={`/sessao/${s.id}`} className="card block p-4" data-testid="history-item">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {formatShort(s.date)} · {s.status === 'completed' ? 'concluído' : 'parcial'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </div>
              <p className="num mt-2 text-sm text-muted">
                {humanDuration(s.endedAt ? (s.endedAt - s.startedAt) / 1000 : undefined)} · {c.done} séries · {fmt(sessionVolume(s), 0)} kg{s.rpe !== undefined ? ` · esforço ${fmt(s.rpe)}/10` : ''}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{s.exercises.filter((e) => e.sets.some((x) => x.done)).map((e) => e.name).join(' · ')}</p>
              {prs.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent">
                  <Trophy size={13} /> {prs.length} recorde{prs.length > 1 ? 's' : ''}
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
