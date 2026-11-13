import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Clock, Minus, Plus, SkipForward, Trash2, X } from 'lucide-react'
import { clock, fmt, sessionSetsCount, sessionVolume } from '../lib/calc'
import { formatLong, formatTimePT } from '../lib/dates'
import { finishSession, discardSession } from '../lib/repo'
import { adjustRest, skipRest } from '../lib/sessionOps'
import { PHASES } from '../lib/program'
import { WorkoutEditor } from '../components/WorkoutEditor'
import { Confirm, Empty, Field, Loading, NumInput, Sheet, useToast } from '../components/ui'
import { useActiveSession, useNow, useSessionEditor, useSnap } from '../hooks/hooks'

function RestBar({ rest, update }: { rest: NonNullable<ReturnType<typeof useSessionEditor>['session']>['rest']; update: ReturnType<typeof useSessionEditor>['update'] }) {
  const now = useNow(250)
  if (!rest) return null
  const left = Math.ceil((rest.endsAt - now) / 1000)
  const done = left <= 0
  const pct = Math.max(0, Math.min(100, (1 - (rest.endsAt - now) / (rest.durationSec * 1000)) * 100))
  return (
    <div
      className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 mx-auto max-w-xl overflow-hidden rounded-2xl border bg-surface shadow-2xl md:bottom-4 md:left-[calc(15rem+1rem)] md:right-4 md:mx-0 ${done ? 'border-accent pulse' : 'border-line'}`}
      data-testid="rest-bar"
      role="timer"
      aria-live="off"
    >
      <div className="h-1 bg-surface2">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{done ? 'Descanso terminado' : `Descanso · ${rest.exerciseName ?? ''}`}</p>
          <p className={`num text-3xl font-bold leading-none ${done ? 'text-accent' : ''}`} data-testid="rest-clock">
            {done ? '0:00' : clock(left)}
          </p>
        </div>
        {!done && (
          <>
            <button aria-label="Menos 15 segundos" className="flex size-12 items-center justify-center rounded-xl bg-surface2 active:bg-line" onClick={() => update((s) => adjustRest(s, -15))}>
              <Minus size={18} />
            </button>
            <button aria-label="Mais 15 segundos" className="flex size-12 items-center justify-center rounded-xl bg-surface2 active:bg-line" onClick={() => update((s) => adjustRest(s, 15))}>
              <Plus size={18} />
            </button>
          </>
        )}
        <button data-testid="skip-rest" className={`flex min-h-12 items-center gap-1 rounded-xl px-4 font-semibold ${done ? 'bg-accent text-accent-ink' : 'bg-surface2'}`} onClick={() => update((s) => skipRest(s))}>
          {done ? 'OK' : (<><SkipForward size={16} /> Saltar</>)}
        </button>
      </div>
    </div>
  )
}

export default function Workout() {
  const active = useActiveSession()
  const snap = useSnap()
  if (active === undefined || !snap) return <Loading />
  if (active === null)
    return (
      <Empty
        icon={<Clock size={32} />}
        title="Sem treino em curso"
        text="Escolhe um treino no separador Treinar para começar."
        action={
          <Link to="/treinar" className="btn-primary">
            Ir para Treinar
          </Link>
        }
      />
    )
  return <ActiveWorkout id={active.id} />
}

function ActiveWorkout({ id }: { id: string }) {
  const snap = useSnap()
  const { session, update, error, flush } = useSessionEditor(id)
  const nav = useNavigate()
  const toast = useToast()
  const now = useNow(1000)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [rpe, setRpe] = useState<number | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  // manter o ecrã ligado durante o treino (quando suportado)
  const keepAwake = snap?.settings.keepAwake
  useEffect(() => {
    if (!keepAwake || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* não suportado ou recusado */
      }
    }
    void acquire()
    const onVis = () => document.visibilityState === 'visible' && void acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => {})
    }
  }, [keepAwake])

  if (!session || !snap) return <Loading />
  if (session.status !== 'active') return <Navigate to={`/sessao/${session.id}`} replace />

  const counts = sessionSetsCount(session)
  const phase = session.phase ? PHASES[session.phase - 1] : undefined
  const untouched = session.exercises.filter((e) => !e.sets.some((s) => s.done))

  const doFinish = async () => {
    setBusy(true)
    try {
      await flush()
      await finishSession(session.id, { rpe })
      nav(`/sessao/${session.id}`, { state: { justFinished: true }, replace: true })
    } catch (e) {
      toast(`Não foi possível terminar: ${(e as Error).message}`, 'error')
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 mb-3 border-b border-line bg-bg/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-2xl font-bold leading-none" data-testid="workout-title">
              {session.name}
            </h1>
            <p className="mt-1 truncate text-xs text-muted">
              {formatLong(session.date)} · início {formatTimePT(session.startedAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="num text-2xl font-bold leading-none text-accent" data-testid="session-clock" aria-label="Duração do treino">
              {clock((now - session.startedAt) / 1000)}
            </p>
            <p className="num mt-1 text-xs text-muted">
              {counts.done}/{counts.total} séries
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button data-testid="finish-workout" className="btn-primary flex-1" onClick={() => setFinishOpen(true)}>
            Terminar treino
          </button>
          <button aria-label="Descartar treino" data-testid="discard-workout" className="btn-danger !px-4" onClick={() => setDiscard(true)}>
            <Trash2 size={20} />
          </button>
        </div>
        {error && <p className="mt-2 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>

      {phase && (
        <div className="card mb-3 px-4 py-3 text-sm">
          <p className="font-semibold">
            Fase {phase.n} · {phase.name} <span className="text-muted">— alvo: {phase.rir}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">{phase.summary}</p>
        </div>
      )}

      <WorkoutEditor session={session} update={update} snap={snap} />

      <Field label="Notas da sessão">
        <textarea className="input mt-1 min-h-24 py-3" value={session.notes ?? ''} onChange={(e) => update((s) => ({ ...s, notes: e.target.value || undefined }))} placeholder="Como te sentiste? Alguma dor ou ajuste técnico?" aria-label="Notas da sessão" />
      </Field>

      <RestBar rest={session.rest} update={update} />

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title="Terminar treino">
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface2 p-3">
              <p className="num text-xl font-bold">{clock((now - session.startedAt) / 1000)}</p>
              <p className="text-[11px] text-muted">duração</p>
            </div>
            <div className="rounded-xl bg-surface2 p-3">
              <p className="num text-xl font-bold">
                {counts.done}/{counts.total}
              </p>
              <p className="text-[11px] text-muted">séries</p>
            </div>
            <div className="rounded-xl bg-surface2 p-3">
              <p className="num text-xl font-bold">{fmt(sessionVolume(session), 0)}</p>
              <p className="text-[11px] text-muted">kg volume</p>
            </div>
          </div>
          {untouched.length > 0 && (
            <p className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
              {untouched.length} exercício(s) sem séries concluídas ({untouched.map((e) => e.name).join(', ')}). A sessão ficará marcada como <strong>parcialmente concluída</strong>.
            </p>
          )}
          <Field label="Esforço da sessão (1–10, opcional)">
            <NumInput value={rpe} onChange={setRpe} min={1} max={10} placeholder="—" aria-label="Esforço da sessão" testId="session-rpe" />
          </Field>
          <button data-testid="confirm-finish" className="btn-primary w-full" disabled={busy} onClick={doFinish}>
            Terminar e guardar
          </button>
          <button className="btn-ghost w-full" onClick={() => setFinishOpen(false)}>
            <X size={18} /> Continuar a treinar
          </button>
        </div>
      </Sheet>

      <Confirm
        open={discard}
        danger
        title="Descartar este treino?"
        message="Todas as séries registadas nesta sessão serão apagadas. Esta ação não pode ser anulada."
        confirmLabel="Descartar treino"
        onCancel={() => setDiscard(false)}
        onConfirm={async () => {
          await flush()
          await discardSession(session.id)
          nav('/treinar', { replace: true })
        }}
      />
    </div>
  )
}
