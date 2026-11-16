import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Copy, Info, MoreHorizontal, Plus, Repeat, Trash2, Zap } from 'lucide-react'
import { clock, defaultRestFor, doubleProgression, fmt, formatPace, pacePer100, parseTime, makeSet } from '../lib/calc'
import { builtinExercise } from '../lib/exercises'
import { PLYO_LEVELS } from '../lib/program'
import {
  addExercise,
  addSet,
  duplicateSet,
  moveExercise,
  removeExercise,
  removeSet,
  replaceExercise,
  toggleSetDone,
  updateExercise,
  updateSet,
} from '../lib/sessionOps'
import { lastPerformance, type Snapshot } from '../lib/stats'
import type { ExerciseDef, Session, SessionExercise, SetEntry, SetType } from '../lib/types'
import { ExercisePicker } from './ExercisePicker'
import { Confirm, Field, NumInput, Segmented, Sheet, useToast } from './ui'

type Update = (fn: (s: Session) => Session) => void

const SET_TYPES: Array<{ value: SetType; label: string; badge: string }> = [
  { value: 'normal', label: 'Normal', badge: '' },
  { value: 'warmup', label: 'Aquecimento', badge: 'A' },
  { value: 'drop', label: 'Dropset', badge: 'D' },
  { value: 'failure', label: 'Falha', badge: 'F' },
]

// ------------------------------------------------------------------ campo de tempo (mm:ss ou segundos)

export function TimeInput({ value, onChange, placeholder, className = '', label }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string; className?: string; label?: string }) {
  const toText = (v: number | undefined) => (v === undefined ? '' : v >= 60 ? clock(v) : String(v).replace('.', ','))
  const [txt, setTxt] = useState(toText(value))
  const [focus, setFocus] = useState(false)
  const shown = focus ? txt : toText(value)
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={shown}
      className={`input-num ${className}`}
      onFocus={(e) => {
        setTxt(toText(value))
        setFocus(true)
        e.target.select()
      }}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        const raw = e.target.value
        if (!/^[\d:.,]*$/.test(raw)) return
        setTxt(raw)
        if (raw.trim() === '') return onChange(undefined)
        const t = parseTime(raw)
        if (t !== undefined && t <= 36000) onChange(t)
      }}
    />
  )
}

// ------------------------------------------------------------------ série

function prevText(p: SetEntry | undefined, logType: SessionExercise['logType']): string {
  if (!p) return '—'
  if (logType === 'strength') return p.reps ? `${p.weightKg !== undefined ? fmt(p.weightKg, 2) : 'PC'}×${p.reps}` : '—'
  if (logType === 'jump') return p.heightCm ? `${fmt(p.heightCm)}cm` : p.distanceCm ? `${fmt(p.distanceCm, 0)}cm` : p.boxCm ? `cx ${fmt(p.boxCm, 0)}cm` : p.reps ? `${p.reps} reps` : '—'
  if (logType === 'cardio') return p.timeS ? `${Math.round(p.timeS / 60)} min` : '—'
  if (logType === 'sprint') return p.timeS ? `${fmt(p.timeS, 2)}s` : '—'
  if (logType === 'agility') return p.timeS ? `${fmt(p.timeS, 2)}s` : '—'
  return '—'
}

function SetRow({
  ex,
  set,
  index,
  prev,
  def,
  onPatch,
  onToggle,
  onOpen,
  readOnly,
}: {
  ex: SessionExercise
  set: SetEntry
  index: number
  prev: SetEntry | undefined
  def: ExerciseDef | undefined
  onPatch: (p: Partial<SetEntry>) => void
  onToggle: () => void
  onOpen: () => void
  readOnly?: boolean
}) {
  const badge = SET_TYPES.find((t) => t.value === set.type)?.badge
  const lt = ex.logType
  const cols =
    lt === 'strength'
      ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_48px]'
      : lt === 'jump'
        ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_48px]'
        : lt === 'sprint'
          ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_48px]'
          : 'grid-cols-[40px_minmax(0,1fr)_48px]'
  const jumpMetric = def?.metric === 'broad-jump' ? 'distanceCm' : 'heightCm'
  const jumpInput = def?.jumpInput ?? 'height'
  const dim = set.done ? 'opacity-100' : ''
  return (
    <div className={`grid ${cols} items-center gap-1.5 ${dim}`} data-testid="set-row">
      <button
        aria-label={`Série ${index + 1} — opções`}
        onClick={onOpen}
        className={`num flex size-10 items-center justify-center rounded-lg text-sm font-bold ${set.type === 'warmup' ? 'bg-warn/20 text-warn' : set.type === 'normal' ? 'bg-surface2 text-muted' : 'bg-accent-soft text-accent'}`}
      >
        {badge || index + 1}
      </button>

      {lt === 'strength' && (
        <>
          <button
            aria-label="Usar valores da sessão anterior"
            disabled={!prev || readOnly}
            onClick={() => prev && onPatch({ weightKg: prev.weightKg, reps: prev.reps })}
            className="num truncate rounded-lg px-1 py-2 text-center text-sm text-muted active:bg-surface2"
            title="Valores da sessão anterior (toca para copiar)"
          >
            {prevText(prev, lt)}
          </button>
          <NumInput aria-label={`Peso em kg, série ${index + 1}`} testId={`kg-${index}`} value={set.weightKg} onChange={(v) => onPatch({ weightKg: v })} placeholder={ex.plan ? 'kg' : 'kg'} max={600} disabled={readOnly} />
          <NumInput aria-label={`Repetições, série ${index + 1}`} testId={`reps-${index}`} decimals={false} value={set.reps} onChange={(v) => onPatch({ reps: v })} placeholder={ex.plan ? `${ex.plan.repMin === ex.plan.repMax ? ex.plan.repMin : `${ex.plan.repMin}-${ex.plan.repMax}`}` : 'reps'} max={300} disabled={readOnly} />
        </>
      )}

      {lt === 'jump' && (
        <>
          <NumInput aria-label={`Repetições, série ${index + 1}`} testId={`reps-${index}`} decimals={false} value={set.reps} onChange={(v) => onPatch({ reps: v })} placeholder={ex.plan ? String(ex.plan.repMin) : 'reps'} max={50} />
          {jumpInput === 'box' ? (
            <NumInput
              aria-label="Altura da caixa em cm (não é a altura do salto)"
              testId={`box-${index}`}
              value={set.boxCm}
              onChange={(v) => onPatch({ boxCm: v })}
              placeholder="caixa cm"
              max={150}
            />
          ) : jumpInput === 'none' ? (
            <NumInput aria-label="Esforço 1 a 10" testId={`effort-${index}`} decimals={false} value={set.rpe} onChange={(v) => onPatch({ rpe: v })} placeholder="esforço" min={1} max={10} />
          ) : (
            <NumInput
              aria-label={jumpMetric === 'heightCm' ? 'Altura do salto em cm' : 'Distância em cm'}
              testId={`jump-${index}`}
              value={set[jumpMetric]}
              onChange={(v) => onPatch({ [jumpMetric]: v } as Partial<SetEntry>)}
              placeholder={prev && prevText(prev, lt) !== '—' ? prevText(prev, lt) : jumpMetric === 'heightCm' ? 'altura cm' : 'dist. cm'}
              max={jumpMetric === 'heightCm' ? 200 : 800}
            />
          )}
          <NumInput aria-label="Qualidade da aterragem 1 a 5" decimals={false} value={set.landing} onChange={(v) => onPatch({ landing: v })} placeholder="aterr." min={1} max={5} />
        </>
      )}

      {lt === 'cardio' && <TimeInput label="Duração (mm:ss)" value={set.timeS} onChange={(v) => onPatch({ timeS: v })} placeholder="15:00" />}

      {lt === 'sprint' && (
        <>
          <NumInput aria-label="Distância em metros" testId={`dist-${index}`} value={set.distanceM} onChange={(v) => onPatch({ distanceM: v })} placeholder={ex.exerciseId === 'sprint-20m' ? '20' : 'm'} max={100000} />
          <TimeInput label="Tempo em segundos" value={set.timeS} onChange={(v) => onPatch({ timeS: v })} placeholder={prev?.timeS ? `${fmt(prev.timeS, 2)}` : 'tempo s'} />
          <NumInput aria-label="Intensidade 1 a 10" decimals={false} value={set.rpe} onChange={(v) => onPatch({ rpe: v })} placeholder="int." min={1} max={10} />
        </>
      )}

      {lt === 'agility' && <TimeInput label="Tempo em segundos" value={set.timeS} onChange={(v) => onPatch({ timeS: v })} placeholder={prev?.timeS ? `anterior ${fmt(prev.timeS, 2)} s` : 'tempo (s)'} />}

      {(lt === 'checklist' || lt === 'swim') && (
        <button onClick={onToggle} className="min-h-10 truncate rounded-lg px-2 text-left text-sm text-muted">
          {lt === 'swim' ? `Ciclo ${index + 1} (2 min + 1 min descanso)` : ex.plan?.label ?? 'Feito'}
        </button>
      )}

      <button
        aria-label={set.done ? 'Desmarcar série' : 'Marcar série como concluída'}
        aria-pressed={set.done}
        data-testid={`done-${index}`}
        onClick={onToggle}
        className={`flex size-12 items-center justify-center rounded-xl transition active:scale-95 ${set.done ? 'bg-accent text-accent-ink' : 'bg-surface2 text-muted'}`}
      >
        <Check size={24} strokeWidth={3} />
      </button>
    </div>
  )
}

function SetSheet({ ex, set, index, onClose, onPatch, onDuplicate, onRemove }: { ex: SessionExercise; set: SetEntry; index: number; onClose: () => void; onPatch: (p: Partial<SetEntry>) => void; onDuplicate: () => void; onRemove: () => void }) {
  const lt = ex.logType
  return (
    <Sheet open onClose={onClose} title={`${ex.name} · série ${index + 1}`}>
      <div className="space-y-4 pb-2">
        {lt === 'strength' && (
          <Field label="Tipo de série">
            <Segmented value={set.type} options={SET_TYPES.map((t) => ({ value: t.value, label: t.label }))} onChange={(v) => onPatch({ type: v })} label="Tipo de série" />
          </Field>
        )}
        {lt === 'strength' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="RPE (1–10)">
              <NumInput value={set.rpe} onChange={(v) => onPatch({ rpe: v })} min={1} max={10} placeholder="—" aria-label="RPE" />
            </Field>
            <Field label="RIR (0–10)">
              <NumInput value={set.rir} onChange={(v) => onPatch({ rir: v })} min={0} max={10} decimals={false} placeholder="—" aria-label="RIR" />
            </Field>
          </div>
        )}
        {lt === 'jump' && (
          <>
            <Field label="Esforço percebido (1–10)">
              <NumInput value={set.rpe} onChange={(v) => onPatch({ rpe: v })} min={1} max={10} placeholder="—" aria-label="Esforço" />
            </Field>
            <p className="text-xs text-muted">Qualidade da aterragem: 1 = rígida/instável, 5 = silenciosa e estável.</p>
          </>
        )}
        {lt === 'sprint' && (
          <Field label="Descanso desta repetição (s)">
            <NumInput value={set.restS} onChange={(v) => onPatch({ restS: v })} decimals={false} placeholder="s" aria-label="Descanso" />
          </Field>
        )}
        {lt === 'agility' && (
          <Field label="Esforço percebido (1–10)">
            <NumInput value={set.rpe} onChange={(v) => onPatch({ rpe: v })} min={1} max={10} placeholder="—" aria-label="Esforço" />
          </Field>
        )}
        {lt === 'swim' && (
          <Field label="Distância deste ciclo (m)">
            <NumInput value={set.distanceM} onChange={(v) => onPatch({ distanceM: v })} placeholder="m" aria-label="Distância do ciclo" />
          </Field>
        )}
        <Field label="Notas da série">
          <input className="input" value={set.notes ?? ''} onChange={(e) => onPatch({ notes: e.target.value || undefined })} placeholder="opcional" aria-label="Notas da série" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-soft" onClick={() => { onDuplicate(); onClose() }}>
            <Copy size={18} /> Duplicar
          </button>
          <button className="btn-danger" onClick={() => { onRemove(); onClose() }}>
            <Trash2 size={18} /> Remover
          </button>
        </div>
        <button className="btn-primary w-full" onClick={onClose}>
          Concluído
        </button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ natação

function SwimForm({ session, update }: { session: Session; update: Update }) {
  const w = session.swim ?? {}
  const set = (p: Partial<NonNullable<Session['swim']>>) => update((s) => ({ ...s, swim: { ...(s.swim ?? {}), ...p } }))
  const pace = pacePer100(w.distanceM, w.effectiveSec ?? w.totalSec)
  const suggested = w.pool && w.laps ? w.pool * w.laps : undefined
  return (
    <div className="card mt-3 space-y-3 p-4" data-testid="swim-form">
      <h3 className="font-semibold">Registo de natação</h3>
      <Field label="Piscina">
        <Segmented value={w.pool ?? 0} options={[{ value: 25, label: '25 m' }, { value: 50, label: '50 m' }]} onChange={(v) => set({ pool: v as 25 | 50 })} label="Piscina" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nº de piscinas">
          <NumInput value={w.laps} onChange={(v) => set({ laps: v })} decimals={false} placeholder="—" aria-label="Número de piscinas" testId="swim-laps" />
        </Field>
        <Field label="Distância (m)">
          <NumInput value={w.distanceM} onChange={(v) => set({ distanceM: v })} decimals={false} placeholder="—" aria-label="Distância em metros" testId="swim-dist" max={20000} />
        </Field>
      </div>
      {suggested !== undefined && w.distanceM !== suggested && (
        <button className="btn-soft btn-sm" onClick={() => set({ distanceM: suggested })}>
          Usar {suggested} m ({w.laps} × {w.pool} m)
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tempo total (mm:ss)">
          <TimeInput label="Tempo total" value={w.totalSec} onChange={(v) => set({ totalSec: v })} placeholder="30:00" />
        </Field>
        <Field label="Tempo a nadar (mm:ss)">
          <TimeInput label="Tempo efetivo" value={w.effectiveSec} onChange={(v) => set({ effectiveSec: v })} placeholder="10:00" />
        </Field>
      </div>
      <p className="num text-sm text-muted">
        Ritmo médio: <span className="font-semibold text-ink">{formatPace(pace)}</span>
        {pace ? (w.effectiveSec ? ' (tempo efetivo)' : ' (tempo total)') : ' — indica distância e tempo'}
      </p>
      <Field label="Estilo">
        <select className="input" value={w.stroke ?? ''} onChange={(e) => set({ stroke: e.target.value || undefined })} aria-label="Estilo de natação">
          <option value="">—</option>
          {['Crol', 'Costas', 'Bruços', 'Mariposa', 'Misto'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pausas (nº)">
          <NumInput value={w.restsCount} onChange={(v) => set({ restsCount: v })} decimals={false} placeholder="—" aria-label="Número de pausas" />
        </Field>
        <Field label="Esforço (1–10)">
          <NumInput value={w.rpe} onChange={(v) => set({ rpe: v })} min={1} max={10} placeholder="—" aria-label="Perceção de esforço" />
        </Field>
      </div>
      <Field label="Notas da natação">
        <input className="input" value={w.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="opcional" aria-label="Notas da natação" />
      </Field>
    </div>
  )
}

// ------------------------------------------------------------------ cartão de exercício

function ExerciseCard({
  ex,
  position,
  total,
  session,
  snap,
  update,
  readOnly,
  onPickReplace,
}: {
  ex: SessionExercise
  position: number
  total: number
  session: Session
  snap: Snapshot
  update: Update
  readOnly?: boolean
  onPickReplace: (exId: string) => void
}) {
  const toast = useToast()
  const def = snap.exMap.get(ex.exerciseId) ?? builtinExercise(ex.exerciseId)
  const prev = lastPerformance(snap.sessions, ex.exerciseId, session)
  const [menu, setMenu] = useState(false)
  const [setIdx, setSetIdx] = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const prevSets = prev?.ex.sets.filter((s) => s.done) ?? []
  const sug = def?.logType === 'strength' && ex.plan && prev ? doubleProgression(prev.ex.sets, ex.plan, def.incrementKg ?? 2.5) : undefined
  const plyoLevel = snap.settings.program.plyoLevel

  const toggle = (setId: string) => {
    const s = ex.sets.find((x) => x.id === setId)!
    if (!s.done) {
      let msg: string | null = null
      if (ex.logType === 'strength' && s.reps === undefined) msg = 'Indica as repetições antes de concluir a série.'
      if (ex.logType === 'jump' && s.reps === undefined) msg = 'Indica o número de repetições do salto.'
      if (ex.logType === 'sprint' && (s.timeS === undefined || s.distanceM === undefined)) msg = 'Indica a distância e o tempo do sprint.'
      if (ex.logType === 'agility' && s.timeS === undefined) msg = 'Indica o tempo.'
      if (ex.logType === 'cardio' && s.timeS === undefined) msg = 'Indica a duração (ou ignora o cardio, é opcional).'
      if (msg) return toast(msg, 'error')
    }
    update((x) => (readOnly ? updateSet(x, ex.id, setId, { done: !s.done, doneAt: !s.done ? Date.now() : undefined }) : toggleSetDone(x, ex.id, setId)))
  }

  const planText =
    ex.logType === 'strength' && ex.plan
      ? `${ex.plan.sets} × ${ex.plan.repMin === ex.plan.repMax ? ex.plan.repMin : `${ex.plan.repMin}–${ex.plan.repMax}`}`
      : ex.plan?.label ?? undefined
  const doneCount = ex.sets.filter((s) => s.done).length
  const openSet = setIdx !== null ? ex.sets[setIdx] : undefined

  return (
    <div className="card p-3" data-testid="exercise-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link to={`/exercicio/${ex.exerciseId}`} data-testid="exercise-link" className="block truncate text-lg font-bold leading-tight text-accent active:opacity-70">
            {ex.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted">
            {ex.optional && <span className="mr-1 rounded bg-surface2 px-1.5 py-0.5 font-semibold" data-testid="optional-chip">Opcional</span>}
            {planText && <span>{planText} · </span>}
            {ex.restSec > 0 && <span>descanso {clock(ex.restSec)} · </span>}
            <span className="num">
              {doneCount}/{ex.sets.length} feitas
            </span>
          </p>
        </div>
        <Link to={`/exercicio/${ex.exerciseId}`} aria-label="Ver técnica e vídeo" className="flex size-10 items-center justify-center rounded-xl text-muted active:bg-surface2">
          <Info size={20} />
        </Link>
        <button aria-label="Mais opções do exercício" data-testid="exercise-menu" onClick={() => setMenu(true)} className="flex size-10 items-center justify-center rounded-xl text-muted active:bg-surface2">
          <MoreHorizontal size={22} />
        </button>
      </div>

      {ex.phaseNote && <p className="mt-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">{ex.phaseNote}</p>}
      {ex.logType === 'jump' && !readOnly && <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted"><Zap size={12} className="mr-1 inline" />{PLYO_LEVELS[plyoLevel].name}: {PLYO_LEVELS[plyoLevel].guidance}</p>}
      {ex.logType === 'sprint' && snap.settings.program.startDate && (session.phase ?? 1) === 1 && !readOnly && (
        <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">Intensidade submáxima (~70–80%). Recupera totalmente entre repetições.</p>
      )}

      {sug && sug.kind !== 'none' && !readOnly && (
        <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${sug.kind === 'increase' ? 'bg-accent-soft text-accent' : 'bg-surface2 text-muted'}`} data-testid="suggestion">
          <span className="flex-1">
            <strong className="font-semibold">Sugestão:</strong> {sug.message}
          </span>
          {sug.kind === 'increase' && sug.weightKg && (
            <button
              className="shrink-0 rounded-md bg-accent px-2 py-1 font-semibold text-accent-ink"
              onClick={() => update((s) => updateExercise(s, ex.id, { sets: ex.sets.map((x) => (!x.done && x.weightKg === undefined && x.type !== 'warmup' ? { ...x, weightKg: sug.weightKg } : x)) }))}
            >
              Aplicar
            </button>
          )}
        </div>
      )}

      {(ex.logType === 'sprint' || ex.logType === 'agility') && (
        <div className="mt-2">
          <input
            className="input !min-h-10 text-sm"
            placeholder={ex.logType === 'sprint' ? 'Superfície (ex.: relva, pista)' : 'Percurso (ex.: shuttle 5 m, T-test)'}
            value={(ex.logType === 'sprint' ? ex.surface : ex.course) ?? ''}
            onChange={(e) => update((s) => updateExercise(s, ex.id, ex.logType === 'sprint' ? { surface: e.target.value } : { course: e.target.value }))}
            aria-label={ex.logType === 'sprint' ? 'Superfície' : 'Percurso'}
          />
          {ex.logType === 'agility' && <p className="mt-1 text-[11px] text-muted">Usa sempre o mesmo nome de percurso para comparar resultados (protocolos diferentes não são comparáveis).</p>}
        </div>
      )}

      {ex.logType === 'cardio' && (
        <div className="mt-3 grid grid-cols-[40px_minmax(0,1fr)_48px] items-end gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          <span className="text-center">#</span>
          <span className="text-center">Duração</span>
          <span />
        </div>
      )}

      {ex.logType !== 'checklist' && ex.logType !== 'swim' && ex.logType !== 'cardio' && (
        <div
          className={`mt-3 grid items-end gap-1.5 px-0 text-[10px] font-semibold uppercase tracking-wide text-muted ${
            ex.logType === 'strength'
              ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_48px]'
              : ex.logType === 'jump'
                ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_48px]'
                : ex.logType === 'sprint'
                  ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_48px]'
                  : 'grid-cols-[40px_minmax(0,1fr)_48px]'
          }`}
        >
          <span className="text-center">#</span>
          {ex.logType === 'strength' && (
            <>
              <span className="text-center">Anterior</span>
              <span className="text-center">kg</span>
              <span className="text-center">Reps</span>
            </>
          )}
          {ex.logType === 'jump' && (
            <>
              <span className="text-center">Reps</span>
              <span className="text-center">{def?.jumpInput === 'box' ? 'Caixa cm' : def?.jumpInput === 'none' ? 'Esforço' : def?.metric === 'broad-jump' ? 'Dist. cm' : 'Altura salto'}</span>
              <span className="text-center">Aterr.</span>
            </>
          )}
          {ex.logType === 'sprint' && (
            <>
              <span className="text-center">Dist. m</span>
              <span className="text-center">Tempo s</span>
              <span className="text-center">Int.</span>
            </>
          )}
          {ex.logType === 'agility' && <span className="text-center">Tempo (s)</span>}
          <span />
        </div>
      )}

      <div className="mt-2 space-y-2">
        {ex.sets.map((s, i) => (
          <SetRow
            key={s.id}
            ex={ex}
            set={s}
            index={i}
            prev={prevSets[i]}
            def={def}
            readOnly={readOnly}
            onPatch={(p) => update((x) => updateSet(x, ex.id, s.id, p))}
            onToggle={() => toggle(s.id)}
            onOpen={() => setSetIdx(i)}
          />
        ))}
      </div>

      {ex.logType !== 'swim' && (
        <button className="btn-soft btn-sm mt-3 w-full" data-testid="add-set" onClick={() => update((x) => addSet(x, ex.id))}>
          <Plus size={16} /> Adicionar série
        </button>
      )}

      {ex.notes && <p className="mt-2 text-xs text-muted">Nota: {ex.notes}</p>}

      {openSet && setIdx !== null && (
        <SetSheet
          ex={ex}
          set={openSet}
          index={setIdx}
          onClose={() => setSetIdx(null)}
          onPatch={(p) => update((x) => updateSet(x, ex.id, openSet.id, p))}
          onDuplicate={() => update((x) => duplicateSet(x, ex.id, openSet.id))}
          onRemove={() => update((x) => removeSet(x, ex.id, openSet.id))}
        />
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={ex.name}>
        <div className="space-y-3 pb-2">
          <Field label="Descanso entre séries (segundos)">
            <NumInput value={ex.restSec} onChange={(v) => update((s) => updateExercise(s, ex.id, { restSec: v ?? 0 }))} decimals={false} max={900} aria-label="Descanso em segundos" />
          </Field>
          <Field label="Notas do exercício">
            <input className="input" value={ex.notes ?? ''} onChange={(e) => update((s) => updateExercise(s, ex.id, { notes: e.target.value || undefined }))} placeholder="ex.: dor ligeira no ombro" aria-label="Notas do exercício" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-soft" disabled={position === 0} onClick={() => update((s) => moveExercise(s, ex.id, -1))}>
              <ArrowUp size={18} /> Subir
            </button>
            <button className="btn-soft" disabled={position === total - 1} onClick={() => update((s) => moveExercise(s, ex.id, 1))}>
              <ArrowDown size={18} /> Descer
            </button>
          </div>
          <button className="btn-soft w-full" onClick={() => { setMenu(false); onPickReplace(ex.id) }}>
            <Repeat size={18} /> Substituir exercício
          </button>
          <button className="btn-danger w-full" onClick={() => { setMenu(false); setConfirmDel(true) }}>
            <Trash2 size={18} /> Remover da sessão
          </button>
          <button className="btn-primary w-full" onClick={() => setMenu(false)}>
            Concluído
          </button>
        </div>
      </Sheet>
      <Confirm
        open={confirmDel}
        danger
        title="Remover exercício?"
        message={`“${ex.name}” e as séries registadas nesta sessão serão removidos desta sessão. O resto do histórico não é afetado.`}
        confirmLabel="Remover"
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          update((s) => removeExercise(s, ex.id))
          setConfirmDel(false)
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ editor

export function WorkoutEditor({ session, update, snap, readOnly }: { session: Session; update: Update; snap: Snapshot; readOnly?: boolean }) {
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; exId: string } | null>(null)
  const settings = snap.settings
  const onPick = (d: ExerciseDef) => {
    if (!picker) return
    if (picker.mode === 'add') update((s) => addExercise(s, d, defaultRestFor(d, settings.restCompoundSec, settings.restIsolationSec)))
    else update((s) => replaceExercise(s, picker.exId, d))
    setPicker(null)
  }
  return (
    <div className="space-y-3">
      {session.exercises.length === 0 && <p className="card p-6 text-center text-sm text-muted">Sem exercícios. Adiciona o primeiro para começares a registar.</p>}
      {session.exercises.map((ex, i) => (
        <div key={ex.id}>
          <ExerciseCard ex={ex} position={i} total={session.exercises.length} session={session} snap={snap} update={update} readOnly={readOnly} onPickReplace={(exId) => setPicker({ mode: 'replace', exId })} />
          {ex.logType === 'swim' && <SwimForm session={session} update={update} />}
        </div>
      ))}
      <button className="btn-ghost w-full" data-testid="add-exercise" onClick={() => setPicker({ mode: 'add' })}>
        <Plus size={20} /> Adicionar exercício
      </button>
      {!session.exercises.some((e) => e.logType === 'swim') && session.kind === 'swim' && <SwimForm session={session} update={update} />}
      <ExercisePicker open={!!picker} onClose={() => setPicker(null)} onPick={onPick} snap={snap} title={picker?.mode === 'replace' ? 'Substituir por…' : 'Adicionar exercício'} />
    </div>
  )
}

export { makeSet }
