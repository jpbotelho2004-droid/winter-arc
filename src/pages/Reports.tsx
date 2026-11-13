import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { endOfWeek, formatDatePT, startOfWeek, todayISO } from '../lib/dates'
import { downloadFile } from '../lib/files'
import { buildDailyReport, buildExerciseReport, buildJsonReport, buildMonthlyReport, buildPerformanceReport, buildWeeklyReport } from '../lib/reports'
import { Field, Loading, Notice, PageHeader, Segmented, useToast } from '../components/ui'
import { ReportActions } from '../components/ReportActions'
import { useSnap } from '../hooks/hooks'

type Tipo = 'diario' | 'semanal' | 'mensal' | 'exercicio' | 'performance'

export default function Reports() {
  const snap = useSnap()
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const tipo = (params.get('tipo') as Tipo) || 'semanal'
  const today = todayISO()
  const data = params.get('data') || today
  const exId = params.get('ex') || 'supino-plano'
  const [showText, setShowText] = useState(true)
  const set = (p: Record<string, string>) => setParams({ tipo, data, ex: exId, ...p }, { replace: true })

  const exIds = useMemo(() => {
    if (!snap) return []
    const s = new Set<string>()
    snap.sessions.forEach((x) => x.status !== 'active' && x.exercises.forEach((e) => e.sets.some((t) => t.done) && s.add(e.exerciseId)))
    return [...s].sort((a, b) => (snap.exMap.get(a)?.namePt ?? a).localeCompare(snap.exMap.get(b)?.namePt ?? b, 'pt'))
  }, [snap])

  const built = useMemo(() => {
    if (!snap) return { text: '', file: '', from: today, to: today }
    switch (tipo) {
      case 'diario':
        return { text: buildDailyReport(snap, data), file: `winter-arc-diario-${data}.txt`, from: data, to: data }
      case 'mensal':
        return { text: buildMonthlyReport(snap, data.slice(0, 7)), file: `winter-arc-mensal-${data.slice(0, 7)}.txt`, from: `${data.slice(0, 7)}-01`, to: `${data.slice(0, 7)}-31` }
      case 'exercicio':
        return { text: buildExerciseReport(snap, exId), file: `winter-arc-exercicio-${exId}.txt`, from: '2000-01-01', to: today }
      case 'performance':
        return { text: buildPerformanceReport(snap), file: `winter-arc-performance-${today}.txt`, from: '2000-01-01', to: today }
      default:
        return { text: buildWeeklyReport(snap, data), file: `winter-arc-semanal-${startOfWeek(data)}.txt`, from: startOfWeek(data), to: endOfWeek(data) }
    }
  }, [snap, tipo, data, exId, today])

  if (!snap) return <Loading />
  const hasData = snap.sessions.some((s) => s.status !== 'active')

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Texto pronto para colar no ChatGPT" back />
      <Segmented<Tipo>
        label="Tipo de relatório"
        value={tipo}
        onChange={(v) => set({ tipo: v })}
        options={[
          { value: 'diario', label: 'Diário', testId: 'rep-diario' },
          { value: 'semanal', label: 'Semanal', testId: 'rep-semanal' },
          { value: 'mensal', label: 'Mensal', testId: 'rep-mensal' },
          { value: 'exercicio', label: 'Exercício', testId: 'rep-exercicio' },
          { value: 'performance', label: 'Performance', testId: 'rep-performance' },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-3">
        {(tipo === 'diario' || tipo === 'semanal' || tipo === 'mensal') && (
          <Field label={tipo === 'semanal' ? `Semana que inclui (${formatDatePT(startOfWeek(data))} – ${formatDatePT(endOfWeek(data))})` : tipo === 'mensal' ? `Mês (${data.slice(0, 7)})` : 'Dia'}>
            <input type="date" className="input" value={data} max={today} onChange={(e) => e.target.value && set({ data: e.target.value })} aria-label="Data do relatório" />
          </Field>
        )}
        {tipo === 'exercicio' && (
          <Field label="Exercício">
            {exIds.length ? (
              <select className="input" value={exId} onChange={(e) => set({ ex: e.target.value })} aria-label="Exercício">
                {exIds.map((i) => (
                  <option key={i} value={i}>
                    {snap.exMap.get(i)?.namePt ?? i}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted">Ainda não há exercícios registados.</p>
            )}
          </Field>
        )}
      </div>

      {!hasData && (
        <div className="mt-4">
          <Notice tone="info">Ainda não há treinos terminados. O relatório mostra “sem registo” onde não existem dados — nunca zeros inventados.</Notice>
        </div>
      )}

      <div className="mt-4">
        <ReportActions
          text={built.text}
          filename={built.file}
          extra={
            <button
              data-testid="export-json"
              className="btn-ghost col-span-2"
              onClick={() => {
                const j = buildJsonReport(snap, built.from, built.to > today ? today : built.to)
                downloadFile(built.file.replace('.txt', '.json'), JSON.stringify(j, null, 2), 'application/json')
                toast('Relatório JSON exportado (não é uma cópia de segurança).')
              }}
            >
              <Download size={18} /> Exportar relatório em JSON
            </button>
          }
        />
        <p className="mt-2 text-xs text-muted">O relatório JSON tem o esquema documentado em docs/RELATORIO-JSON.md e <strong>não</strong> substitui a cópia de segurança completa.</p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Pré-visualização</h2>
        <button className="text-sm text-accent" onClick={() => setShowText(!showText)}>
          {showText ? 'Esconder' : 'Mostrar'}
        </button>
      </div>
      {showText && (
        <pre data-testid="report-preview" className="card mt-2 max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
          {built.text}
        </pre>
      )}
      <p className="mt-3 text-xs text-muted">Nada é enviado para servidores: o texto fica na área de transferência e és tu que o colas no ChatGPT.</p>
    </div>
  )
}
