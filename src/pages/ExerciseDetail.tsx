import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ExternalLink, ImageOff, Star, Video } from 'lucide-react'
import { clock, doubleProgression, fmt } from '../lib/calc'
import { formatDatePT } from '../lib/dates'
import { LOGTYPE_LABEL, MUSCLE_LABEL, videoSearchUrl } from '../lib/exercises'
import { setExerciseMeta } from '../lib/repo'
import { PLYO_LEVELS } from '../lib/program'
import { buildExerciseReport, setText } from '../lib/reports'
import { exerciseHistory, exerciseSummary, perfRecord, metricDefFor } from '../lib/stats'
import { metricValueText } from '../lib/reports'
import { TimeChart } from '../components/charts'
import { ReportActions } from '../components/ReportActions'
import { Loading, Notice, PageHeader, Section, Stat, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted">—</p>
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`space-y-2 pl-5 text-[15px] ${ordered ? 'list-decimal' : 'list-disc'} marker:text-accent`}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </Tag>
  )
}

function validUrl(u: string): boolean {
  try {
    const x = new URL(u)
    return x.protocol === 'https:' || x.protocol === 'http:'
  } catch {
    return false
  }
}

export default function ExerciseDetail() {
  const { id = '' } = useParams()
  const snap = useSnap()
  const toast = useToast()
  const [videoInput, setVideoInput] = useState('')
  const def = snap?.exMap.get(id)
  const meta = snap?.exerciseMeta.find((m) => m.id === id)
  const history = useMemo(() => (snap ? exerciseHistory(snap.sessions, id) : []), [snap, id])
  const summary = useMemo(() => exerciseSummary(history, def), [history, def])
  if (!snap) return <Loading />
  if (!def)
    return (
      <>
        <PageHeader title="Exercício" back />
        <Notice tone="warn" title="Exercício não encontrado" />
      </>
    )
  const inPlan = snap.templates.filter((t) => !t.archived && t.exercises.some((e) => e.exerciseId === id)).map((t) => ({ t, e: t.exercises.find((e) => e.exerciseId === id)! }))
  const last = summary.last
  const lastPrev = history.length > 1 ? history[history.length - 2] : undefined
  const planEx = inPlan[0]?.e
  const sug = def.logType === 'strength' && last && planEx ? doubleProgression(last.ex.sets, { sets: planEx.sets, repMin: planEx.repMin, repMax: planEx.repMax }, def.incrementKg ?? 2.5) : undefined
  const chartData = summary.series.map((p) => ({ date: p.date, carga: p.topWeight, e1rm: p.e1rm, volume: p.volume }))
  const perf = def.metric ? perfRecord(snap, def.metric) : undefined
  const videoUrl = meta?.videoUrl && validUrl(meta.videoUrl) ? meta.videoUrl : undefined
  const searchUrl = videoSearchUrl(def.videoQuery)
  void lastPrev

  return (
    <div>
      <PageHeader
        title={def.namePt}
        subtitle={def.nameEn}
        back
        right={
          <button
            aria-label={meta?.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            aria-pressed={!!meta?.favorite}
            className="flex size-11 items-center justify-center rounded-xl bg-surface2"
            onClick={() => setExerciseMeta(id, { favorite: !meta?.favorite })}
          >
            <Star size={22} className={meta?.favorite ? 'fill-accent text-accent' : 'text-muted'} />
          </button>
        }
      />

      <div className="flex flex-wrap gap-2" data-testid="exercise-chips">
        <span className="chip-accent">{MUSCLE_LABEL[def.primary]}</span>
        {def.secondary.map((m) => (
          <span key={m} className="chip">
            {MUSCLE_LABEL[m]}
          </span>
        ))}
        <span className="chip">{LOGTYPE_LABEL[def.logType]}</span>
      </div>

      <div className="card mt-4 space-y-3 p-4">
        <div>
          <p className="label">Objetivo</p>
          <p>{def.goal}</p>
        </div>
        <div>
          <p className="label">Equipamento</p>
          <p>{def.equipment}</p>
        </div>
        {inPlan.length > 0 && (
          <div>
            <p className="label">No teu plano</p>
            <ul className="space-y-1 text-sm">
              {inPlan.map(({ t, e }) => (
                <li key={t.id} data-testid="plan-line">
                  <Link to={`/treinos/${t.id}`} className="font-medium text-accent">
                    {t.name}
                  </Link>
                  : {def.logType === 'strength' ? `${e.sets} × ${e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}` : e.label ?? `${e.sets} séries`}
                  {e.restSec > 0 && ` · descanso ${clock(e.restSec)}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {inPlan.length === 0 && def.restSec > 0 && (
          <p className="text-sm text-muted">Descanso sugerido: {clock(def.restSec)}</p>
        )}
      </div>

      {/* Vídeo e imagem */}
      <Section title="Vídeo e imagem">
        <div className="card space-y-3 p-4">
          {videoUrl && (
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
              <Video size={18} /> Abrir o meu vídeo <ExternalLink size={14} />
            </a>
          )}
          <a data-testid="video-search" href={searchUrl} target="_blank" rel="noopener noreferrer" className="btn-soft w-full">
            <Video size={18} /> Pesquisar demonstração no YouTube <ExternalLink size={14} />
          </a>
          <p className="text-xs text-muted">
            Isto é uma <strong className="text-ink">ligação de pesquisa</strong> — não um vídeo verificado. Escolhe um vídeo de uma fonte em que confies e guarda o endereço abaixo para ficar associado a este exercício. Requer ligação à internet; o resto da página funciona offline.
          </p>
          <div className="flex gap-2">
            <input className="input" placeholder="Colar endereço de vídeo (https://…)" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} aria-label="Endereço do vídeo" />
            <button
              className="btn-soft shrink-0"
              onClick={async () => {
                if (!validUrl(videoInput)) return toast('Endereço inválido. Tem de começar por https://', 'error')
                await setExerciseMeta(id, { videoUrl: videoInput.trim() })
                setVideoInput('')
                toast('Vídeo associado.')
              }}
            >
              Guardar
            </button>
          </div>
          {meta?.videoUrl && (
            <button className="text-xs text-muted underline" onClick={() => setExerciseMeta(id, { videoUrl: undefined })}>
              Remover o meu vídeo
            </button>
          )}
          <p className="flex items-center gap-2 text-xs text-muted">
            <ImageOff size={14} /> Sem imagem demonstrativa verificada incluída para este exercício (para não mostrar imagens erradas).
          </p>
        </div>
      </Section>

      <Section title="Instruções passo a passo">
        <div className="card p-4">
          <List items={def.instructions} ordered />
        </div>
      </Section>
      {def.plyo && (
        <Section title="Técnica de pliometria">
          <div className="card space-y-3 p-4" data-testid="plyo-guide">
            {[
              ['Posição inicial', def.plyo.start],
              ['Movimento dos braços', def.plyo.arms],
              ['Impulsão', def.plyo.takeoff],
              ['Aterragem', def.plyo.landing],
              ['Posição dos joelhos', def.plyo.knees],
              ['Controlo do tronco', def.plyo.trunk],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="label">{k}</p>
                <p className="text-[15px]">{v}</p>
              </div>
            ))}
            <div>
              <p className="label flex items-center gap-1">
                <AlertTriangle size={12} /> Como reconhecer uma execução incorreta
              </p>
              <List items={def.plyo.badExecution} />
            </div>
            <p className="rounded-xl bg-surface2 p-3 text-xs text-muted">
              Nível atual de pliometria: <strong className="text-ink">{PLYO_LEVELS[snap.settings.program.plyoLevel].name}</strong>. {PLYO_LEVELS[snap.settings.program.plyoLevel].guidance} A intensidade só aumenta quando tu confirmares em <Link to="/programa" className="text-accent">Programa</Link>.
            </p>
          </div>
        </Section>
      )}
      <Section title="Técnica correta">
        <div className="card p-4">
          <List items={def.technique} />
        </div>
      </Section>
      <Section title="Erros comuns">
        <div className="card p-4">
          <List items={def.mistakes} />
        </div>
      </Section>
      <Section title="Cuidados de segurança">
        <div className="card border-warn/30 p-4">
          <List items={def.safety} />
        </div>
      </Section>
      <Section title="Alternativas">
        <div className="card p-4">
          <List items={def.alternatives} />
        </div>
      </Section>

      {/* Histórico pessoal */}
      <Section title="O teu histórico">
        {!history.length ? (
          <div className="card p-4 text-sm text-muted">Ainda não registaste este exercício. Quando o fizeres numa sessão, a evolução aparece aqui.</div>
        ) : (
          <>
            {def.logType === 'strength' && (
              <div className="grid grid-cols-2 gap-2" data-testid="exercise-stats">
                <Stat label="Última sessão" value={last ? formatDatePT(last.session.date) : '—'} sub={last ? `${last.ex.sets.filter((s) => s.done).length} séries` : undefined} />
                <Stat label="Melhor carga" value={summary.heaviest ? `${fmt(summary.heaviest.weightKg, 2)} kg` : '—'} sub={summary.heaviest ? `× ${summary.heaviest.reps} · ${formatDatePT(summary.heaviest.date)}` : undefined} accent />
                <Stat label="Mais repetições" value={summary.maxReps ? `${summary.maxReps.reps}` : '—'} sub={summary.maxReps?.weightKg ? `com ${fmt(summary.maxReps.weightKg, 2)} kg` : undefined} />
                <Stat label="Melhor série" value={summary.best ? `${fmt(summary.best.weightKg, 2)}×${summary.best.reps}` : '—'} sub={summary.best ? `${fmt(summary.best.volumeKg, 0)} kg de volume` : undefined} />
                {def.e1rm && (
                  <div className="card col-span-2 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">1RM estimado (estimativa)</p>
                    <p className="num mt-1 text-2xl font-bold">{summary.e1rm ? `${fmt(summary.e1rm.value, 1)} kg` : '—'}</p>
                    <p className="mt-1 text-xs text-muted">Fórmula de Epley a partir de séries de 1–10 repetições. É uma estimativa, não um teste máximo.</p>
                  </div>
                )}
              </div>
            )}
            {sug && sug.kind !== 'none' && (
              <div className="mt-3">
                <Notice tone="info" title="Sugestão de progressão dupla (não aplicada automaticamente)">
                  {sug.message}
                </Notice>
              </div>
            )}
            {def.logType === 'strength' && (
              <div className="card mt-3 p-3">
                <p className="mb-2 text-sm font-semibold">Evolução da carga máxima e do 1RM estimado</p>
                <TimeChart data={chartData} series={[{ key: 'carga', label: 'Carga máx. (kg)' }, ...(def.e1rm ? [{ key: 'e1rm', label: '1RM estimado (kg)', dashed: true }] : [])]} unit="kg" />
              </div>
            )}
            {def.logType === 'strength' && (
              <div className="card mt-3 p-3">
                <p className="mb-2 text-sm font-semibold">Volume por sessão (kg)</p>
                <TimeChart data={chartData} series={[{ key: 'volume', label: 'Volume (kg)' }]} unit="kg" decimals={0} area />
              </div>
            )}
            {perf && perf.current && (
              <div className="card mt-3 p-4">
                <p className="label">Melhor resultado medido ({metricDefFor(perf.def.key)?.label})</p>
                <p className="num text-2xl font-bold text-accent">{metricValueText(perf.def.key, perf.current.value)}</p>
                <p className="text-xs text-muted">em {formatDatePT(perf.current.date)}</p>
              </div>
            )}
            <div className="card mt-3 divide-y divide-line">
              {history
                .slice()
                .reverse()
                .slice(0, 15)
                .map(({ session, ex }) => (
                  <Link key={session.id} to={`/sessao/${session.id}`} className="block px-4 py-3">
                    <p className="text-sm font-semibold">
                      {formatDatePT(session.date)} <span className="font-normal text-muted">· {session.name}</span>
                    </p>
                    <p className="num mt-0.5 text-sm text-muted">
                      {ex.sets
                        .filter((s) => s.done)
                        .map((s) => setText(s, ex).split(' | ')[0])
                        .join('  ·  ')}
                    </p>
                  </Link>
                ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Notas pessoais">
        <textarea
          className="input min-h-24 py-3"
          placeholder="Ajustes de banco, pega, dor, sensações…"
          value={meta?.notes ?? ''}
          onChange={(e) => setExerciseMeta(id, { notes: e.target.value || undefined })}
          aria-label="Notas pessoais do exercício"
        />
      </Section>

      <Section title="Relatório do exercício">
        <ReportActions text={buildExerciseReport(snap, id)} filename={`winter-arc-exercicio-${id}.txt`} />
      </Section>
    </div>
  )
}
