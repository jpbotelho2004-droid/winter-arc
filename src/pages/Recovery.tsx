import { useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { fmt } from '../lib/calc'
import { addDays, formatDatePT, formatLong, todayISO } from '../lib/dates'
import { upsertRecovery } from '../lib/repo'
import { recoveryAdvice } from '../lib/stats'
import type { ISODate, RecoveryLog } from '../lib/types'
import { TimeChart } from '../components/charts'
import { Field, Loading, Notice, NumInput, PageHeader, ScaleInput, Section, Toggle } from '../components/ui'
import { useSnap } from '../hooks/hooks'

export default function Recovery() {
  const snap = useSnap()
  const [date, setDate] = useState<ISODate>(todayISO())
  if (!snap) return <Loading />
  const log = snap.recovery.find((r) => r.date === date)
  const set = (p: Partial<RecoveryLog>) => void upsertRecovery(date, p)
  const advice = recoveryAdvice(snap.recovery, date)
  const rec = snap.recovery.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-28)
  const hasJoint = log?.jointPain !== undefined

  return (
    <div>
      <PageHeader title="Recuperação" subtitle="Registo diário rápido (escalas de 1 a 5)" back />
      <div className="flex items-center justify-between gap-2">
        <button aria-label="Dia anterior" className="flex size-11 items-center justify-center rounded-xl bg-surface2" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft />
        </button>
        <div className="text-center">
          <p className="font-semibold capitalize">{date === todayISO() ? 'Hoje' : formatLong(date)}</p>
          <p className="text-xs text-muted">{formatDatePT(date)}</p>
        </div>
        <button aria-label="Dia seguinte" className="flex size-11 items-center justify-center rounded-xl bg-surface2 disabled:opacity-30" disabled={date >= todayISO()} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight />
        </button>
      </div>

      {advice.level !== 'ok' && (
        <div className="mt-4" data-testid="recovery-advice">
          <Notice tone={advice.level === 'alerta' ? 'danger' : 'warn'} title="Atenção à recuperação">
            <ul className="list-disc space-y-1 pl-5">
              {advice.messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="card mt-4 space-y-5 p-4" data-testid="recovery-form">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horas de sono">
            <NumInput testId="sleep-h" value={log?.sleepH} onChange={(v) => set({ sleepH: v })} max={24} placeholder="7,5" aria-label="Horas de sono" />
          </Field>
        </div>
        <ScaleInput label="Qualidade do sono" labels={['má', 'ótima']} value={log?.sleepQ} onChange={(v) => set({ sleepQ: v })} testId="sleepq" />
        <ScaleInput label="Energia" labels={['sem energia', 'muita']} value={log?.energy} onChange={(v) => set({ energy: v })} testId="energy" />
        <ScaleInput label="Fadiga" labels={['nada', 'extrema']} value={log?.fatigue} onChange={(v) => set({ fatigue: v })} testId="fatigue" />
        <ScaleInput label="Dores musculares" labels={['nenhuma', 'muitas']} value={log?.soreness} onChange={(v) => set({ soreness: v })} testId="soreness" />
        <ScaleInput label="Stress" labels={['calmo', 'muito stress']} value={log?.stress} onChange={(v) => set({ stress: v })} testId="stress" />
        <ScaleInput label="Motivação" labels={['baixa', 'alta']} value={log?.motivation} onChange={(v) => set({ motivation: v })} testId="motivation" />
        <div>
          <Toggle
            label="Tenho dor articular"
            checked={hasJoint}
            onChange={(v) => (v ? set({ jointPain: 2 }) : upsertRecovery(date, { jointPain: undefined, jointPainWhere: undefined }))}
          />
          {hasJoint && (
            <div className="mt-2 space-y-3">
              <ScaleInput label="Intensidade da dor articular" labels={['ligeira', 'forte']} value={log?.jointPain} onChange={(v) => set({ jointPain: v ?? 1 })} testId="joint" />
              <Field label="Onde?">
                <input className="input" value={log?.jointPainWhere ?? ''} onChange={(e) => set({ jointPainWhere: e.target.value || undefined })} placeholder="ex.: joelho direito" aria-label="Local da dor articular" />
              </Field>
            </div>
          )}
        </div>
        <Field label="Notas">
          <input className="input" value={log?.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} aria-label="Notas de recuperação" />
        </Field>
        <p className="flex gap-2 rounded-xl bg-surface2 p-3 text-xs text-muted">
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <span>Guardado automaticamente. As indicações da app são genéricas e não são diagnósticos. Em caso de dor persistente, procura um profissional de saúde.</span>
        </p>
      </div>

      <Section title="Tendências">
        {rec.length === 0 ? (
          <p className="text-sm text-muted">Sem registos ainda.</p>
        ) : (
          <div className="space-y-3">
            <div className="card p-3">
              <p className="mb-2 text-sm font-semibold">Sono (horas)</p>
              <TimeChart data={rec.map((r) => ({ date: r.date, sono: r.sleepH }))} series={[{ key: 'sono', label: 'Sono (h)' }]} unit="h" />
            </div>
            <div className="card p-3">
              <p className="mb-2 text-sm font-semibold">Energia, fadiga e stress (1–5)</p>
              <TimeChart
                data={rec.map((r) => ({ date: r.date, energia: r.energy, fadiga: r.fatigue, stress: r.stress }))}
                series={[
                  { key: 'energia', label: 'Energia' },
                  { key: 'fadiga', label: 'Fadiga', color: '#ff6161' },
                  { key: 'stress', label: 'Stress', color: '#ffb84d', dashed: true },
                ]}
                domain={[1, 5]}
                decimals={1}
              />
            </div>
            <p className="num text-xs text-muted">
              Médias (últimos {rec.length} registos): sono {fmt(rec.reduce((a, r) => a + (r.sleepH ?? 0), 0) / Math.max(1, rec.filter((r) => r.sleepH !== undefined).length))} h
            </p>
          </div>
        )}
      </Section>
    </div>
  )
}
