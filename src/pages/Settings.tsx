import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Trash2, Upload } from 'lucide-react'
import { db } from '../lib/db'
import { requestNotifications, notificationsSupported } from '../lib/alerts'
import { BACKUP_TABLES } from '../lib/types'
import { ensureSeeded, resetOfficialPlan, updateSettings } from '../lib/repo'
import { FIXED_METRICS } from '../lib/stats'
import { uid } from '../lib/calc'
import { Confirm, Field, Loading, NumInput, PageHeader, Section, Segmented, Toggle, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'
import type { Settings as S } from '../lib/types'

export default function Settings() {
  const snap = useSnap()
  const toast = useToast()
  const [clear, setClear] = useState(false)
  const [reset, setReset] = useState(false)
  const [text, setText] = useState('')
  const [storage, setStorage] = useState<string>('')
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setStorage(`${(e.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB usados`)
    })
  }, [])
  if (!snap) return <Loading />
  const s = snap.settings
  const set = (p: Partial<S>) => void updateSettings(p)
  const setNut = (p: Partial<S['nutrition']>) => set({ nutrition: { ...s.nutrition, ...p } })
  const targetsMetrics = FIXED_METRICS.filter((m) => m.manual && m.key !== 'mobility-squat')

  return (
    <div>
      <PageHeader title="Definições" back />

      <Section title="Perfil">
        <div className="card space-y-3 p-4">
          <Field label="Nome de apresentação">
            <input className="input" value={s.displayName} onChange={(e) => set({ displayName: e.target.value })} aria-label="Nome de apresentação" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso inicial (kg)">
              <NumInput value={s.startWeightKg} onChange={(v) => v !== undefined && set({ startWeightKg: v })} min={20} max={300} aria-label="Peso inicial" />
            </Field>
            <Field label="Altura (cm)">
              <NumInput value={s.heightCm} onChange={(v) => v !== undefined && set({ heightCm: v })} min={100} max={250} decimals={false} aria-label="Altura" />
            </Field>
          </div>
          <Field label="Objetivo principal">
            <textarea className="input min-h-20 py-3" value={s.goalText} onChange={(e) => set({ goalText: e.target.value })} aria-label="Objetivo" />
          </Field>
          <p className="text-xs text-muted">Unidades métricas (kg, cm, m). Datas em formato português. Fuso horário: Europe/Lisbon.</p>
        </div>
      </Section>

      <Section title="Metas de performance (opcional)">
        <div className="card space-y-3 p-4">
          {targetsMetrics.map((m) => (
            <Field key={m.key} label={`${m.label} (${m.unit})`}>
              <NumInput
                value={s.targets?.[m.key]}
                onChange={(v) => {
                  const t = { ...(s.targets ?? {}) }
                  if (v === undefined) delete t[m.key]
                  else t[m.key] = v
                  set({ targets: t })
                }}
                placeholder="sem meta"
                aria-label={`Meta ${m.label}`}
                max={100000}
              />
            </Field>
          ))}
          <p className="text-xs text-muted">As metas aparecem na página Início como progresso entre o primeiro registo e a meta.</p>
        </div>
      </Section>

      <Section title="Treino">
        <div className="card space-y-3 p-4">
          <p className="text-sm text-muted">
            Os dias de treino e os exercícios editam-se em <Link to="/treinar" className="text-accent">Treinar</Link> (toca num treino).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Descanso compostos (s)">
              <NumInput value={s.restCompoundSec} onChange={(v) => v !== undefined && set({ restCompoundSec: v })} decimals={false} max={900} aria-label="Descanso compostos" />
            </Field>
            <Field label="Descanso isolados (s)">
              <NumInput value={s.restIsolationSec} onChange={(v) => v !== undefined && set({ restIsolationSec: v })} decimals={false} max={900} aria-label="Descanso isolados" />
            </Field>
          </div>
          <p className="text-xs text-muted">Aplica-se a exercícios adicionados manualmente. O descanso dos treinos do plano define-se em cada treino.</p>
          <div className="divide-y divide-line">
            <Toggle label="Som no fim do descanso" checked={s.sound} onChange={(v) => set({ sound: v })} />
            <Toggle label="Vibração no fim do descanso" checked={s.vibrate} onChange={(v) => set({ vibrate: v })} hint="Não suportada no iPhone." />
            <Toggle label="Manter o ecrã ligado durante o treino" checked={s.keepAwake} onChange={(v) => set({ keepAwake: v })} />
            {notificationsSupported() && (
              <Toggle
                label="Notificações de fim de descanso"
                hint="Só funcionam com a app aberta em segundo plano; o iOS não permite agendar alertas com o ecrã bloqueado."
                checked={s.notifications}
                onChange={async (v) => {
                  if (v) {
                    const p = await requestNotifications()
                    if (p !== 'granted') return toast('Permissão de notificações não concedida.', 'error')
                  }
                  set({ notifications: v })
                }}
              />
            )}
          </div>
        </div>
      </Section>

      <Section title="Tema">
        <Segmented value={s.theme} onChange={(v) => set({ theme: v })} label="Tema" options={[{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }, { value: 'auto', label: 'Automático' }]} />
      </Section>

      <Section title="Objetivos nutricionais">
        <div className="card space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calorias (kcal)">
              <NumInput value={s.nutrition.kcal} onChange={(v) => v !== undefined && setNut({ kcal: v })} max={10000} decimals={false} aria-label="Objetivo de calorias" />
            </Field>
            <Field label="Proteína (g)">
              <NumInput value={s.nutrition.protein} onChange={(v) => v !== undefined && setNut({ protein: v })} max={1000} decimals={false} aria-label="Objetivo de proteína" />
            </Field>
            <Field label="Hidratos (g)">
              <NumInput value={s.nutrition.carbs} onChange={(v) => v !== undefined && setNut({ carbs: v })} max={2000} decimals={false} aria-label="Objetivo de hidratos" />
            </Field>
            <Field label="Gordura (g)">
              <NumInput value={s.nutrition.fat} onChange={(v) => v !== undefined && setNut({ fat: v })} max={1000} decimals={false} aria-label="Objetivo de gordura" />
            </Field>
          </div>
          <Field label="Objetivo de água (mL, opcional)">
            <NumInput value={s.waterGoalMl} onChange={(v) => set({ waterGoalMl: v })} max={20000} decimals={false} placeholder="sem objetivo" aria-label="Objetivo de água" />
          </Field>
          <p className="text-xs text-muted">Valores iniciais de partida, não uma prescrição definitiva. Para uma orientação personalizada, consulta um nutricionista.</p>
        </div>
      </Section>

      <Section title="Suplementos">
        <div className="card divide-y divide-line px-4">
          {s.supplements.map((sp) => (
            <div key={sp.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <input className="input !min-h-10" value={sp.name} onChange={(e) => set({ supplements: s.supplements.map((x) => (x.id === sp.id ? { ...x, name: e.target.value } : x)) })} aria-label="Nome do suplemento" />
                <input className="input mt-1 !min-h-10 text-sm" value={sp.dose ?? ''} placeholder="dose / nota" onChange={(e) => set({ supplements: s.supplements.map((x) => (x.id === sp.id ? { ...x, dose: e.target.value } : x)) })} aria-label="Dose" />
              </div>
              <button aria-label="Remover suplemento" className="flex size-10 items-center justify-center rounded-lg text-muted" onClick={() => set({ supplements: s.supplements.filter((x) => x.id !== sp.id) })}>
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <div className="py-3">
            <button className="btn-soft btn-sm" onClick={() => set({ supplements: [...s.supplements, { id: uid('sup'), name: 'Novo suplemento', enabled: true }] })}>
              Adicionar suplemento
            </button>
          </div>
        </div>
      </Section>

      <Section title="Dados">
        <div className="card space-y-2 p-4">
          <p className="text-sm text-muted">Os dados ficam guardados neste navegador {storage && `(${storage})`}. Limpar os dados do Safari/navegador apaga-os — faz cópias de segurança.</p>
          <Link to="/backup" className="btn-soft w-full">
            <Download size={18} /> Exportar / <Upload size={18} /> Importar cópia de segurança
          </Link>
          <button className="btn-ghost w-full" onClick={() => setReset(true)}>
            Repor plano oficial de treinos
          </button>
          <button data-testid="clear-data" className="btn-danger w-full" onClick={() => setClear(true)}>
            <Trash2 size={18} /> Limpar todos os dados
          </button>
        </div>
      </Section>

      <p className="mt-8 text-center text-xs text-muted">Winter Arc — Athletic Performance · v1.0.0</p>

      <Confirm
        open={reset}
        title="Repor o plano oficial?"
        message="Os 7 treinos oficiais voltam à configuração original. Treinos personalizados e o histórico são mantidos."
        confirmLabel="Repor plano"
        onCancel={() => setReset(false)}
        onConfirm={async () => {
          await resetOfficialPlan()
          setReset(false)
          toast('Plano oficial reposto.')
        }}
      />
      <Confirm
        open={clear}
        danger
        title="Limpar todos os dados?"
        message={
          <>
            <p>Apaga <strong>todas</strong> as sessões, registos corporais, nutrição, recuperação, fotografias e definições deste dispositivo. Não pode ser anulado.</p>
            <p className="mt-2">Exporta primeiro uma cópia de segurança. Escreve <strong>APAGAR</strong> para confirmar:</p>
            <input className="input mt-2" value={text} onChange={(e) => setText(e.target.value)} aria-label="Escreve APAGAR para confirmar" data-testid="clear-confirm-input" />
          </>
        }
        confirmLabel="Apagar tudo"
        onCancel={() => { setClear(false); setText('') }}
        onConfirm={async () => {
          if (text.trim().toUpperCase() !== 'APAGAR') return toast('Escreve APAGAR para confirmar.', 'error')
          await db.transaction('rw', BACKUP_TABLES.map((t) => db[t]), async () => {
            for (const t of BACKUP_TABLES) await db[t].clear()
          })
          await ensureSeeded()
          setClear(false)
          setText('')
          toast('Todos os dados foram apagados.')
        }}
      />
    </div>
  )
}
