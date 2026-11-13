import { useMemo, useState } from 'react'
import { Plus, Search, Star } from 'lucide-react'
import { db } from '../lib/db'
import { uid } from '../lib/calc'
import { LOGTYPE_LABEL, MUSCLE_GROUPS, MUSCLE_LABEL, exerciseMatches } from '../lib/exercises'
import type { Snapshot } from '../lib/stats'
import type { ExerciseDef, LogType, MuscleGroup } from '../lib/types'
import { Field, Sheet, useToast } from './ui'

export function ExercisePicker({
  open,
  onClose,
  onPick,
  snap,
  title = 'Adicionar exercício',
}: {
  open: boolean
  onClose: () => void
  onPick: (d: ExerciseDef) => void
  snap: Snapshot
  title?: string
}) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'todos'>('todos')
  const [creating, setCreating] = useState(false)
  const favs = useMemo(() => new Set(snap.exerciseMeta.filter((m) => m.favorite).map((m) => m.id)), [snap.exerciseMeta])
  const list = useMemo(() => {
    return [...snap.exMap.values()]
      .filter((e) => exerciseMatches(e, q) && (muscle === 'todos' || e.primary === muscle))
      .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.namePt.localeCompare(b.namePt, 'pt'))
  }, [snap.exMap, q, muscle, favs])

  return (
    <Sheet open={open} onClose={onClose} title={creating ? 'Novo exercício' : title}>
      {creating ? (
        <CreateExercise
          onCancel={() => setCreating(false)}
          onCreated={(d) => {
            setCreating(false)
            onPick(d)
          }}
        />
      ) : (
        <>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" placeholder="Pesquisar exercício…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar exercício" />
          </div>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {(['todos', ...MUSCLE_GROUPS] as const).map((m) => (
              <button key={m} onClick={() => setMuscle(m)} className={`chip shrink-0 !px-3 !py-2 ${muscle === m ? '!bg-accent !text-accent-ink' : ''}`}>
                {m === 'todos' ? 'Todos' : MUSCLE_LABEL[m]}
              </button>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {list.map((e) => (
              <li key={e.id}>
                <button data-testid={`pick-${e.id}`} onClick={() => onPick(e)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.namePt}</span>
                    <span className="block truncate text-xs text-muted">
                      {MUSCLE_LABEL[e.primary]} · {LOGTYPE_LABEL[e.logType]}
                      {e.custom ? ' · personalizado' : ''}
                    </span>
                  </span>
                  {favs.has(e.id) && <Star size={16} className="fill-accent text-accent" />}
                  <Plus size={18} className="text-accent" />
                </button>
              </li>
            ))}
            {!list.length && <li className="py-6 text-center text-sm text-muted">Nenhum exercício encontrado.</li>}
          </ul>
          <button className="btn-ghost mt-3 w-full" onClick={() => setCreating(true)}>
            <Plus size={18} /> Criar exercício personalizado
          </button>
        </>
      )}
    </Sheet>
  )
}

export function CreateExercise({ onCancel, onCreated }: { onCancel: () => void; onCreated: (d: ExerciseDef) => void }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup>('peito')
  const [logType, setLogType] = useState<LogType>('strength')
  const [equipment, setEquipment] = useState('')
  const toast = useToast()
  const save = async () => {
    if (!name.trim()) return toast('Indica o nome do exercício.', 'error')
    const d: ExerciseDef = {
      id: uid('custom'),
      namePt: name.trim(),
      nameEn: name.trim(),
      logType,
      primary: muscle,
      secondary: [],
      equipment: equipment.trim() || 'Não especificado',
      goal: 'Exercício personalizado.',
      restSec: 90,
      instructions: ['Exercício criado por ti. Adiciona notas na página do exercício.'],
      technique: [],
      mistakes: [],
      safety: [],
      alternatives: [],
      videoQuery: `${name.trim()} técnica`,
      custom: true,
      e1rm: logType === 'strength' ? false : undefined,
      updatedAt: Date.now(),
    }
    await db.customExercises.put(d)
    toast('Exercício criado.')
    onCreated(d)
  }
  return (
    <div className="space-y-3 pb-2">
      <Field label="Nome">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Supino com pausa" aria-label="Nome do exercício" />
      </Field>
      <Field label="Grupo muscular principal">
        <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)} aria-label="Grupo muscular">
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABEL[m]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo de registo">
        <select className="input" value={logType} onChange={(e) => setLogType(e.target.value as LogType)} aria-label="Tipo de registo">
          {(['strength', 'jump', 'sprint', 'agility', 'checklist'] as LogType[]).map((t) => (
            <option key={t} value={t}>
              {LOGTYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Equipamento (opcional)">
        <input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-1">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Voltar
        </button>
        <button className="btn-primary flex-1" onClick={save}>
          Criar
        </button>
      </div>
    </div>
  )
}
