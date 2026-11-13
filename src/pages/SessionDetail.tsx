import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Trash2, Trophy } from 'lucide-react'
import { fmt, humanDuration, sessionSetsCount, sessionVolume } from '../lib/calc'
import { addDays, diffDays, formatLong, formatTimePT, isValidISO } from '../lib/dates'
import { deleteSession } from '../lib/repo'
import { buildDailyReport, sessionBlock } from '../lib/reports'
import { prsInSession } from '../lib/stats'
import { Confirm, Field, Loading, NumInput, PageHeader, Notice, Stat, useToast } from '../components/ui'
import { ReportActions } from '../components/ReportActions'
import { WorkoutEditor } from '../components/WorkoutEditor'
import { useSessionEditor, useSnap } from '../hooks/hooks'

export default function SessionDetail() {
  const { id } = useParams()
  const { session, update } = useSessionEditor(id)
  const snap = useSnap()
  const loc = useLocation()
  const nav = useNavigate()
  const toast = useToast()
  const [del, setDel] = useState(false)
  const justFinished = (loc.state as { justFinished?: boolean } | null)?.justFinished
  const prs = useMemo(() => (snap && session ? prsInSession(snap, session) : []), [snap, session])

  if (session === undefined || !snap) return <Loading />
  if (session === null)
    return (
      <>
        <PageHeader title="Sessão" back />
        <Notice tone="warn" title="Sessão não encontrada">Pode ter sido apagada.</Notice>
      </>
    )
  if (session.status === 'active') return <Navigate to="/treino" replace />

  const counts = sessionSetsCount(session)
  const dur = session.endedAt ? (session.endedAt - session.startedAt) / 1000 : undefined
  const reportText = buildDailyReport(snap, session.date)
  const sessionOnly = ['WINTER ARC — SESSÃO', ...sessionBlock(snap, session)].join('\n')

  const changeDate = (d: string) => {
    if (!isValidISO(d)) return
    const delta = diffDays(d, session.date) * 86400000
    update((s) => ({ ...s, date: d, startedAt: s.startedAt + delta, endedAt: s.endedAt ? s.endedAt + delta : s.endedAt }))
  }
  void addDays

  return (
    <div>
      <PageHeader title={session.name} subtitle={`${formatLong(session.date)} · ${formatTimePT(session.startedAt)}`} back="/historico" />

      {justFinished && (
        <div className="mb-4" data-testid="just-finished">
          <Notice tone="info" title="Treino guardado ✓">
            Os dados ficaram guardados neste dispositivo. Copia o relatório para enviar ao ChatGPT.
          </Notice>
          <div className="mt-3">
            <ReportActions text={reportText} filename={`winter-arc-diario-${session.date}.txt`} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Duração" value={humanDuration(dur)} />
        <Stat label="Séries" value={`${counts.done}/${counts.total}`} />
        <Stat label="Volume" value={`${fmt(sessionVolume(session), 0)} kg`} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Estado: <strong className="text-ink">{session.status === 'completed' ? 'concluído' : 'parcialmente concluído'}</strong>
        {session.phase && (session.programWeek ?? 0) >= 1 ? ` · Fase ${session.phase}, semana ${session.programWeek}` : session.programWeek === 0 ? ' · antes do início do programa' : ''}
        {session.rpe !== undefined ? ` · esforço ${fmt(session.rpe)}/10` : ''}
      </p>

      {prs.length > 0 && (
        <div className="mt-3 rounded-2xl border border-accent/40 bg-accent-soft p-4" data-testid="session-prs">
          <p className="flex items-center gap-2 font-semibold text-accent">
            <Trophy size={18} /> Recordes nesta sessão
          </p>
          <ul className="mt-1 list-inside list-disc text-sm">
            {prs.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="h-section">Corrigir sessão</h2>
      <p className="mb-3 text-sm text-muted">Podes corrigir qualquer valor. As estatísticas e os gráficos são recalculados automaticamente.</p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" className="input" value={session.date} onChange={(e) => changeDate(e.target.value)} aria-label="Data da sessão" />
        </Field>
        <Field label="Esforço (1–10)">
          <NumInput value={session.rpe} onChange={(v) => update((s) => ({ ...s, rpe: v }))} min={1} max={10} placeholder="—" aria-label="Esforço da sessão" />
        </Field>
      </div>

      <WorkoutEditor session={session} update={update} snap={snap} readOnly={false} />

      <Field label="Notas da sessão">
        <textarea className="input mt-1 min-h-24 py-3" value={session.notes ?? ''} onChange={(e) => update((s) => ({ ...s, notes: e.target.value || undefined }))} aria-label="Notas da sessão" />
      </Field>

      <h2 className="h-section">Relatório</h2>
      <ReportActions text={sessionOnly} filename={`winter-arc-sessao-${session.date}.txt`} />
      <p className="mt-2 text-xs text-muted">Para o relatório completo do dia/semana/mês usa a área <Link to="/relatorios" className="text-accent">Relatórios</Link>.</p>

      <button data-testid="delete-session" className="btn-danger mt-8 w-full" onClick={() => setDel(true)}>
        <Trash2 size={18} /> Apagar esta sessão
      </button>
      <Confirm
        open={del}
        danger
        title="Apagar sessão?"
        message="Esta sessão será removida do histórico e das estatísticas. Não pode ser anulada (exceto se tiveres uma cópia de segurança)."
        confirmLabel="Apagar sessão"
        onCancel={() => setDel(false)}
        onConfirm={async () => {
          await deleteSession(session.id)
          toast('Sessão apagada.')
          nav('/historico', { replace: true })
        }}
      />
    </div>
  )
}
