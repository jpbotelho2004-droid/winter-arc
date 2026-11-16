import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveSession, startFreeSession, startSessionFromTemplate } from '../lib/repo'
import { todayISO } from '../lib/dates'
import { useToast } from '../components/ui'
import { db } from '../lib/db'
import { askVariant } from './variantPicker'

/** Inicia (ou retoma) um treino e abre a sessão ativa. */
export function useStartWorkout() {
  const nav = useNavigate()
  const toast = useToast()
  const start = useCallback(
    async (templateId: string, date: string = todayISO()) => {
      try {
        const existing = await getActiveSession()
        if (existing && existing.templateId !== templateId) toast('Já tens um treino em curso. Termina-o ou descarta-o primeiro.', 'error')
        let variant
        if (!existing) {
          const tpl = await db.templates.get(templateId)
          if (tpl?.variants) {
            const v = await askVariant(tpl)
            if (!v) return // cancelado
            variant = v
          }
        }
        await startSessionFromTemplate(templateId, date, variant)
        nav('/treino')
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    },
    [nav, toast],
  )
  const startFree = useCallback(
    async (name = 'Treino livre', date: string = todayISO()) => {
      const existing = await getActiveSession()
      if (existing) toast('Já tens um treino em curso.', 'error')
      await startFreeSession(name, date)
      nav('/treino')
    },
    [nav, toast],
  )
  return { start, startFree }
}
