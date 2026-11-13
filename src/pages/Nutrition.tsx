import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Droplets, Plus, Save, Trash2 } from 'lucide-react'
import { fmt, round } from '../lib/calc'
import { db } from '../lib/db'
import { addDays, endOfWeek, formatDatePT, formatLong, startOfWeek, todayISO } from '../lib/dates'
import { addMeal, saveFood, saveMealTemplate, upsertDayLog } from '../lib/repo'
import { mealsOn, nutritionAverages, nutritionConsistency, totalsOf, type Snapshot } from '../lib/stats'
import type { Food, ISODate, MealEntry, MealSlot } from '../lib/types'
import { Confirm, Empty, Field, Loading, Notice, NumInput, PageHeader, Progress, Section, Segmented, Sheet, Toggle, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'

const SLOTS: Array<{ id: MealSlot; label: string }> = [
  { id: 'pequeno-almoco', label: 'Pequeno-almoço' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
  { id: 'pre-treino', label: 'Pré-treino' },
  { id: 'pos-treino', label: 'Pós-treino' },
  { id: 'ceia', label: 'Ceia' },
]

type Tab = 'hoje' | 'alimentos' | 'historico'

export default function Nutrition() {
  const snap = useSnap()
  const [tab, setTab] = useState<Tab>('hoje')
  if (!snap) return <Loading />
  return (
    <div>
      <PageHeader title="Nutrição" subtitle="Valores introduzidos por ti — sem base de dados externa" />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        label="Secções"
        options={[
          { value: 'hoje', label: 'Diário', testId: 'nut-tab-hoje' },
          { value: 'alimentos', label: 'Alimentos', testId: 'nut-tab-alimentos' },
          { value: 'historico', label: 'Histórico', testId: 'nut-tab-historico' },
        ]}
      />
      <div className="mt-4">
        {tab === 'hoje' && <Day snap={snap} />}
        {tab === 'alimentos' && <Foods snap={snap} />}
        {tab === 'historico' && <NutHistory snap={snap} />}
      </div>
    </div>
  )
}

function MacroBar({ label, value, goal, unit }: { label: string; value: number; goal: number; unit: string }) {
  const over = goal > 0 && value > goal * 1.1
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="num">
          <strong>{fmt(value, 0)}</strong> / {fmt(goal, 0)} {unit}
        </span>
      </div>
      <Progress value={value} max={goal || 1} tone={over ? 'warn' : 'accent'} />
    </div>
  )
}

function Day({ snap }: { snap: Snapshot }) {
  const toast = useToast()
  const [date, setDate] = useState<ISODate>(todayISO())
  const [adding, setAdding] = useState<MealSlot | null>(null)
  const [delMeal, setDelMeal] = useState<MealEntry | null>(null)
  const meals = mealsOn(snap.meals, date)
  const tot = totalsOf(meals)
  const g = snap.settings.nutrition
  const day = snap.dayLogs.find((d) => d.date === date)
  const water = day?.waterMl ?? 0
  const supps = snap.settings.supplements.filter((s) => s.enabled)
  const kcalPct = g.kcal ? Math.round((tot.kcal / g.kcal) * 100) : 0

  return (
    <div>
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

      <div className="card mt-4 p-4" data-testid="nut-summary">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Calorias</p>
            <p className="num text-4xl font-bold">
              <span data-testid="kcal-total">{fmt(tot.kcal, 0)}</span> <span className="text-lg font-medium text-muted">/ {g.kcal} kcal</span>
            </p>
          </div>
          <p className={`num text-2xl font-bold ${kcalPct > 110 ? 'text-warn' : 'text-accent'}`}>{meals.length ? `${kcalPct}%` : '—'}</p>
        </div>
        <div className="mt-4 space-y-3">
          <MacroBar label="Proteína" value={tot.protein} goal={g.protein} unit="g" />
          <MacroBar label="Hidratos de carbono" value={tot.carbs} goal={g.carbs} unit="g" />
          <MacroBar label="Gordura" value={tot.fat} goal={g.fat} unit="g" />
        </div>
        <p className="mt-3 text-[11px] text-muted">Objetivos iniciais configuráveis em Definições — são um ponto de partida, não uma prescrição.</p>
      </div>

      <Section title="Refeições">
        <div className="space-y-3">
          {SLOTS.map((s) => {
            const items = meals.filter((m) => m.slot === s.id)
            if (!items.length && !['pequeno-almoco', 'almoco', 'lanche', 'jantar'].includes(s.id)) return null
            const t = totalsOf(items)
            return (
              <div key={s.id} className="card p-3" data-testid={`slot-${s.id}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{s.label}</p>
                  <span className="num text-sm text-muted">{items.length ? `${fmt(t.kcal, 0)} kcal` : ''}</span>
                </div>
                {items.map((m) => (
                  <div key={m.id} className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="num text-xs text-muted">
                        {fmt(m.kcal, 0)} kcal · P {fmt(m.protein, 0)} · H {fmt(m.carbs, 0)} · G {fmt(m.fat, 0)}
                      </span>
                    </span>
                    <button aria-label={`Apagar ${m.name}`} className="flex size-10 items-center justify-center rounded-lg text-muted active:bg-surface2" onClick={() => setDelMeal(m)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <button className="btn-soft btn-sm flex-1" data-testid={`add-${s.id}`} onClick={() => setAdding(s.id)}>
                    <Plus size={16} /> Adicionar
                  </button>
                  {items.length > 1 && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        await saveMealTemplate(`${s.label} (${formatDatePT(date).slice(0, 5)})`, items.map(({ name, kcal, protein, carbs, fat }) => ({ name, kcal, protein, carbs, fat })))
                        toast('Guardada como refeição frequente.')
                      }}
                    >
                      <Save size={15} /> Guardar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {!meals.length && <p className="mt-3 text-center text-sm text-muted">Sem alimentação registada neste dia.</p>}
      </Section>

      <Section title="Hidratação">
        <div className="card p-4" data-testid="water-card">
          <div className="flex items-center gap-3">
            <Droplets className="text-accent" />
            <p className="num text-2xl font-bold" data-testid="water-total">
              {fmt(water / 1000, 2)} L
            </p>
            {snap.settings.waterGoalMl ? <span className="text-sm text-muted">/ {fmt(snap.settings.waterGoalMl / 1000, 2)} L</span> : null}
          </div>
          {snap.settings.waterGoalMl ? (
            <div className="mt-2">
              <Progress value={water} max={snap.settings.waterGoalMl} />
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[250, 500, 750].map((ml) => (
              <button key={ml} className="btn-soft btn-sm" onClick={() => upsertDayLog(date, { waterMl: water + ml })}>
                +{ml}
              </button>
            ))}
            <button className="btn-ghost btn-sm" disabled={!water} onClick={() => upsertDayLog(date, { waterMl: Math.max(0, water - 250) })}>
              −250
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">Valores em mL. Registo opcional.</p>
        </div>
      </Section>

      {supps.length > 0 && (
        <Section title="Suplementos">
          <div className="card divide-y divide-line px-4">
            {supps.map((s) => (
              <Toggle
                key={s.id}
                label={s.name}
                hint={s.dose}
                checked={!!day?.supplements?.[s.id]}
                onChange={(v) => upsertDayLog(date, { supplements: { ...(day?.supplements ?? {}), [s.id]: v } })}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">A app não recomenda suplementos nem doses. A creatina vem com 3–5 g/dia apenas como referência inicial editável.</p>
        </Section>
      )}

      <AddMealSheet slot={adding} date={date} snap={snap} onClose={() => setAdding(null)} />
      <Confirm
        open={!!delMeal}
        danger
        title="Apagar este registo?"
        message={delMeal ? `${delMeal.name} (${fmt(delMeal.kcal, 0)} kcal) será removido deste dia.` : ''}
        confirmLabel="Apagar"
        onCancel={() => setDelMeal(null)}
        onConfirm={async () => {
          if (delMeal) await db.meals.delete(delMeal.id)
          setDelMeal(null)
        }}
      />
    </div>
  )
}

function AddMealSheet({ slot, date, snap, onClose }: { slot: MealSlot | null; date: ISODate; snap: Snapshot; onClose: () => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<'manual' | 'food' | 'saved'>('manual')
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number | undefined>()
  const [p, setP] = useState<number | undefined>()
  const [c, setC] = useState<number | undefined>()
  const [f, setF] = useState<number | undefined>()
  const [saveAs, setSaveAs] = useState(false)
  const [foodId, setFoodId] = useState('')
  const [qty, setQty] = useState<number | undefined>(100)
  const food = snap.foods.find((x) => x.id === foodId)
  const k = food ? (food.basis === '100g' ? (qty ?? 0) / 100 : qty ?? 0) : 0
  const reset = () => {
    setName('')
    setKcal(undefined)
    setP(undefined)
    setC(undefined)
    setF(undefined)
    setSaveAs(false)
    setFoodId('')
  }
  const add = async (m: Omit<MealEntry, 'id' | 'updatedAt'>) => {
    await addMeal(m)
  }
  if (!slot) return null
  return (
    <Sheet open onClose={onClose} title={`Adicionar a ${SLOTS.find((s) => s.id === slot)?.label}`}>
      <Segmented value={mode} onChange={setMode} label="Origem" options={[{ value: 'manual', label: 'Manual', testId: 'meal-manual' }, { value: 'food', label: 'Os meus alimentos' }, { value: 'saved', label: 'Frequentes' }]} />
      <div className="mt-4 space-y-3 pb-2">
        {mode === 'manual' && (
          <>
            <Field label="Descrição">
              <input data-testid="meal-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Frango com arroz" aria-label="Descrição da refeição" />
            </Field>
            <Field label="Calorias (kcal)">
              <NumInput testId="meal-kcal" value={kcal} onChange={setKcal} max={10000} aria-label="Calorias" placeholder="0" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Proteína g">
                <NumInput testId="meal-p" value={p} onChange={setP} max={1000} aria-label="Proteína" />
              </Field>
              <Field label="Hidratos g">
                <NumInput value={c} onChange={setC} max={2000} aria-label="Hidratos" />
              </Field>
              <Field label="Gordura g">
                <NumInput value={f} onChange={setF} max={1000} aria-label="Gordura" />
              </Field>
            </div>
            <p className="text-[11px] text-muted">Introduz os valores do rótulo ou de uma fonte fiável. Campos vazios contam como 0 g nos totais.</p>
            <Toggle checked={saveAs} onChange={setSaveAs} label="Guardar como alimento personalizado" />
            <button
              data-testid="meal-save"
              className="btn-primary w-full"
              onClick={async () => {
                if (kcal === undefined) return toast('Indica as calorias.', 'error')
                const nm = name.trim() || 'Refeição'
                await add({ date, slot, name: nm, kcal, protein: p ?? 0, carbs: c ?? 0, fat: f ?? 0 })
                if (saveAs) await saveFood({ name: nm, basis: 'unit', unitLabel: 'porção', kcal, protein: p ?? 0, carbs: c ?? 0, fat: f ?? 0, source: 'introduzido pelo utilizador' })
                toast('Registado.')
                reset()
                onClose()
              }}
            >
              Adicionar
            </button>
          </>
        )}
        {mode === 'food' &&
          (snap.foods.length === 0 ? (
            <Empty title="Sem alimentos personalizados" text="Cria alimentos no separador Alimentos ou guarda uma refeição manual como alimento." />
          ) : (
            <>
              <Field label="Alimento">
                <select className="input" value={foodId} onChange={(e) => setFoodId(e.target.value)} aria-label="Alimento">
                  <option value="">Escolher…</option>
                  {snap.foods.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.basis === '100g' ? 'por 100 g' : `por ${x.unitLabel ?? 'unidade'}`})
                    </option>
                  ))}
                </select>
              </Field>
              {food && (
                <>
                  <Field label={food.basis === '100g' ? 'Quantidade (g)' : `Quantidade (${food.unitLabel ?? 'unidades'})`}>
                    <NumInput value={qty} onChange={setQty} max={5000} aria-label="Quantidade" />
                  </Field>
                  <p className="num text-sm text-muted">
                    = {fmt(food.kcal * k, 0)} kcal · P {fmt(food.protein * k, 0)} · H {fmt(food.carbs * k, 0)} · G {fmt(food.fat * k, 0)}
                  </p>
                  <button
                    className="btn-primary w-full"
                    onClick={async () => {
                      if (!qty) return toast('Indica a quantidade.', 'error')
                      await add({ date, slot, name: `${food.name} (${fmt(qty, 1)}${food.basis === '100g' ? ' g' : ''})`, kcal: round(food.kcal * k, 1), protein: round(food.protein * k, 1), carbs: round(food.carbs * k, 1), fat: round(food.fat * k, 1), quantity: qty, foodId: food.id })
                      toast('Registado.')
                      onClose()
                    }}
                  >
                    Adicionar
                  </button>
                </>
              )}
            </>
          ))}
        {mode === 'saved' &&
          (snap.savedMeals.length === 0 ? (
            <Empty title="Sem refeições frequentes" text="Numa refeição com 2 ou mais itens, usa “Guardar” para a reutilizar." />
          ) : (
            <ul className="divide-y divide-line">
              {snap.savedMeals.map((m) => {
                const t = totalsOf(m.items)
                return (
                  <li key={m.id}>
                    <button
                      className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                      onClick={async () => {
                        for (const it of m.items) await add({ date, slot, name: it.name, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat })
                        toast(`${m.items.length} item(ns) adicionados.`)
                        onClose()
                      }}
                    >
                      <span className="flex-1">
                        <span className="block font-medium">{m.name}</span>
                        <span className="num text-xs text-muted">
                          {m.items.length} itens · {fmt(t.kcal, 0)} kcal
                        </span>
                      </span>
                      <Plus size={18} className="text-accent" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ))}
      </div>
    </Sheet>
  )
}

function Foods({ snap }: { snap: Snapshot }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [basis, setBasis] = useState<Food['basis']>('100g')
  const [unit, setUnit] = useState('')
  const [kcal, setKcal] = useState<number | undefined>()
  const [p, setP] = useState<number | undefined>()
  const [c, setC] = useState<number | undefined>()
  const [f, setF] = useState<number | undefined>()
  const [source, setSource] = useState('')
  return (
    <div>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Novo alimento</h2>
        <Field label="Nome">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do alimento" />
        </Field>
        <Field label="Valores referentes a">
          <Segmented value={basis} onChange={setBasis} options={[{ value: '100g', label: '100 g' }, { value: 'unit', label: 'Unidade / porção' }]} label="Base dos valores" />
        </Field>
        {basis === 'unit' && (
          <Field label="Nome da unidade">
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ex.: ovo, scoop, fatia" aria-label="Unidade" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="kcal">
            <NumInput value={kcal} onChange={setKcal} max={10000} aria-label="kcal" />
          </Field>
          <Field label="Proteína g">
            <NumInput value={p} onChange={setP} max={1000} aria-label="Proteína" />
          </Field>
          <Field label="Hidratos g">
            <NumInput value={c} onChange={setC} max={1000} aria-label="Hidratos" />
          </Field>
          <Field label="Gordura g">
            <NumInput value={f} onChange={setF} max={1000} aria-label="Gordura" />
          </Field>
        </div>
        <Field label="Fonte (opcional)" hint="Ex.: rótulo da embalagem, tabela oficial. Não inventes valores.">
          <input className="input" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Fonte" />
        </Field>
        <button
          className="btn-primary w-full"
          onClick={async () => {
            if (!name.trim() || kcal === undefined) return toast('Indica o nome e as calorias.', 'error')
            await saveFood({ name: name.trim(), basis, unitLabel: basis === 'unit' ? unit.trim() || 'unidade' : undefined, kcal, protein: p ?? 0, carbs: c ?? 0, fat: f ?? 0, source: source.trim() || 'introduzido pelo utilizador' })
            setName(''); setKcal(undefined); setP(undefined); setC(undefined); setF(undefined); setSource('')
            toast('Alimento guardado.')
          }}
        >
          Guardar alimento
        </button>
      </div>
      <Section title="Os meus alimentos">
        {snap.foods.length === 0 ? (
          <p className="text-sm text-muted">Ainda sem alimentos. A app não traz base de dados alimentar — os valores são introduzidos por ti.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {snap.foods.map((x) => (
              <li key={x.id} className="flex items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{x.name}</span>
                  <span className="num text-xs text-muted">
                    {x.basis === '100g' ? '100 g' : x.unitLabel}: {fmt(x.kcal, 0)} kcal · P {fmt(x.protein, 0)} · H {fmt(x.carbs, 0)} · G {fmt(x.fat, 0)}
                  </span>
                </span>
                <button aria-label={`Apagar ${x.name}`} className="flex size-10 items-center justify-center rounded-lg text-muted" onClick={() => db.foods.delete(x.id)}>
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Refeições frequentes">
        {snap.savedMeals.length === 0 ? (
          <p className="text-sm text-muted">Sem refeições guardadas.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {snap.savedMeals.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-4 py-3">
                <span className="flex-1">
                  <span className="block font-medium">{m.name}</span>
                  <span className="num text-xs text-muted">{m.items.length} itens · {fmt(totalsOf(m.items).kcal, 0)} kcal</span>
                </span>
                <button aria-label={`Apagar ${m.name}`} className="flex size-10 items-center justify-center rounded-lg text-muted" onClick={() => db.savedMeals.delete(m.id)}>
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function NutHistory({ snap }: { snap: Snapshot }) {
  const today = todayISO()
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, -i)), [today])
  const g = snap.settings.nutrition
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(startOfWeek(today), -7 * i)), [today])
  const cons = nutritionConsistency(snap.meals, addDays(today, -27), today, g.kcal)
  return (
    <div>
      <Section title="Médias semanais">
        <div className="card overflow-x-auto">
          <table className="num w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Semana</th>
                <th className="font-medium">Dias</th>
                <th className="font-medium">kcal</th>
                <th className="font-medium">P</th>
                <th className="font-medium">H</th>
                <th className="pr-4 font-medium">G</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const a = nutritionAverages(snap.meals, w, endOfWeek(w))
                return (
                  <tr key={w} className="border-t border-line">
                    <td className="px-4 py-2.5">{formatDatePT(w).slice(0, 5)}</td>
                    <td>{a.days || '—'}</td>
                    <td>{a.avg ? fmt(a.avg.kcal, 0) : '—'}</td>
                    <td>{a.avg ? fmt(a.avg.protein, 0) : '—'}</td>
                    <td>{a.avg ? fmt(a.avg.carbs, 0) : '—'}</td>
                    <td className="pr-4">{a.avg ? fmt(a.avg.fat, 0) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Médias apenas sobre os dias com registo. Dias sem registo não contam como zero.</p>
      </Section>
      <Section title="Consistência (últimos 28 dias)">
        {cons.days === 0 ? (
          <p className="text-sm text-muted">Sem alimentação registada.</p>
        ) : (
          <Notice tone="info">
            Registaste <strong>{cons.days}</strong> dia(s); em <strong>{cons.onTarget}</strong> ficaste a ±10% do objetivo calórico ({g.kcal} kcal).
          </Notice>
        )}
      </Section>
      <Section title="Últimos 14 dias">
        <ul className="card divide-y divide-line">
          {days.map((d) => {
            const m = mealsOn(snap.meals, d)
            const t = totalsOf(m)
            return (
              <li key={d} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{formatDatePT(d)}</span>
                <span className="num text-muted">{m.length ? `${fmt(t.kcal, 0)} kcal · P ${fmt(t.protein, 0)} g` : 'sem registo'}</span>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
