import { useEffect, useState } from 'react'
import { Footprints, Zap } from 'lucide-react'
import { subscribeVariantRequests, type VariantRequest } from '../hooks/variantPicker'
import { Sheet } from './ui'
import type { Variant } from '../lib/types'

const INFO: Record<Variant, { title: string; text: string; icon: typeof Zap }> = {
  A: { title: 'Variante A — Saltos', text: 'Pogo Jumps e Broad Jumps antes da musculação das pernas.', icon: Zap },
  B: { title: 'Variante B — Sprints', text: 'Acelerações progressivas (e sprints curtos de 20 m quando o programa os introduz). Em pista ou no exterior.', icon: Footprints },
}

/** Seletor das variantes de sábado (A = saltos, B = sprints). Montado uma vez no Layout. */
export function VariantPickerHost() {
  const [req, setReq] = useState<VariantRequest | null>(null)
  useEffect(() => subscribeVariantRequests(setReq), [])
  if (!req) return null
  const done = (v: Variant | null) => {
    req.resolve(v)
    setReq(null)
  }
  return (
    <Sheet open onClose={() => done(null)} title="Escolhe a variante de hoje">
      <p className="mb-3 text-sm text-muted">
        Não é obrigatório fazer saltos e sprints na mesma sessão. Alterna as variantes; a sugestão é a oposta à da última vez.
      </p>
      <div className="space-y-3 pb-2" data-testid="variant-picker">
        {(['A', 'B'] as const).map((v) => {
          const I = INFO[v].icon
          const sug = v === req.suggested
          return (
            <button
              key={v}
              data-testid={`variant-${v}`}
              onClick={() => done(v)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${sug ? 'border-accent bg-accent-soft' : 'border-line bg-surface2'}`}
            >
              <I size={22} className="mt-0.5 shrink-0 text-accent" />
              <span className="flex-1">
                <span className="block font-semibold">
                  {INFO[v].title} {sug && <span className="chip-accent ml-1 align-middle">sugerida</span>}
                </span>
                <span className="mt-1 block text-sm text-muted">{INFO[v].text}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
