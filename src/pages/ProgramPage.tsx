import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Zap } from 'lucide-react'
import { formatDatePT, todayISO } from '../lib/dates'
import { PHASES, PLYO_LEVELS, extendPhase, programPosition, phaseStartWeek, phaseEndWeek } from '../lib/program'
import { updateSettings } from '../lib/repo'
import { recoveryAdvice } from '../lib/stats'
import { Confirm, Field, Loading, Notice, PageHeader, Progress, Section, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'

export default function ProgramPage() {
  const snap = useSnap()
  const toast = useToast()
  const [confirmPlyo, setConfirmPlyo] = useState<2 | 3 | null>(null)
  const [confirmExtend, setConfirmExtend] = useState(false)
  if (!snap) return <Loading />
  const s = snap.settings
  const today = todayISO()
  const pos = programPosition(today, s)
  const adv = recoveryAdvice(snap.recovery, today)
  const starts = s.program.phaseStarts
  const weekPct = pos.beforeStart ? 0 : Math.min(100, (pos.week / 12) * 100)

  return (
    <div>
      <PageHeader title="Programa de 12 semanas" subtitle="Readaptação → Desenvolvimento → Performance" back />

      <div className="card p-4" data-testid="program-status">
        <p className="text-xs uppercase tracking-wide text-muted">Estás em</p>
        <p className="display text-3xl font-bold leading-tight">{pos.beforeStart ? 'Antes do início' : `Semana ${pos.week} · Fase ${pos.phase}`}</p>
        <p className="text-sm text-muted">{pos.beforeStart ? `Começa a ${formatDatePT(s.program.startDate)}` : pos.phaseInfo.name}</p>
        <div className="mt-3">
          <Progress value={weekPct} />
        </div>
        <Field label="Data de início (semana 1)">
          <input
            type="date"
            className="input mt-1"
            value={s.program.startDate}
            onChange={(e) => e.target.value && updateSettings({ program: { ...s.program, startDate: e.target.value } })}
            aria-label="Data de início do programa"
          />
        </Field>
        <p className="mt-2 text-xs text-muted">Alterar a data não apaga o histórico; apenas muda a semana/fase atual.</p>
      </div>

      {adv.level !== 'ok' && (
        <div className="mt-4">
          <Notice tone={adv.level === 'alerta' ? 'danger' : 'warn'} title="Sinais de fadiga ou dor recentes">
            {adv.messages[0]} Considera prolongar a fase atual em vez de avançar.
          </Notice>
        </div>
      )}

      {!pos.beforeStart && pos.phase < 4 && (
        <Section title="Passagem de fase">
          <div className="card space-y-3 p-4">
            <p className="text-sm">
              A fase {pos.phase} termina na semana {pos.lastWeekOfPhase}. A passagem <strong>não é automática por data</strong>: avança só se estiveres a recuperar bem, sem dor e com boa técnica.
            </p>
            <ul className="space-y-1 text-sm text-muted">
              <li>• Fadiga controlada e sono adequado</li>
              <li>• Sem dor articular persistente</li>
              <li>• Técnica estável nos exercícios principais e nas aterragens</li>
            </ul>
            <button data-testid="extend-phase" className="btn-soft w-full" onClick={() => setConfirmExtend(true)}>
              Prolongar a fase {pos.phase} em +1 semana
            </button>
            <p className="text-xs text-muted">
              Atualmente a fase 2 começa na semana {starts[0]}, a fase 3 na semana {starts[1]} e a fase 4 na semana {starts[2]}.
            </p>
          </div>
        </Section>
      )}

      <Section title="Fases">
        <div className="space-y-3">
          {PHASES.map((p) => {
            const startW = phaseStartWeek(p.n, starts)
            const endW = phaseEndWeek(p.n, starts)
            const current = !pos.beforeStart && pos.phase === p.n
            return (
              <div key={p.n} className={`card p-4 ${current ? '!border-accent' : ''}`} data-testid={`phase-${p.n}`}>
                <div className="flex items-center justify-between">
                  <p className="display text-xl font-bold">
                    Fase {p.n} · {p.name}
                  </p>
                  {current && <span className="chip-accent">atual</span>}
                </div>
                <p className="text-xs text-muted">
                  Semanas {startW}–{endW} · {p.rir}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {p.rules.map((r) => (
                    <li key={r} className="flex gap-2">
                      <Check size={15} className="mt-1 shrink-0 text-accent" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Fadiga ou dor">
        <div className="card space-y-3 p-4" data-testid="reduce-card">
          <p className="text-sm">
            Se estás com fadiga elevada ou dor articular, reduz o volume (menos 1 série nos exercícios e sem séries extra) em vez de forçar. <strong>Não progrides carga com dor.</strong> Podes também repetir a semana ou prolongar a fase acima.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              data-testid="reduce-volume"
              className="h-5 w-5 accent-[var(--color-accent)]"
              checked={!!s.program.reduceVolume}
              onChange={(e) => updateSettings({ program: { ...s.program, reduceVolume: e.target.checked } })}
            />
            Reduzir volume nas próximas sessões
          </label>
        </div>
      </Section>

      <Section title="Pliometria e velocidade">
        <div className="card space-y-3 p-4" data-testid="plyo-card">
          <p className="flex items-center gap-2 font-semibold">
            <Zap size={18} className="text-accent" /> {PLYO_LEVELS[s.program.plyoLevel].name}
          </p>
          <p className="text-sm text-muted">{PLYO_LEVELS[s.program.plyoLevel].guidance}</p>
          <p className="text-xs text-muted">A intensidade da pliometria nunca sobe automaticamente: confirma tu quando estiveres pronto (boa tolerância, aterragens estáveis e sem dor).</p>
          {s.program.plyoLevel < 3 && (
            <button className="btn-soft w-full" data-testid="plyo-up" onClick={() => setConfirmPlyo((s.program.plyoLevel + 1) as 2 | 3)}>
              Estou pronto para o nível {s.program.plyoLevel + 1}
            </button>
          )}
          {s.program.plyoLevel > 1 && (
            <button className="btn-ghost w-full" onClick={() => updateSettings({ program: { ...s.program, plyoLevel: (s.program.plyoLevel - 1) as 1 | 2 } })}>
              Voltar ao nível {s.program.plyoLevel - 1}
            </button>
          )}
        </div>
      </Section>

      <p className="mt-6 text-xs text-muted">
        O volume de cada sessão é ajustado automaticamente à fase (ex.: 1–2 séries na fase 1), sem alterar o teu plano. Edita o plano em <Link to="/treinar" className="text-accent">Treinar</Link>.
      </p>

      <Confirm
        open={confirmExtend}
        title="Prolongar a fase atual?"
        message="As fases seguintes são adiadas em 1 semana. O histórico não é alterado."
        confirmLabel="Prolongar +1 semana"
        onCancel={() => setConfirmExtend(false)}
        onConfirm={async () => {
          await updateSettings({ program: { ...s.program, phaseStarts: extendPhase(starts, pos.phase as 1 | 2 | 3, 1) } })
          setConfirmExtend(false)
          toast('Fase prolongada em 1 semana.')
        }}
      />
      <Confirm
        open={confirmPlyo !== null}
        title={confirmPlyo ? `Avançar para ${PLYO_LEVELS[confirmPlyo].name}?` : ''}
        message={confirmPlyo ? `${PLYO_LEVELS[confirmPlyo].guidance} Confirma apenas se não tens dor e as aterragens estão estáveis.` : ''}
        confirmLabel="Confirmar"
        onCancel={() => setConfirmPlyo(null)}
        onConfirm={async () => {
          if (confirmPlyo) await updateSettings({ program: { ...s.program, plyoLevel: confirmPlyo } })
          setConfirmPlyo(null)
          toast('Nível de pliometria atualizado.')
        }}
      />
    </div>
  )
}
