import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronDown, ChevronUp, Download, FileText, History, Plus, Trash2, Trophy, CalendarDays } from 'lucide-react'
import { fmt, round } from '../lib/calc'
import { db } from '../lib/db'
import { addDays, formatDatePT, startOfWeek, todayISO } from '../lib/dates'
import { MUSCLE_LABEL } from '../lib/exercises'
import { addAssessment, updateSettings, upsertBodyLog } from '../lib/repo'
import { downloadFile } from '../lib/files'
import { metricValueText } from '../lib/reports'
import {
  CATEGORY_LABEL,
  FIXED_METRICS,
  PR_METRIC_KEYS,
  STRENGTH_PANEL,
  allExercisePRs,
  allMetricKeys,
  athleticIndex,
  exerciseHistory,
  exerciseSummary,
  metricDefFor,
  perfPointsAll,
  perfRecord,
  sortedBody,
  strengthSeries,
  weekStats,
  weeklyWeightAverages,
  type PerfCategory,
  type Snapshot,
} from '../lib/stats'
import type { BodyLog, ISODate, Photo } from '../lib/types'
import { BarsChart, Spark, TimeChart } from '../components/charts'
import { TimeInput } from '../components/WorkoutEditor'
import { Confirm, Empty, Field, Loading, Notice, NumInput, PageHeader, Section, Segmented, Sheet, Toggle, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'

type Tab = 'resumo' | 'forca' | 'corpo' | 'atletica' | 'recordes'

export default function Progress() {
  const snap = useSnap()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'resumo'
  if (!snap) return <Loading />
  return (
    <div>
      <PageHeader title="Evolução" subtitle="Força, corpo e performance atlética" />
      <Segmented<Tab>
        label="Secções"
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        options={[
          { value: 'resumo', label: 'Resumo', testId: 'tab-resumo' },
          { value: 'forca', label: 'Força', testId: 'tab-forca' },
          { value: 'corpo', label: 'Corpo', testId: 'tab-corpo' },
          { value: 'atletica', label: 'Atlética', testId: 'tab-atletica' },
          { value: 'recordes', label: 'Recordes', testId: 'tab-recordes' },
        ]}
      />
      <div className="mt-4">
        {tab === 'resumo' && <Summary snap={snap} />}
        {tab === 'forca' && <Strength snap={snap} />}
        {tab === 'corpo' && <Body snap={snap} />}
        {tab === 'atletica' && <Athletic snap={snap} />}
        {tab === 'recordes' && <Records snap={snap} />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ resumo

function Summary({ snap }: { snap: Snapshot }) {
  const today = todayISO()
  const weeks = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(today), -7 * (7 - i))), [today])
  const stats = weeks.map((w) => ({ w, s: weekStats(snap, w) }))
  const data = stats.map(({ w, s }) => ({ label: formatDatePT(w).slice(0, 5), volume: Math.round(s.volumeKg), sessoes: s.sessions.length }))
  const cur = stats[7].s
  const prev = stats[6].s
  const groups = [...new Set([...Object.keys(cur.muscle), ...Object.keys(prev.muscle)])] as Array<keyof typeof MUSCLE_LABEL>
  const hasAny = snap.sessions.some((s) => s.status !== 'active')
  return (
    <div>
      {!hasAny && <Empty icon={<FileText size={28} />} title="Ainda sem treinos concluídos" text="Quando terminares o primeiro treino, os gráficos de volume e de séries por grupo muscular aparecem aqui." />}
      {hasAny && (
        <>
          <Section title="Volume semanal (kg)">
            <div className="card p-3">
              <BarsChart data={data} dataKey="volume" label="Volume" unit="kg" />
            </div>
          </Section>
          <Section title="Sessões por semana">
            <div className="card p-3">
              <BarsChart data={data} dataKey="sessoes" label="Sessões" />
            </div>
          </Section>
          <Section title="Séries de trabalho por grupo muscular">
            <div className="card divide-y divide-line">
              <div className="grid grid-cols-[1fr_72px_72px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <span>Grupo</span>
                <span className="text-right">Esta sem.</span>
                <span className="text-right">Anterior</span>
              </div>
              {groups.length === 0 && <p className="p-4 text-sm text-muted">Sem séries de musculação nestas duas semanas.</p>}
              {groups.map((g) => (
                <div key={g} className="grid grid-cols-[1fr_72px_72px] items-center px-4 py-2.5">
                  <span>{MUSCLE_LABEL[g]}</span>
                  <span className="num text-right font-semibold">{cur.muscle[g]?.sets ?? 0}</span>
                  <span className="num text-right text-muted">{prev.muscle[g]?.sets ?? 0}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Comparação entre a semana atual e a anterior (séries de trabalho concluídas, sem aquecimento).</p>
          </Section>
        </>
      )}
      <Section title="Atalhos">
        <div className="grid grid-cols-3 gap-2">
          <Link to="/historico" className="btn-soft flex-col !gap-1 py-3 text-xs">
            <History size={20} /> Histórico
          </Link>
          <Link to="/calendario" className="btn-soft flex-col !gap-1 py-3 text-xs">
            <CalendarDays size={20} /> Calendário
          </Link>
          <Link to="/relatorios" className="btn-soft flex-col !gap-1 py-3 text-xs">
            <FileText size={20} /> Relatórios
          </Link>
        </div>
      </Section>
    </div>
  )
}

// ------------------------------------------------------------------ força

function Strength({ snap }: { snap: Snapshot }) {
  const ids = useMemo(() => {
    const s = new Set<string>()
    snap.sessions.forEach((x) => x.status !== 'active' && x.exercises.forEach((e) => e.logType === 'strength' && e.sets.some((t) => t.done) && s.add(e.exerciseId)))
    return [...s].sort((a, b) => (snap.exMap.get(a)?.namePt ?? a).localeCompare(snap.exMap.get(b)?.namePt ?? b, 'pt'))
  }, [snap])
  const [sel, setSel] = useState<string>('')
  const id = sel || (ids.includes('supino-plano') ? 'supino-plano' : ids[0])
  if (!ids.length) return <Empty icon={<Trophy size={28} />} title="Sem séries de musculação registadas" text="Regista séries com peso e repetições durante um treino para veres a evolução de cada exercício." />
  const def = snap.exMap.get(id)
  const history = exerciseHistory(snap.sessions, id)
  const sum = exerciseSummary(history, def)
  const data = sum.series.map((p) => ({ date: p.date, carga: p.topWeight, e1rm: p.e1rm, volume: p.volume, reps: p.bestReps }))
  const weeklyVol = new Map<ISODate, number>()
  sum.series.forEach((p) => weeklyVol.set(startOfWeek(p.date), (weeklyVol.get(startOfWeek(p.date)) ?? 0) + p.volume))
  const weeklyData = [...weeklyVol.entries()].sort().map(([d, v]) => ({ label: formatDatePT(d).slice(0, 5), volume: Math.round(v) }))
  return (
    <div>
      <select data-testid="strength-select" className="input" value={id} onChange={(e) => setSel(e.target.value)} aria-label="Exercício">
        {ids.map((i) => (
          <option key={i} value={i}>
            {snap.exMap.get(i)?.namePt ?? i}
          </option>
        ))}
      </select>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="card p-3">
          <p className="text-[11px] uppercase text-muted">Maior carga</p>
          <p className="num mt-1 text-xl font-bold text-accent" data-testid="strength-heaviest">
            {sum.heaviest ? `${fmt(sum.heaviest.weightKg, 2)} kg` : '—'}
          </p>
          {sum.heaviest && <p className="text-[11px] text-muted">× {sum.heaviest.reps}</p>}
        </div>
        <div className="card p-3">
          <p className="text-[11px] uppercase text-muted">Sessões</p>
          <p className="num mt-1 text-xl font-bold">{sum.sessionsCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[11px] uppercase text-muted">1RM est.</p>
          <p className="num mt-1 text-xl font-bold">{sum.e1rm ? `${fmt(sum.e1rm.value, 1)}` : '—'}</p>
          <p className="text-[11px] text-muted">{def?.e1rm ? 'estimativa' : 'n/a'}</p>
        </div>
      </div>
      <Section title="Carga máxima por sessão">
        <div className="card p-3" data-testid="strength-chart">
          <TimeChart data={data} series={[{ key: 'carga', label: 'Carga máx. (kg)' }, ...(def?.e1rm ? [{ key: 'e1rm', label: '1RM estimado (kg)', dashed: true }] : [])]} unit="kg" />
        </div>
      </Section>
      <Section title="Volume por sessão">
        <div className="card p-3">
          <TimeChart data={data} series={[{ key: 'volume', label: 'Volume (kg)' }]} unit="kg" decimals={0} area />
        </div>
      </Section>
      <Section title="Volume semanal">
        <div className="card p-3">
          <BarsChart data={weeklyData} dataKey="volume" label="Volume" unit="kg" />
        </div>
      </Section>
      <Link to={`/exercicio/${id}`} className="btn-soft mt-4 w-full">
        Ver técnica, vídeo e relatório do exercício
      </Link>
      <Section title="Principais movimentos">
        <div className="card divide-y divide-line">
          {STRENGTH_PANEL.map((p) => {
            const ser = strengthSeries(snap, p.exerciseId)
            const last = ser[ser.length - 1]
            return (
              <button key={p.exerciseId} onClick={() => setSel(p.exerciseId)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
                <span className="flex-1">{p.label}</span>
                <Spark values={ser.slice(-8).map((x) => x.value)} />
                <span className="num w-20 text-right font-bold">{last ? `${fmt(last.value, 2)} kg` : '—'}</span>
              </button>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

// ------------------------------------------------------------------ corpo

async function resizeImage(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

const MEASURES: Array<{ key: keyof BodyLog; label: string }> = [
  { key: 'waistCm', label: 'Cintura' },
  { key: 'chestCm', label: 'Peito' },
  { key: 'armCm', label: 'Braços' },
  { key: 'thighCm', label: 'Coxas' },
  { key: 'hipCm', label: 'Ancas' },
  { key: 'bodyFatPct', label: 'Gordura (%)' },
]

function Body({ snap }: { snap: Snapshot }) {
  const toast = useToast()
  const [date, setDate] = useState<ISODate>(todayISO())
  const existing = snap.bodyLogs.find((b) => b.date === date)
  const [f, setF] = useState<Partial<BodyLog>>({})
  useEffect(() => {
    setF(existing ? { ...existing } : {})
  }, [date, existing?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const logs = sortedBody(snap.bodyLogs)
  const wl = logs.filter((l) => l.weightKg !== undefined)
  const weekly = weeklyWeightAverages(logs)
  const weekMap = new Map(weekly.map((w) => [w.week, w.avg]))
  const wdata = wl.map((l) => ({ date: l.date, peso: l.weightKg, media: weekMap.get(startOfWeek(l.date)) }))
  const [measure, setMeasure] = useState<keyof BodyLog>('waistCm')
  const mdata = logs.filter((l) => typeof l[measure] === 'number').map((l) => ({ date: l.date, v: l[measure] as number }))
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), [], [] as Photo[])
  const [view, setView] = useState<Photo | null>(null)
  const [delPhoto, setDelPhoto] = useState<Photo | null>(null)

  const save = async () => {
    const vals = { weightKg: f.weightKg, waistCm: f.waistCm, chestCm: f.chestCm, armCm: f.armCm, thighCm: f.thighCm, hipCm: f.hipCm, bodyFatPct: f.bodyFatPct, notes: f.notes }
    if (Object.values(vals).every((v) => v === undefined || v === '')) return toast('Indica pelo menos um valor.', 'error')
    await upsertBodyLog(date, vals)
    toast('Registo corporal guardado.')
  }
  const a = logs.find((l) => l.date === cmpA)
  const b = logs.find((l) => l.date === cmpB)

  return (
    <div>
      <div className="card space-y-3 p-4" data-testid="body-form">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Registar medidas</h2>
          <input type="date" className="input !w-auto !min-h-10" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Data do registo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)">
            <NumInput testId="body-weight" value={f.weightKg} onChange={(v) => setF({ ...f, weightKg: v })} min={20} max={300} placeholder="80,0" aria-label="Peso corporal em kg" />
          </Field>
          <Field label="Cintura (cm)">
            <NumInput value={f.waistCm} onChange={(v) => setF({ ...f, waistCm: v })} min={30} max={250} aria-label="Cintura" />
          </Field>
          <Field label="Peito (cm)">
            <NumInput value={f.chestCm} onChange={(v) => setF({ ...f, chestCm: v })} min={30} max={250} aria-label="Peito" />
          </Field>
          <Field label="Braço (cm)">
            <NumInput value={f.armCm} onChange={(v) => setF({ ...f, armCm: v })} min={10} max={100} aria-label="Braço" />
          </Field>
          <Field label="Coxa (cm)">
            <NumInput value={f.thighCm} onChange={(v) => setF({ ...f, thighCm: v })} min={20} max={150} aria-label="Coxa" />
          </Field>
          <Field label="Ancas (cm)">
            <NumInput value={f.hipCm} onChange={(v) => setF({ ...f, hipCm: v })} min={30} max={250} aria-label="Ancas" />
          </Field>
        </div>
        <Field label="Gordura corporal medida (%)" hint="Só se foi medida (bioimpedância, pregas…). A app não estima gordura corporal.">
          <NumInput value={f.bodyFatPct} onChange={(v) => setF({ ...f, bodyFatPct: v })} max={70} aria-label="Percentagem de gordura corporal" />
        </Field>
        <Field label="Notas">
          <input className="input" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value || undefined })} placeholder="ex.: em jejum, de manhã" aria-label="Notas do registo corporal" />
        </Field>
        <button data-testid="body-save" className="btn-primary w-full" onClick={save}>
          Guardar registo
        </button>
        {existing && <p className="text-xs text-muted">Já existe um registo em {formatDatePT(date)} — será atualizado.</p>}
      </div>

      <Section title="Peso corporal">
        <div className="card p-3" data-testid="weight-chart">
          <TimeChart data={wdata} series={[{ key: 'peso', label: 'Peso (kg)' }, { key: 'media', label: 'Média semanal (kg)', dashed: true, color: '#ffb84d' }]} unit="kg" decimals={1} empty="Regista o teu peso para ver o gráfico." />
        </div>
        {weekly.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Média da semana atual/última: <strong className="num text-ink">{fmt(weekly[weekly.length - 1].avg, 2)} kg</strong> ({weekly[weekly.length - 1].n} registo(s)). Peso inicial definido: {fmt(snap.settings.startWeightKg)} kg. Mais peso não significa, por si só, melhor composição corporal.
          </p>
        )}
      </Section>

      <Section title="Medidas">
        <select className="input" value={measure as string} onChange={(e) => setMeasure(e.target.value as keyof BodyLog)} aria-label="Medida">
          {MEASURES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="card mt-2 p-3">
          <TimeChart data={mdata} series={[{ key: 'v', label: MEASURES.find((m) => m.key === measure)!.label }]} empty="Sem registos desta medida." />
        </div>
      </Section>

      <Section title="Comparar períodos">
        {logs.length < 2 ? (
          <p className="text-sm text-muted">São precisos pelo menos dois registos para comparar.</p>
        ) : (
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Data A">
                <option value="">Data A…</option>
                {logs.map((l) => (
                  <option key={l.date} value={l.date}>
                    {formatDatePT(l.date)}
                  </option>
                ))}
              </select>
              <select className="input" value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Data B">
                <option value="">Data B…</option>
                {logs.map((l) => (
                  <option key={l.date} value={l.date}>
                    {formatDatePT(l.date)}
                  </option>
                ))}
              </select>
            </div>
            {a && b && (
              <table className="num mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 font-medium">Medida</th>
                    <th className="font-medium">{formatDatePT(a.date).slice(0, 5)}</th>
                    <th className="font-medium">{formatDatePT(b.date).slice(0, 5)}</th>
                    <th className="text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {[{ key: 'weightKg' as keyof BodyLog, label: 'Peso (kg)' }, ...MEASURES].map((m) => {
                    const va = a[m.key] as number | undefined
                    const vb = b[m.key] as number | undefined
                    return (
                      <tr key={m.key} className="border-t border-line">
                        <td className="py-2">{m.label}</td>
                        <td>{fmt(va)}</td>
                        <td>{fmt(vb)}</td>
                        <td className="text-right font-semibold">{va !== undefined && vb !== undefined ? `${vb - va > 0 ? '+' : ''}${fmt(round(vb - va, 2), 2)}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Fotografias de progresso"
        right={
          <label className="btn-soft btn-sm cursor-pointer">
            <Camera size={16} /> Adicionar
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const blob = await resizeImage(file)
                await db.photos.add({ id: `photo-${Date.now()}`, date, mime: blob.type || 'image/jpeg', blob, updatedAt: Date.now() })
                toast('Fotografia guardada neste dispositivo.')
              }}
            />
          </label>
        }
      >
        {photos.length === 0 ? (
          <p className="text-sm text-muted">Opcional. As fotografias ficam guardadas apenas neste dispositivo e podem ser incluídas na cópia de segurança.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <PhotoThumb key={p.id} photo={p} onOpen={() => setView(p)} />
            ))}
          </div>
        )}
      </Section>
      <Sheet open={!!view} onClose={() => setView(null)} title={view ? formatDatePT(view.date) : ''}>
        {view && <PhotoFull photo={view} onDelete={() => setDelPhoto(view)} />}
      </Sheet>
      <Confirm
        open={!!delPhoto}
        danger
        title="Apagar fotografia?"
        message="A fotografia será removida deste dispositivo. Não pode ser anulada."
        confirmLabel="Apagar"
        onCancel={() => setDelPhoto(null)}
        onConfirm={async () => {
          if (delPhoto) await db.photos.delete(delPhoto.id)
          setDelPhoto(null)
          setView(null)
        }}
      />
    </div>
  )
}

function useObjectUrl(blob: Blob) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return url
}

function PhotoThumb({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const url = useObjectUrl(photo.blob)
  return (
    <button onClick={onOpen} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface2">
      <img src={url} alt={`Fotografia de ${formatDatePT(photo.date)}`} className="size-full object-cover" />
      <span className="num absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10px] text-white">{formatDatePT(photo.date)}</span>
    </button>
  )
}

function PhotoFull({ photo, onDelete }: { photo: Photo; onDelete: () => void }) {
  const url = useObjectUrl(photo.blob)
  return (
    <div className="space-y-3 pb-2">
      <img src={url} alt={`Fotografia de ${formatDatePT(photo.date)}`} className="max-h-[60dvh] w-full rounded-xl object-contain" />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-soft" onClick={() => downloadFile(`winter-arc-foto-${photo.date}.jpg`, photo.blob)}>
          <Download size={18} /> Exportar
        </button>
        <button className="btn-danger" onClick={onDelete}>
          <Trash2 size={18} /> Apagar
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ atlética

function Athletic({ snap }: { snap: Snapshot }) {
  const pm = useMemo(() => perfPointsAll(snap), [snap])
  const keys = allMetricKeys(snap, pm)
  const cats: PerfCategory[] = ['forca', 'potencia', 'velocidade', 'agilidade', 'resistencia', 'mobilidade']
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const idx = athleticIndex(snap)
  return (
    <div>
      <button data-testid="add-test" className="btn-primary w-full" onClick={() => setAdding(true)}>
        <Plus size={18} /> Registar teste / resultado
      </button>
      <p className="mt-2 text-xs text-muted">Os resultados dos treinos (saltos com altura medida, sprints, agilidade, natação) entram automaticamente. Só se comparam resultados com o mesmo protocolo.</p>

      {cats.map((cat) => {
        const metricKeys = keys.filter((k) => metricDefFor(k)?.category === cat && (cat !== 'mobilidade' || true))
        const strength = cat === 'forca'
        return (
          <Section key={cat} title={CATEGORY_LABEL[cat]}>
            <div className="card divide-y divide-line" data-testid={`cat-${cat}`}>
              {strength &&
                STRENGTH_PANEL.map((p) => {
                  const ser = strengthSeries(snap, p.exerciseId)
                  const last = ser[ser.length - 1]
                  return (
                    <Link key={p.exerciseId} to={`/exercicio/${p.exerciseId}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                      <span className="flex-1">
                        <span className="block font-medium">{p.label}</span>
                        <span className="text-xs text-muted">{last ? `carga máx. · ${formatDatePT(last.date)}` : 'sem registos'}</span>
                      </span>
                      <Spark values={ser.slice(-8).map((x) => x.value)} />
                      <span className="num w-20 text-right font-bold">{last ? `${fmt(last.value, 2)} kg` : '—'}</span>
                    </Link>
                  )
                })}
              {metricKeys.map((k) => {
                const rec = perfRecord(snap, k, pm)!
                const pts = rec.points
                const last = pts[pts.length - 1]
                const isOpen = open === k
                return (
                  <div key={k}>
                    <button className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{rec.def.label}</span>
                        <span className="block truncate text-xs text-muted">{pts.length ? `melhor ${metricValueText(k, rec.current?.value)} · ${pts.length} registo(s)` : 'sem registos'}</span>
                      </span>
                      <Spark values={pts.slice(-8).map((x) => x.value)} />
                      <span className="num w-24 text-right font-bold">{last ? metricValueText(k, last.value) : '—'}</span>
                      {isOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3">
                        <p className="mb-2 text-xs text-muted">Protocolo: {rec.def.protocol}</p>
                        <TimeChart data={pts.map((p) => ({ date: p.date, v: p.value }))} series={[{ key: 'v', label: rec.def.label }]} unit={rec.def.unit} decimals={rec.def.decimals} empty="Sem registos." />
                        <ul className="mt-2 space-y-1 text-sm">
                          {pts.slice().reverse().slice(0, 8).map((p, i) => (
                            <li key={i} className="flex justify-between text-muted">
                              <span>{formatDatePT(p.date)} · {p.source === 'sessao' ? 'treino' : 'teste'}</span>
                              <span className="num font-semibold text-ink">{metricValueText(k, p.value)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
              {!strength && metricKeys.length === 0 && <p className="p-4 text-sm text-muted">Sem métricas registadas nesta categoria.</p>}
            </div>
          </Section>
        )
      })}

      <Section title="Indicador interno (opcional)">
        <div className="card p-4">
          <Toggle checked={snap.settings.scoreEnabled} onChange={(v) => updateSettings({ scoreEnabled: v })} label="Mostrar indicador interno de evolução" hint="Não é uma pontuação científica." />
          {snap.settings.scoreEnabled && (
            <div className="mt-3" data-testid="athletic-index">
              <p className="num text-3xl font-bold text-accent">{idx.overall !== undefined ? `${idx.overall > 0 ? '+' : ''}${fmt(idx.overall)} %` : '—'}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(idx.perCategory).map(([c, v]) => (
                  <li key={c} className="flex justify-between">
                    <span>{CATEGORY_LABEL[c as PerfCategory]}</span>
                    <span className="num font-semibold">{v!.changePct > 0 ? '+' : ''}{fmt(v!.changePct)} % <span className="font-normal text-muted">({v!.metrics} métricas)</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Metodologia: para cada métrica com 2 ou mais registos, a variação percentual do melhor valor face ao primeiro registo (menos tempo = melhor). Cada categoria é a média das suas métricas e o valor geral é a média das categorias com dados. É apenas um indicador da própria app.
              </p>
            </div>
          )}
        </div>
      </Section>

      <AddTest open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

const TEST_CHOICES = [
  ...FIXED_METRICS.filter((m) => m.manual).map((m) => ({ value: m.key, label: m.label })),
  { value: 'sprint-custom', label: 'Sprint (outra distância)' },
  { value: 'agility-custom', label: 'Teste de agilidade (percurso)' },
]

function AddTest({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [metric, setMetric] = useState('vertical-jump')
  const [date, setDate] = useState(todayISO())
  const [value, setValue] = useState<number | undefined>()
  const [dist, setDist] = useState<number | undefined>()
  const [course, setCourse] = useState('')
  const [notes, setNotes] = useState('')
  const timeMetric = metric === 'run-1km'
  const key = metric === 'sprint-custom' ? `sprint-${dist ?? ''}` : metric === 'agility-custom' ? `agility:${course.trim().toLowerCase().replace(/\s+/g, '-')}` : metric
  const def = metricDefFor(key)
  const unit = metric === 'sprint-custom' || metric === 'agility-custom' ? 's' : def?.unit
  const save = async () => {
    if (value === undefined || value <= 0) return toast('Indica um valor válido.', 'error')
    if (metric === 'sprint-custom' && !dist) return toast('Indica a distância do sprint.', 'error')
    if (metric === 'agility-custom' && !course.trim()) return toast('Indica o nome do percurso.', 'error')
    if (metric === 'mobility-squat' && (value < 1 || value > 5)) return toast('Escala de 1 a 5.', 'error')
    await addAssessment({ date, metric: key, value, unit: unit ?? '', protocol: def?.protocol, notes: notes || undefined })
    toast('Resultado guardado.')
    setValue(undefined)
    setNotes('')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Registar teste" footer={<button data-testid="save-test" className="btn-primary w-full" onClick={save}>Guardar resultado</button>}>
      <div className="space-y-3 pb-2">
        <Field label="Teste">
          <select data-testid="test-metric" className="input" value={metric} onChange={(e) => { setMetric(e.target.value); setValue(undefined) }} aria-label="Teste">
            {TEST_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        {metric === 'sprint-custom' && (
          <Field label="Distância (m)">
            <NumInput value={dist} onChange={setDist} decimals={false} aria-label="Distância do sprint" />
          </Field>
        )}
        {metric === 'agility-custom' && (
          <Field label="Percurso" hint="Usa sempre o mesmo nome para o mesmo percurso (ex.: T-test, shuttle 5-10-5).">
            <input className="input" value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Nome do percurso" />
          </Field>
        )}
        <Field label={`Resultado${unit ? ` (${timeMetric ? 'mm:ss' : unit})` : ''}`} hint={def ? `Protocolo: ${def.protocol}` : undefined}>
          {timeMetric ? <TimeInput label="Tempo" value={value} onChange={setValue} placeholder="4:30" /> : <NumInput testId="test-value" value={value} onChange={setValue} aria-label="Resultado" max={metric === 'vertical-jump' ? 150 : 100000} />}
        </Field>
        <Field label="Data">
          <input type="date" className="input" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Data do teste" />
        </Field>
        <Field label="Notas (opcional)">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="método de medição, superfície…" aria-label="Notas do teste" />
        </Field>
        <Notice tone="info">Regista apenas valores medidos. A app não cria recordes a partir de valores estimados.</Notice>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ recordes

function Records({ snap }: { snap: Snapshot }) {
  const pm = useMemo(() => perfPointsAll(snap), [snap])
  const prs = allExercisePRs(snap)
  const keys = [...PR_METRIC_KEYS, ...allMetricKeys(snap, pm).filter((k) => k.startsWith('sprint-') && !PR_METRIC_KEYS.includes(k))]
  return (
    <div>
      <Section title="Performance (valores medidos)">
        <div className="space-y-2" data-testid="perf-prs">
          {keys.map((k) => {
            const rec = perfRecord(snap, k, pm)
            if (!rec) return null
            const cur = rec.current
            const prevEv = rec.history[rec.history.length - 2]
            return (
              <details key={k} className="card p-4">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <Trophy size={18} className={cur ? 'text-accent' : 'text-muted'} />
                  <span className="flex-1">
                    <span className="block font-medium">{rec.def.label}</span>
                    <span className="text-xs text-muted">{cur ? formatDatePT(cur.date) : 'sem registo'}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-lg font-bold">{cur ? metricValueText(k, cur.value) : '—'}</span>
                    {cur && prevEv && <span className="num block text-xs text-accent">anterior {metricValueText(k, prevEv.value)}</span>}
                  </span>
                </summary>
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-1 text-xs text-muted">Histórico de recordes</p>
                  {rec.history.length === 0 && <p className="text-sm text-muted">Ainda sem registos medidos.</p>}
                  <ul className="space-y-1 text-sm">
                    {rec.history.slice().reverse().map((e, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="text-muted">{formatDatePT(e.date)}</span>
                        <span className="num font-semibold">
                          {metricValueText(k, e.value)}
                          {e.previous !== undefined && <span className="ml-2 font-normal text-muted">(antes {metricValueText(k, e.previous)})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )
          })}
        </div>
      </Section>
      <Section title="Musculação">
        {prs.length === 0 ? (
          <Empty icon={<Trophy size={28} />} title="Sem recordes ainda" text="Os recordes de carga, repetições, volume e melhor série aparecem depois de registares treinos." />
        ) : (
          <div className="space-y-2" data-testid="strength-prs">
            {prs.map((p) => (
              <Link key={p.exerciseId} to={`/exercicio/${p.exerciseId}`} className="card block p-4">
                <p className="font-semibold">{p.name}</p>
                <div className="num mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted">Maior carga</span>
                  <span className="text-right font-semibold">{p.summary.heaviest ? `${fmt(p.summary.heaviest.weightKg, 2)} kg × ${p.summary.heaviest.reps}` : '—'}</span>
                  <span className="text-muted">Melhor série</span>
                  <span className="text-right font-semibold">{p.summary.best ? `${fmt(p.summary.best.weightKg, 2)} × ${p.summary.best.reps}` : '—'}</span>
                  <span className="text-muted">Mais repetições</span>
                  <span className="text-right font-semibold">{p.summary.maxReps ? p.summary.maxReps.reps : '—'}</span>
                  <span className="text-muted">Maior volume/sessão</span>
                  <span className="text-right font-semibold">{p.summary.bestSessionVolume ? `${fmt(p.summary.bestSessionVolume.volumeKg, 0)} kg` : '—'}</span>
                  {p.summary.e1rm && (
                    <>
                      <span className="text-muted">1RM estimado</span>
                      <span className="text-right font-semibold">{fmt(p.summary.e1rm.value, 1)} kg (est.)</span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
