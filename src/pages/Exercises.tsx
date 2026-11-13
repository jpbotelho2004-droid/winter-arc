import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Star } from 'lucide-react'
import { LOGTYPE_LABEL, MUSCLE_GROUPS, MUSCLE_LABEL, exerciseMatches } from '../lib/exercises'
import type { MuscleGroup } from '../lib/types'
import { CreateExercise } from '../components/ExercisePicker'
import { Loading, PageHeader, Sheet } from '../components/ui'
import { useSnap } from '../hooks/hooks'

export default function Exercises() {
  const snap = useSnap()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'todos'>('todos')
  const [onlyFav, setOnlyFav] = useState(false)
  const [creating, setCreating] = useState(false)
  const favs = useMemo(() => new Set(snap?.exerciseMeta.filter((m) => m.favorite).map((m) => m.id)), [snap?.exerciseMeta])
  const list = useMemo(
    () =>
      snap
        ? [...snap.exMap.values()]
            .filter((e) => exerciseMatches(e, q) && (muscle === 'todos' || e.primary === muscle) && (!onlyFav || favs.has(e.id)))
            .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.namePt.localeCompare(b.namePt, 'pt'))
        : [],
    [snap, q, muscle, onlyFav, favs],
  )
  if (!snap) return <Loading />
  return (
    <div>
      <PageHeader title="Exercícios" subtitle={`${snap.exMap.size} na biblioteca`} back right={<button aria-label="Criar exercício" className="btn-soft !px-3" onClick={() => setCreating(true)}><Plus size={20} /></button>} />
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input data-testid="exercise-search" className="input pl-10" placeholder="Pesquisar por nome, músculo ou equipamento" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar exercícios" />
      </div>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <button onClick={() => setOnlyFav(!onlyFav)} className={`chip shrink-0 !px-3 !py-2 ${onlyFav ? '!bg-accent !text-accent-ink' : ''}`}>
          <Star size={13} /> Favoritos
        </button>
        {(['todos', ...MUSCLE_GROUPS] as const).map((m) => (
          <button key={m} onClick={() => setMuscle(m)} className={`chip shrink-0 !px-3 !py-2 ${muscle === m ? '!bg-accent !text-accent-ink' : ''}`}>
            {m === 'todos' ? 'Todos' : MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>
      <ul className="card mt-4 divide-y divide-line">
        {list.map((e) => (
          <li key={e.id}>
            <Link to={`/exercicio/${e.id}`} data-testid={`ex-${e.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.namePt}</span>
                <span className="block truncate text-xs text-muted">
                  {e.nameEn} · {MUSCLE_LABEL[e.primary]} · {LOGTYPE_LABEL[e.logType]}
                </span>
              </span>
              {favs.has(e.id) && <Star size={16} className="fill-accent text-accent" />}
            </Link>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-sm text-muted">Nenhum exercício encontrado.</li>}
      </ul>
      <Sheet open={creating} onClose={() => setCreating(false)} title="Novo exercício">
        <CreateExercise onCancel={() => setCreating(false)} onCreated={(d) => { setCreating(false); nav(`/exercicio/${d.id}`) }} />
      </Sheet>
    </div>
  )
}
