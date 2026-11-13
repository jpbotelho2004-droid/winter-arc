import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { uid } from '../lib/calc'
import { db } from '../lib/db'
import { WEEKDAYS_LONG } from '../lib/dates'
import { defaultRestFor } from '../lib/calc'
import { archiveTemplate, duplicateTemplate, resetOfficialPlan, saveTemplate } from '../lib/repo'
import type { ExerciseDef, SessionKind, TemplateExercise, WorkoutTemplate } from '../lib/types'
import { ExercisePicker } from '../components/ExercisePicker'
import { Confirm, Field, Loading, NumInput, PageHeader, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'

export default function TemplateEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const snap = useSnap()
  const [t, setT] = useState<WorkoutTemplate | null | undefined>(undefined)
  const [picker, setPicker] = useState(false)
  const [del, setDel] = useState(false)
  const [reset, setReset] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (id === 'novo') {
        const nt: WorkoutTemplate = { id: uid('tpl'), name: 'Novo treino', kind: 'custom', exercises: [], updatedAt: Date.now() }
        await db.templates.put(nt)
        if (alive) nav(`/treinos/${nt.id}`, { replace: true })
        return
      }
      const found = await db.templates.get(id)
      if (alive) setT(found ?? null)
    })()
    return () => {
      alive = false
    }
  }, [id, nav])

  if (!snap || t === undefined) return <Loading />
  if (t === null) return <PageHeader title="Treino não encontrado" back />

  const save = (next: WorkoutTemplate) => {
    setT(next)
    void saveTemplate(next)
  }
  const patchEx = (exId: string, p: Partial<TemplateExercise>) => save({ ...t, exercises: t.exercises.map((e) => (e.id === exId ? { ...e, ...p } : e)) })
  const move = (i: number, d: -1 | 1) => {
    const arr = t.exercises.slice()
    const j = i + d
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    save({ ...t, exercises: arr })
  }
  const add = (d: ExerciseDef) => {
    const strength = d.logType === 'strength'
    const ex: TemplateExercise = {
      id: uid('te'),
      exerciseId: d.id,
      sets: strength ? 3 : d.logType === 'checklist' ? 1 : 3,
      repMin: strength ? 8 : 1,
      repMax: strength ? 12 : 1,
      restSec: defaultRestFor(d, snap.settings.restCompoundSec, snap.settings.restIsolationSec),
    }
    save({ ...t, exercises: [...t.exercises, ex] })
    setPicker(false)
  }

  return (
    <div>
      <PageHeader title="Editar treino" subtitle="As alterações não afetam o histórico de sessões anteriores" back />

      <div className="space-y-3">
        <Field label="Nome">
          <input data-testid="tpl-name" className="input" value={t.name} onChange={(e) => save({ ...t, name: e.target.value })} aria-label="Nome do treino" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia da semana">
            <select
              data-testid="tpl-weekday"
              className="input"
              value={t.weekday ?? ''}
              onChange={(e) => save({ ...t, weekday: e.target.value ? Number(e.target.value) : undefined })}
              aria-label="Dia da semana"
            >
              <option value="">Sem dia fixo</option>
              {WEEKDAYS_LONG.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo">
            <select className="input" value={t.kind} onChange={(e) => save({ ...t, kind: e.target.value as SessionKind })} aria-label="Tipo de treino">
              <option value="strength">Musculação</option>
              <option value="power">Potência + força</option>
              <option value="speed">Velocidade / agilidade</option>
              <option value="swim">Natação</option>
              <option value="rest">Descanso</option>
              <option value="custom">Personalizado</option>
            </select>
          </Field>
        </div>
        <Field label="Descrição / duração (opcional)">
          <input className="input" value={t.durationLabel ?? ''} onChange={(e) => save({ ...t, durationLabel: e.target.value || undefined })} placeholder="ex.: 60–70 min" aria-label="Duração" />
        </Field>
      </div>

      <h2 className="h-section">Exercícios ({t.exercises.length})</h2>
      <div className="space-y-3">
        {t.exercises.map((e, i) => {
          const def = snap.exMap.get(e.exerciseId)
          const strength = (def?.logType ?? 'strength') === 'strength'
          return (
            <div key={e.id} className="card p-3" data-testid="tpl-exercise">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-semibold">{def?.namePt ?? e.exerciseId}</p>
                <button aria-label="Subir" className="flex size-10 items-center justify-center rounded-lg bg-surface2 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={18} />
                </button>
                <button aria-label="Descer" className="flex size-10 items-center justify-center rounded-lg bg-surface2 disabled:opacity-30" disabled={i === t.exercises.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={18} />
                </button>
                <button aria-label="Remover exercício" className="flex size-10 items-center justify-center rounded-lg bg-danger/15 text-danger" onClick={() => save({ ...t, exercises: t.exercises.filter((x) => x.id !== e.id) })}>
                  <Trash2 size={18} />
                </button>
              </div>
              <div className={`mt-3 grid gap-2 ${strength ? 'grid-cols-4' : 'grid-cols-2'}`}>
                <Field label="Séries">
                  <NumInput value={e.sets} onChange={(v) => patchEx(e.id, { sets: v ?? 1 })} decimals={false} min={1} max={20} aria-label="Séries" />
                </Field>
                {strength && (
                  <>
                    <Field label="Reps mín.">
                      <NumInput value={e.repMin} onChange={(v) => patchEx(e.id, { repMin: v ?? 1, repMax: Math.max(v ?? 1, e.repMax) })} decimals={false} min={1} max={100} aria-label="Repetições mínimas" />
                    </Field>
                    <Field label="Reps máx.">
                      <NumInput value={e.repMax} onChange={(v) => patchEx(e.id, { repMax: Math.max(v ?? 1, e.repMin) })} decimals={false} min={1} max={100} aria-label="Repetições máximas" />
                    </Field>
                  </>
                )}
                <Field label="Descanso (s)">
                  <NumInput value={e.restSec} onChange={(v) => patchEx(e.id, { restSec: v ?? 0 })} decimals={false} max={900} aria-label="Descanso em segundos" />
                </Field>
              </div>
              {!strength && (
                <input className="input mt-2 !min-h-10 text-sm" placeholder="Descrição (ex.: 4–6 × 10–20 m)" value={e.label ?? ''} onChange={(ev) => patchEx(e.id, { label: ev.target.value || undefined })} aria-label="Descrição" />
              )}
            </div>
          )
        })}
        <button className="btn-ghost w-full" data-testid="tpl-add" onClick={() => setPicker(true)}>
          <Plus size={20} /> Adicionar exercício
        </button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2">
        <button
          className="btn-soft"
          onClick={async () => {
            const c = await duplicateTemplate(t.id)
            if (c) {
              toast('Treino duplicado.')
              nav(`/treinos/${c.id}`)
            }
          }}
        >
          <Copy size={18} /> Duplicar
        </button>
        <button className="btn-danger" onClick={() => setDel(true)}>
          <Trash2 size={18} /> Remover do plano
        </button>
      </div>
      {t.id.startsWith('tpl-') && !t.id.startsWith('tpl-' + 'x') && (
        <button className="btn-ghost mt-3 w-full" onClick={() => setReset(true)}>
          Repor plano oficial
        </button>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={add} snap={snap} />
      <Confirm
        open={del}
        danger
        title="Remover este treino do plano?"
        message="O treino deixa de aparecer no calendário e nas listas. O histórico de sessões já realizadas mantém-se intacto."
        confirmLabel="Remover do plano"
        onCancel={() => setDel(false)}
        onConfirm={async () => {
          await archiveTemplate(t.id)
          toast('Treino removido do plano.')
          nav('/treinar', { replace: true })
        }}
      />
      <Confirm
        open={reset}
        title="Repor o plano oficial?"
        message="Os 7 treinos oficiais voltam à configuração original (exercícios, séries e dias). Treinos personalizados e todo o histórico são mantidos."
        confirmLabel="Repor plano"
        onCancel={() => setReset(false)}
        onConfirm={async () => {
          await resetOfficialPlan()
          setReset(false)
          toast('Plano oficial reposto.')
          const found = await db.templates.get(t.id)
          if (found) setT(found)
        }}
      />
    </div>
  )
}
