import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CalendarClock, Check, ChevronRight, FileText, Play, Plus } from 'lucide-react'
import { fmt, humanDuration, sessionSetsCount, sessionVolume } from '../lib/calc'
import { addDays, formatLong, isValidISO, todayISO } from '../lib/dates'
import { STATUS_LABEL, dayItems, programPosition } from '../lib/program'
import { postponeTemplate, scheduleTemplate, unschedule, upsertDayLog } from '../lib/repo'
import { mealsOn, totalsOf } from '../lib/stats'
import { Field, Loading, PageHeader, Section, Sheet, Toggle, useToast, NumInput } from '../components/ui'
import { useActiveSession, useSnap } from '../hooks/hooks'
import { useStartWorkout } from '../hooks/useStart'

export default function DayPage() {
  const { date = '' } = useParams()
  const snap = useSnap()
  const active = useActiveSession()
  const { start } = useStartWorkout()
  const toast = useToast()
  const [postpone, setPostpone] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')
  const [planning, setPlanning] = useState(false)
  if (!isValidISO(date)) return <Navigate to="/calendario" replace />
  if (!snap) return <Loading />
  const today = todayISO()
  const s = snap.settings
  const items = dayItems(date, today, s.program.startDate, snap.templates, snap.schedule, snap.sessions)
  const sessions = snap.sessions.filter((x) => x.date === date && x.status !== 'active')
  const activeHere = active && active.date === date ? active : undefined
  const body = snap.bodyLogs.find((b) => b.date === date)
  const rec = snap.recovery.find((r) => r.date === date)
  const meals = mealsOn(snap.meals, date)
  const assess = snap.assessments.filter((a) => a.date === date)
  const day = snap.dayLogs.find((d) => d.date === date)
  const pos = programPosition(date, s)
  const restLike = items.every((i) => i.template.kind === 'rest') || items.length === 0
  const rest = day?.rest ?? {}
  const setRest = (p: NonNullable<typeof day>['rest']) => upsertDayLog(date, { rest: { ...rest, ...p } })
  const manualAdds = snap.schedule.filter((o) => o.date === date && o.action === 'add')

  return (
    <div>
      <PageHeader title={formatLong(date)} subtitle={pos.beforeStart ? 'Antes do início do programa' : `Semana ${pos.week} · Fase ${pos.phase} (${pos.phaseInfo.name})`} back />

      <Section title="Plano">
        {items.length === 0 && <p className="card p-4 text-sm text-muted">Sem treino planeado para este dia.</p>}
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.template.id + it.status} className="card p-4" data-testid="day-item">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{it.template.name}</p>
                  <p className="text-xs text-muted">{it.template.subtitle}</p>
                </div>
                <span className={`chip ${it.status === 'concluido' ? '!bg-accent-soft !text-accent' : ''}`} data-testid="day-status">
                  {STATUS_LABEL[it.status]}
                  {it.status === 'adiado' && it.movedTo ? ` → ${it.movedTo.split('-').reverse().slice(0, 2).join('/')}` : ''}
                </span>
              </div>
              {it.session && (
                <Link to={it.session.status === 'active' ? '/treino' : `/sessao/${it.session.id}`} className="mt-3 flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-sm">
                  <Check size={16} className="text-accent" />
                  <span className="num flex-1">
                    {humanDuration(it.session.endedAt ? (it.session.endedAt - it.session.startedAt) / 1000 : undefined)} · {sessionSetsCount(it.session).done} séries · {it.session.exercises.filter((e) => e.sets.some((x) => x.done)).length}/{it.session.exercises.length} exercícios
                  </span>
                  <ChevronRight size={16} className="text-muted" />
                </Link>
              )}
              {!it.session && it.template.kind !== 'rest' && it.status !== 'adiado' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button data-testid="day-start" className="btn-primary btn-sm" disabled={!!active} onClick={() => start(it.template.id, date)}>
                    <Play size={14} fill="currentColor" /> {date === today ? 'Iniciar treino' : date > today ? 'Fazer já (data deste dia)' : 'Registar neste dia'}
                  </button>
                  {date >= today && (
                    <button data-testid="day-postpone" className="btn-soft btn-sm" onClick={() => { setPostpone(it.template.id); setNewDate(addDays(date, 1)) }}>
                      <CalendarClock size={14} /> Adiar / mudar dia
                    </button>
                  )}
                </div>
              )}
              {manualAdds.some((o) => o.templateId === it.template.id) && !it.session && (
                <button className="mt-2 text-xs text-muted underline" onClick={() => unschedule(it.template.id, date)}>
                  Remover desta data
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="btn-ghost mt-3 w-full" onClick={() => setPlanning(true)} data-testid="plan-session">
          <Plus size={18} /> Planear sessão neste dia
        </button>
        {activeHere && (
          <Link to="/treino" className="btn-soft mt-2 w-full">
            Treino em curso (abrir)
          </Link>
        )}
      </Section>

      {sessions.filter((x) => !items.some((i) => i.session?.id === x.id)).length > 0 && (
        <Section title="Sessões fora do plano">
          <div className="space-y-2">
            {sessions
              .filter((x) => !items.some((i) => i.session?.id === x.id))
              .map((x) => (
                <Link key={x.id} to={`/sessao/${x.id}`} className="card flex items-center gap-3 p-4">
                  <span className="flex-1">
                    <span className="block font-semibold">{x.name}</span>
                    <span className="num text-xs text-muted">
                      {humanDuration(x.endedAt ? (x.endedAt - x.startedAt) / 1000 : undefined)} · {fmt(sessionVolume(x), 0)} kg
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              ))}
          </div>
        </Section>
      )}

      <Section title="Registos do dia">
        <div className="card divide-y divide-line text-sm">
          <Row label="Peso / medidas" value={body ? [body.weightKg !== undefined ? `${fmt(body.weightKg)} kg` : '', body.waistCm ? `cintura ${fmt(body.waistCm)} cm` : ''].filter(Boolean).join(' · ') || 'registado' : undefined} to="/evolucao?tab=corpo" />
          <Row label="Nutrição" value={meals.length ? `${fmt(totalsOf(meals).kcal, 0)} kcal · P ${fmt(totalsOf(meals).protein, 0)} g` : undefined} to="/nutricao" />
          <Row label="Recuperação" value={rec ? [rec.sleepH !== undefined ? `sono ${fmt(rec.sleepH)} h` : '', rec.fatigue ? `fadiga ${rec.fatigue}/5` : ''].filter(Boolean).join(' · ') || 'registada' : undefined} to="/recuperacao" />
          <Row label="Avaliações" value={assess.length ? `${assess.length} resultado(s)` : undefined} to="/evolucao?tab=atletica" />
        </div>
      </Section>

      {restLike && (
        <Section title="Atividade de recuperação (opcional)">
          <div className="card px-4" data-testid="rest-log">
            <Toggle label="Caminhada" checked={!!rest.walk} onChange={(v) => setRest({ walk: v })} />
            {rest.walk && (
              <div className="pb-3">
                <Field label="Duração (min)">
                  <NumInput value={rest.walkMin} onChange={(v) => setRest({ walkMin: v })} decimals={false} max={600} aria-label="Minutos de caminhada" />
                </Field>
              </div>
            )}
            <Toggle label="Mobilidade suave" checked={!!rest.mobility} onChange={(v) => setRest({ mobility: v })} />
            <Toggle label="Alongamentos" checked={!!rest.stretching} onChange={(v) => setRest({ stretching: v })} />
            <Toggle label="Recuperação (gelo, massagem, sauna…)" checked={!!rest.recovery} onChange={(v) => setRest({ recovery: v })} />
          </div>
          <p className="mt-2 text-xs text-muted">Descansar faz parte do plano — nada aqui é obrigatório. Regista sono e fadiga em Recuperação.</p>
        </Section>
      )}

      <Link to={`/relatorios?tipo=diario&data=${date}`} className="btn-soft mt-6 w-full">
        <FileText size={18} /> Relatório diário deste dia
      </Link>

      <Sheet open={!!postpone} onClose={() => setPostpone(null)} title="Adiar / mudar de dia" footer={
        <button
          className="btn-primary w-full"
          onClick={async () => {
            if (!postpone || !isValidISO(newDate) || newDate === date) return toast('Escolhe outra data.', 'error')
            await postponeTemplate(postpone, date, newDate)
            toast('Treino movido apenas nesta ocorrência.')
            setPostpone(null)
          }}
        >
          Mover treino
        </button>
      }>
        <Field label="Nova data" hint="O plano semanal mantém-se para as semanas seguintes. Para mudar o dia habitual, edita o treino em Treinar.">
          <input type="date" className="input" value={newDate} min={today} onChange={(e) => setNewDate(e.target.value)} aria-label="Nova data" />
        </Field>
      </Sheet>

      <Sheet open={planning} onClose={() => setPlanning(false)} title="Planear sessão">
        <ul className="divide-y divide-line">
          {snap.templates.filter((t) => !t.archived && t.kind !== 'rest').map((t) => (
            <li key={t.id}>
              <button
                className="flex min-h-14 w-full items-center justify-between py-2 text-left"
                onClick={async () => {
                  await scheduleTemplate(t.id, date)
                  toast(`${t.name} planeado.`)
                  setPlanning(false)
                }}
              >
                <span className="font-medium">{t.name}</span>
                <Plus size={18} className="text-accent" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}

function Row({ label, value, to }: { label: string; value?: string; to: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
      <span>{label}</span>
      <span className={`num text-right ${value ? 'font-medium' : 'text-muted'}`}>{value ?? 'sem registo'}</span>
    </Link>
  )
}
