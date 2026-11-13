import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronRight, History, Play, Plus } from 'lucide-react'
import { addDays, startOfWeek, WEEKDAYS_LONG } from '../lib/dates'
import { dayItems, STATUS_LABEL } from '../lib/program'
import { duplicateTemplate } from '../lib/repo'
import { Loading, PageHeader, Section, useToast } from '../components/ui'
import { useActiveSession, useSnap, useToday } from '../hooks/hooks'
import { useStartWorkout } from '../hooks/useStart'

export default function Train() {
  const snap = useSnap()
  const today = useToday()
  const active = useActiveSession()
  const { start, startFree } = useStartWorkout()
  const nav = useNavigate()
  const toast = useToast()
  if (!snap) return <Loading />
  const weekStart = startOfWeek(today)
  const week = snap.templates
    .filter((t) => !t.archived && t.weekday)
    .sort((a, b) => a.weekday! - b.weekday!)
  const others = snap.templates.filter((t) => !t.archived && !t.weekday)

  return (
    <div>
      <PageHeader title="Treinar" subtitle="Escolhe um treino ou regista fora do plano" />

      {active && (
        <Link to="/treino" data-testid="resume-card" className="card pulse mb-4 flex items-center gap-3 border-accent/50 p-4">
          <Play className="text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Retomar treino em curso</span>
            <span className="block truncate text-xs text-muted">{active.name}</span>
          </span>
          <ChevronRight className="text-accent" />
        </Link>
      )}

      <Section title="Plano semanal">
        <ul className="card divide-y divide-line" data-testid="week-plan">
          {week.map((t) => {
            const date = addDays(weekStart, t.weekday! - 1)
            const it = dayItems(date, today, snap.settings.program.startDate, snap.templates, snap.schedule, snap.sessions).find((x) => x.template.id === t.id)
            const status = it?.status ?? 'planeado'
            const isRest = t.kind === 'rest'
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3" data-testid={`plan-${t.weekday}`}>
                <Link to={`/dia/${date}`} className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{WEEKDAYS_LONG[t.weekday! - 1]}</span>
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {STATUS_LABEL[status]} · {isRest ? 'descanso' : `${t.exercises.length} blocos${t.durationLabel ? ` · ${t.durationLabel}` : ''}`}
                  </span>
                </Link>
                {!isRest && (
                  <button
                    data-testid={`start-${t.weekday}`}
                    className={`${date === today ? 'btn-primary' : 'btn-soft'} btn-sm shrink-0`}
                    disabled={!!active}
                    onClick={() => start(t.id, today)}
                    aria-label={`Iniciar ${t.name}`}
                  >
                    <Play size={14} fill="currentColor" /> {date === today ? 'Iniciar' : 'Fazer hoje'}
                  </button>
                )}
                <Link to={`/treinos/${t.id}`} aria-label={`Editar ${t.name}`} className="flex size-10 items-center justify-center rounded-xl text-muted active:bg-surface2">
                  <ChevronRight size={20} />
                </Link>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">“Fazer hoje” regista o treino na data de hoje, sem alterar o teu plano. Para mudar o dia usa o calendário.</p>
      </Section>

      <Section title="Os teus treinos">
        {others.length > 0 && (
          <ul className="card mb-3 divide-y divide-line">
            {others.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/treinos/${t.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="text-xs text-muted">{t.exercises.length} exercícios</span>
                </Link>
                <button className="btn-soft btn-sm" disabled={!!active} onClick={() => start(t.id, today)}>
                  <Play size={14} fill="currentColor" /> Iniciar
                </button>
                <button
                  aria-label={`Duplicar ${t.name}`}
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    const c = await duplicateTemplate(t.id)
                    if (c) toast('Treino duplicado.')
                  }}
                >
                  Duplicar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={() => nav('/treinos/novo')}>
            <Plus size={18} /> Criar treino
          </button>
          <button data-testid="free-workout" className="btn-ghost" disabled={!!active} onClick={() => startFree('Treino livre', today)}>
            <Play size={18} /> Treino livre
          </button>
        </div>
      </Section>

      <Section title="Mais">
        <div className="card divide-y divide-line">
          {[
            { to: '/exercicios', icon: BookOpen, label: 'Biblioteca de exercícios', sub: 'Técnica, vídeos e histórico' },
            { to: '/historico', icon: History, label: 'Histórico de treinos', sub: 'Filtrar, abrir e corrigir sessões' },
            { to: '/calendario', icon: CalendarDays, label: 'Calendário', sub: 'Mensal e semanal' },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="flex min-h-16 items-center gap-3 px-4 py-2">
              <l.icon size={22} className="text-accent" />
              <span className="flex-1">
                <span className="block font-medium">{l.label}</span>
                <span className="text-xs text-muted">{l.sub}</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          ))}
        </div>
      </Section>
    </div>
  )
}
