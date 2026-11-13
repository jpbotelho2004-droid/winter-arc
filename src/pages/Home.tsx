import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, CalendarDays, Check, Clock, FileText, Flame, Moon, Play, Trophy } from 'lucide-react'
import { fmt, humanDuration, sessionSetsCount, sessionVolume } from '../lib/calc'
import { diffDays, formatDatePT, formatLong, formatShort, greeting, weekDates, WEEKDAYS_SHORT } from '../lib/dates'
import { updateSettings } from '../lib/repo'
import { STATUS_LABEL, dayItems, nextPlannedAfter, programPosition, type DayItem, type DayStatus } from '../lib/program'
import {
  STRENGTH_PANEL,
  finished,
  latestWeight,
  metricDefFor,
  perfRecord,
  prsInSession,
  recoveryAdvice,
  strengthSeries,
  weekStats,
  type Snapshot,
} from '../lib/stats'
import { metricValueText } from '../lib/reports'
import { Brand } from '../components/Layout'
import { Spark } from '../components/charts'
import { Field, Loading, Notice, NumInput, Progress, Sheet, Stat } from '../components/ui'
import { useActiveSession, useSnap, useToday } from '../hooks/hooks'
import { useStartWorkout } from '../hooks/useStart'

const STATUS_STYLE: Record<DayStatus, string> = {
  planeado: 'border-line text-muted',
  concluido: 'border-accent bg-accent-soft text-accent',
  parcial: 'border-warn/60 bg-warn/10 text-warn',
  'nao-realizado': 'border-danger/50 text-danger',
  descanso: 'border-line text-muted',
  'em-curso': 'border-accent text-accent',
  adiado: 'border-line text-muted',
  'sem-plano': 'border-line text-muted',
}

function StatusIcon({ s }: { s: DayStatus }) {
  if (s === 'concluido') return <Check size={14} strokeWidth={3} />
  if (s === 'parcial') return <span className="text-[10px] font-bold">½</span>
  if (s === 'nao-realizado') return <span className="text-[10px] font-bold">✕</span>
  if (s === 'em-curso') return <Play size={12} />
  if (s === 'descanso') return <Moon size={13} />
  if (s === 'adiado') return <Clock size={13} />
  return <span className="size-1.5 rounded-full bg-current" />
}

function shortName(n: string): string {
  return n.replace('Lower Strength + Pliometria', 'Lower + Pliom.').replace('Lower Power + Hypertrophy', 'Lower Power').replace('Upper Hypertrophy', 'Upper Hyp.').replace('Speed & Agility', 'Speed & Agil.')
}

export default function Home() {
  const snap = useSnap()
  const today = useToday()
  const active = useActiveSession()
  const { start } = useStartWorkout()
  if (!snap) return <Loading />
  return <HomeBody snap={snap} today={today} activeId={active?.id} start={start} />
}

function HomeBody({ snap, today, activeId, start }: { snap: Snapshot; today: string; activeId?: string; start: (id: string, date?: string) => void }) {
  const s = snap.settings
  const pos = programPosition(today, s)
  const days = weekDates(today)
  const items = useMemo(() => days.map((d) => ({ date: d, items: dayItems(d, today, s.program.startDate, snap.templates, snap.schedule, snap.sessions) })), [days.join(), snap.templates, snap.schedule, snap.sessions, s.program.startDate, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const todayItems = items.find((x) => x.date === today)?.items ?? []
  const ws = weekStats(snap, today)
  const done = finished(snap.sessions)
  const last = done[done.length - 1]
  const lw = latestWeight(snap.bodyLogs)
  const adv = recoveryAdvice(snap.recovery, today)
  const lastRec = snap.recovery.filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0]
  const next = nextPlannedAfter(today, snap.templates, snap.schedule)
  const [onboard, setOnboard] = useState(!s.onboarded)
  const daysSinceBackup = s.lastBackupAt ? Math.floor((Date.now() - s.lastBackupAt) / 86400000) : undefined
  const needBackup = done.length > 0 && (daysSinceBackup === undefined || daysSinceBackup >= 14)
  const prs = last ? prsInSession(snap, last) : []
  const targets = Object.entries(s.targets ?? {}).filter(([, v]) => v > 0)

  const primary = todayItems.find((i) => i.template.kind !== 'rest')
  const restItem = todayItems.find((i) => i.template.kind === 'rest')

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Brand />
        <Link to="/definicoes" className="chip !px-3 !py-2">
          Definições
        </Link>
      </div>

      <p className="text-sm text-muted">{formatLong(today)}</p>
      <h1 className="display text-4xl font-bold leading-none" data-testid="greeting">
        {greeting()}
        {s.displayName ? `, ${s.displayName}` : ''}
      </h1>
      <div className="mt-3 flex flex-wrap gap-2" data-testid="program-chips">
        <Link to="/programa" className="chip-accent">
          {pos.beforeStart ? `Programa começa em ${formatDatePT(s.program.startDate)}` : `Semana ${pos.week}${pos.beyondProgram ? ' (programa concluído)' : ' de 12'}`}
        </Link>
        {!pos.beforeStart && (
          <Link to="/programa" className="chip">
            Fase {pos.phase} · {pos.phaseInfo.name}
          </Link>
        )}
      </div>

      {activeId && (
        <Link to="/treino" className="card pulse mt-4 flex items-center gap-3 border-accent/50 p-4">
          <Play className="text-accent" />
          <span className="flex-1 font-semibold">Treino em curso — continuar</span>
          <ArrowRight size={18} className="text-accent" />
        </Link>
      )}

      {pos.isLastWeekOfPhase && (
        <div className="mt-4">
          <Notice tone="info" title={`Última semana da fase ${pos.phase}`} action={<Link to="/programa" className="btn-soft btn-sm">Avaliar passagem de fase</Link>}>
            A passagem não é automática por data: avalia fadiga, dor e técnica antes de avançar ou prolonga a fase.
          </Notice>
        </div>
      )}
      {adv.level !== 'ok' && (
        <div className="mt-4">
          <Notice tone={adv.level === 'alerta' ? 'danger' : 'warn'} title="Recuperação" action={<Link to="/recuperacao" className="btn-soft btn-sm">Ver detalhes</Link>}>
            {adv.messages[0]}
          </Notice>
        </div>
      )}

      {/* Treino de hoje */}
      <section className="card mt-4 p-5" data-testid="today-card">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Treino de hoje</p>
        {primary ? (
          <TodayWorkout item={primary} today={today} start={start} activeId={activeId} />
        ) : restItem ? (
          <div className="mt-2">
            <h2 className="display text-3xl font-bold">Descanso</h2>
            <p className="mt-1 text-sm text-muted">Sem treino obrigatório. Descansar faz parte do plano.</p>
            <Link to={`/dia/${today}`} className="btn-soft mt-4 w-full">
              Registar caminhada, mobilidade ou recuperação
            </Link>
          </div>
        ) : (
          <div className="mt-2">
            <h2 className="display text-3xl font-bold">Sem treino planeado</h2>
            <Link to="/treinar" className="btn-soft mt-4 w-full">
              Escolher um treino
            </Link>
          </div>
        )}
      </section>

      {/* Calendário semanal */}
      <h2 className="h-section">Esta semana</h2>
      <div className="grid grid-cols-7 gap-1.5" data-testid="week-strip">
        {items.map(({ date, items: its }) => {
          const it = its[0] as DayItem | undefined
          const status: DayStatus = it?.status ?? 'sem-plano'
          const isToday = date === today
          const sess = it?.session
          return (
            <Link
              key={date}
              to={`/dia/${date}`}
              aria-label={`${formatShort(date)}: ${it ? `${it.template.name}, ${STATUS_LABEL[status]}` : 'sem plano'}`}
              className={`flex min-h-24 flex-col items-center justify-between rounded-xl border p-1.5 text-center transition active:scale-95 ${STATUS_STYLE[status]} ${isToday ? 'ring-2 ring-accent' : ''} bg-surface`}
            >
              <span className="text-[10px] font-semibold uppercase text-muted">{WEEKDAYS_SHORT[weekDates(date).indexOf(date)]}</span>
              <span className="num text-base font-bold text-ink">{Number(date.slice(8))}</span>
              <span className="line-clamp-2 text-[9px] font-semibold leading-tight">{it ? shortName(it.template.name) : '—'}</span>
              <span className="flex h-4 items-center justify-center">
                <StatusIcon s={status} />
              </span>
              {sess?.endedAt && <span className="sr-only">{humanDuration((sess.endedAt - sess.startedAt) / 1000)}</span>}
            </Link>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">Toca num dia para ver duração, exercícios concluídos e abrir a sessão.</p>

      {/* Números da semana */}
      <h2 className="h-section">Resumo da semana</h2>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Treinos" value={`${ws.completedCount}/${ws.plannedCount}`} sub="concluídos" accent />
        <Stat label="Volume" value={ws.volumeKg ? `${fmt(ws.volumeKg / 1000, 1)} t` : '—'} sub={ws.volumeKg ? `${fmt(ws.volumeKg, 0)} kg` : 'sem registos'} />
        <Stat label="Peso" value={lw ? `${fmt(lw.weightKg)}` : '—'} sub={lw ? `kg · ${formatDatePT(lw.date)}` : <Link to="/evolucao" className="text-accent">registar</Link>} />
      </div>

      {/* Último treino */}
      <h2 className="h-section">Último treino</h2>
      {last ? (
        <Link to={`/sessao/${last.id}`} className="card block p-4" data-testid="last-session">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{last.name}</p>
              <p className="text-xs text-muted">{formatShort(last.date)}</p>
            </div>
            <ArrowRight size={18} className="text-muted" />
          </div>
          <p className="num mt-2 text-sm text-muted">
            {humanDuration(last.endedAt ? (last.endedAt - last.startedAt) / 1000 : undefined)} · {sessionSetsCount(last).done} séries · {fmt(sessionVolume(last), 0)} kg
          </p>
          {prs.length > 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent">
              <Trophy size={14} /> {prs.length} recorde{prs.length > 1 ? 's' : ''}
            </p>
          )}
        </Link>
      ) : (
        <div className="card p-4 text-sm text-muted">Ainda não há treinos registados. Quando terminares o primeiro, aparece aqui.</div>
      )}

      {/* Força */}
      <h2 className="h-section">Evolução recente da força</h2>
      <div className="card divide-y divide-line">
        {STRENGTH_PANEL.map((p) => {
          const ser = strengthSeries(snap, p.exerciseId)
          const lastP = ser[ser.length - 1]
          const prevP = ser[ser.length - 2]
          const delta = lastP && prevP ? lastP.value - prevP.value : undefined
          return (
            <Link key={p.exerciseId} to={`/exercicio/${p.exerciseId}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.label}</span>
                <span className="text-xs text-muted">{lastP ? `última carga máx. · ${formatDatePT(lastP.date)}` : 'sem registos'}</span>
              </span>
              <Spark values={ser.slice(-8).map((x) => x.value)} />
              <span className="num w-20 text-right">
                <span className="block font-bold">{lastP ? `${fmt(lastP.value, 2)} kg` : '—'}</span>
                {delta !== undefined && <span className={`text-xs ${delta > 0 ? 'text-accent' : 'text-muted'}`}>{delta > 0 ? '+' : ''}{fmt(delta, 2)} kg</span>}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Objetivos */}
      <h2 className="h-section">Progresso dos objetivos</h2>
      <div className="card space-y-4 p-4">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Treinos desta semana</span>
            <span className="num font-semibold">
              {ws.completedCount}/{ws.plannedCount || '—'}
            </span>
          </div>
          <Progress value={ws.completedCount} max={ws.plannedCount || 1} />
        </div>
        {targets.map(([key, target]) => {
          const rec = perfRecord(snap, key)
          const def = metricDefFor(key)
          if (!rec || !def) return null
          const first = rec.points[0]?.value
          const cur = rec.current?.value
          let pct = 0
          if (first !== undefined && cur !== undefined && target !== first) pct = ((cur - first) / (target - first)) * 100
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{def.label}</span>
                <span className="num font-semibold">
                  {cur !== undefined ? metricValueText(key, cur) : '—'} → {metricValueText(key, target)}
                </span>
              </div>
              <Progress value={Math.max(0, pct)} max={100} />
            </div>
          )
        })}
        {!targets.length && (
          <p className="text-xs text-muted">
            Define metas (ex.: salto vertical) em <Link to="/definicoes" className="text-accent">Definições</Link> para acompanhares o progresso aqui.
          </p>
        )}
      </div>

      {/* Recuperação */}
      <h2 className="h-section">Recuperação</h2>
      <Link to="/recuperacao" className="card block p-4" data-testid="recovery-card">
        {lastRec ? (
          <>
            <p className="mb-2 text-xs text-muted">Último registo: {formatDatePT(lastRec.date)}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { l: 'Sono', v: lastRec.sleepH !== undefined ? `${fmt(lastRec.sleepH)} h` : '—' },
                { l: 'Energia', v: lastRec.energy ? `${lastRec.energy}/5` : '—' },
                { l: 'Fadiga', v: lastRec.fatigue ? `${lastRec.fatigue}/5` : '—' },
                { l: 'Dores', v: lastRec.soreness ? `${lastRec.soreness}/5` : '—' },
              ].map((x) => (
                <div key={x.l}>
                  <p className="num text-lg font-bold">{x.v}</p>
                  <p className="text-[11px] text-muted">{x.l}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Activity className="text-accent" />
            <span className="flex-1 text-sm">Ainda sem registos de recuperação. Regista sono, energia e fadiga em 30 segundos.</span>
            <ArrowRight size={18} className="text-muted" />
          </div>
        )}
      </Link>

      {/* Próxima sessão e relatório */}
      <h2 className="h-section">Próxima sessão</h2>
      {next ? (
        <Link to={`/dia/${next.date}`} className="card flex items-center gap-3 p-4">
          <CalendarDays className="text-accent" />
          <span className="flex-1">
            <span className="block font-semibold">{next.template.name}</span>
            <span className="text-xs text-muted">{formatShort(next.date)} · {diffDays(next.date, today) === 1 ? 'amanhã' : `daqui a ${diffDays(next.date, today)} dias`}</span>
          </span>
          <ArrowRight size={18} className="text-muted" />
        </Link>
      ) : (
        <div className="card p-4 text-sm text-muted">Sem sessões planeadas nos próximos dias.</div>
      )}

      <Link to="/relatorios?tipo=semanal" data-testid="weekly-report-link" className="btn-soft mt-4 w-full">
        <FileText size={18} /> Relatório semanal para o ChatGPT
      </Link>

      {needBackup && (
        <div className="mt-6">
          <Notice tone="warn" title="Faz uma cópia de segurança" action={<Link to="/backup" className="btn-soft btn-sm">Exportar backup</Link>}>
            Os dados ficam guardados apenas neste navegador e podem perder-se se o armazenamento for limpo.{' '}
            {daysSinceBackup === undefined ? 'Ainda não fizeste nenhuma cópia.' : `Última cópia há ${daysSinceBackup} dias.`}
          </Notice>
        </div>
      )}

      <Onboarding open={onboard} snap={snap} onDone={() => setOnboard(false)} />
    </div>
  )
}

function TodayWorkout({ item, today, start, activeId }: { item: DayItem; today: string; start: (id: string, date?: string) => void; activeId?: string }) {
  const t = item.template
  const sess = item.session
  return (
    <div className="mt-2">
      <h2 className="display text-4xl font-bold leading-none" data-testid="today-name">
        {t.name}
      </h2>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {t.durationLabel && (
          <span className="chip">
            <Clock size={12} /> {t.durationLabel}
          </span>
        )}
        <span className="chip">
          <Flame size={12} /> {t.exercises.length} blocos
        </span>
        <span className="chip">{STATUS_LABEL[item.status]}</span>
      </div>
      {item.status === 'concluido' || item.status === 'parcial' ? (
        <Link to={`/sessao/${sess!.id}`} className="btn-soft mt-4 w-full">
          <Check size={18} /> Ver sessão ({STATUS_LABEL[item.status].toLowerCase()})
        </Link>
      ) : item.status === 'em-curso' || activeId ? (
        <Link to="/treino" className="btn-primary mt-4 w-full">
          <Play size={18} /> Continuar treino
        </Link>
      ) : (
        <button data-testid="start-today" className="btn-primary mt-4 w-full !min-h-14 text-lg" onClick={() => start(t.id, today)}>
          <Play size={20} fill="currentColor" /> Iniciar treino
        </button>
      )}
      <Link to={`/dia/${today}`} className="mt-2 block text-center text-sm text-muted">
        Adiar ou mudar de dia
      </Link>
    </div>
  )
}

function Onboarding({ open, snap, onDone }: { open: boolean; snap: Snapshot; onDone: () => void }) {
  const s = snap.settings
  const [name, setName] = useState(s.displayName)
  const [weight, setWeight] = useState<number | undefined>(s.startWeightKg)
  const [height, setHeight] = useState<number | undefined>(s.heightCm)
  const [start, setStart] = useState(s.program.startDate)
  return (
    <Sheet
      open={open}
      onClose={() => {
        void updateSettings({ onboarded: true })
        onDone()
      }}
      title="Bem-vindo ao Winter Arc"
      footer={
        <button
          data-testid="onboarding-save"
          className="btn-primary w-full"
          onClick={async () => {
            await updateSettings({
              displayName: name.trim(),
              startWeightKg: weight ?? s.startWeightKg,
              heightCm: height ?? s.heightCm,
              program: { ...s.program, startDate: start },
              onboarded: true,
            })
            onDone()
          }}
        >
          Começar
        </button>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Os teus dados ficam guardados <strong className="text-ink">apenas neste dispositivo</strong>. Confirma os valores iniciais (podes alterá-los depois em Definições).
      </p>
      <div className="space-y-3 pb-2">
        <Field label="Nome (opcional)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso inicial (kg)">
            <NumInput value={weight} onChange={setWeight} max={300} aria-label="Peso inicial" />
          </Field>
          <Field label="Altura (cm)">
            <NumInput value={height} onChange={setHeight} max={260} decimals={false} aria-label="Altura" />
          </Field>
        </div>
        <Field label="Início do programa (semana 1)" hint="Por defeito, a próxima segunda-feira (ou hoje, se for segunda).">
          <input type="date" className="input" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Início do programa" />
        </Field>
        <p className="flex gap-2 rounded-xl bg-surface2 p-3 text-xs text-muted">
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <span>Esta app não substitui aconselhamento médico ou de um treinador. Se tiveres dor ou lesão, procura um profissional.</span>
        </p>
      </div>
    </Sheet>
  )
}
