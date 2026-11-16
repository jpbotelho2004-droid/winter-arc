// Pequeno canal para pedir ao utilizador que escolha a variante (A/B) de um treino ao iniciá-lo.
import { db } from '../lib/db'
import type { Variant, WorkoutTemplate } from '../lib/types'

export interface VariantRequest {
  template: WorkoutTemplate
  suggested: Variant
  resolve: (v: Variant | null) => void
}

type Listener = (r: VariantRequest | null) => void
let listener: Listener | undefined

export function subscribeVariantRequests(l: Listener): () => void {
  listener = l
  return () => {
    if (listener === l) listener = undefined
  }
}

/** Sugere a variante oposta à da última sessão deste treino (alternância A/B). */
export async function suggestVariant(templateId: string): Promise<Variant> {
  const past = (await db.sessions.where('templateId').equals(templateId).toArray())
    .filter((s) => s.variant && s.status !== 'active')
    .sort((a, b) => (b.date + b.startedAt).toString().localeCompare((a.date + a.startedAt).toString()))
  const last = past[0]?.variant
  return last === 'A' ? 'B' : 'A'
}

/** Mostra o seletor e devolve a variante escolhida (ou null se o utilizador cancelar). */
export async function askVariant(template: WorkoutTemplate): Promise<Variant | null> {
  const suggested = await suggestVariant(template.id)
  if (!listener) return suggested
  return new Promise((resolve) => listener!({ template, suggested, resolve }))
}
