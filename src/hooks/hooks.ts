import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { loadSnapshot } from '../lib/snapshot'
import { todayISO } from '../lib/dates'
import type { Session } from '../lib/types'
import type { Snapshot } from '../lib/stats'

/** Todos os dados, atualizados automaticamente sempre que algo muda na base de dados. */
export function useSnap(): Snapshot | undefined {
  return useLiveQuery(loadSnapshot, [], undefined)
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])
  return now
}

export function useToday(): string {
  const now = useNow(30_000)
  return todayISO(now)
}

/** Sessão em curso (se existir). `null` = não existe; `undefined` = a carregar. */
export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(async () => (await db.sessions.where('status').equals('active').first()) ?? null, [], undefined)
}

/**
 * Editor de sessão com gravação imediata e serializada.
 * Cada alteração é escrita na base de dados de imediato (não depende de fechar a aplicação).
 */
export function useSessionEditor(id: string | undefined) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const ref = useRef<Session | undefined>(undefined)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ref.current = undefined
    setSession(undefined)
    if (!id) {
      setSession(null)
      return
    }
    db.sessions.get(id).then((s) => {
      if (!alive) return
      ref.current = s
      setSession(s ?? null)
    })
    return () => {
      alive = false
    }
  }, [id])

  const update = useCallback((fn: (s: Session) => Session) => {
    const cur = ref.current
    if (!cur) return
    const next = { ...fn(cur), updatedAt: Date.now() }
    ref.current = next
    setSession(next)
    chain.current = chain.current
      .then(() => db.sessions.put(next))
      .then(() => setError(null))
      .catch((e) => setError(`Erro ao guardar: ${(e as Error).message}`))
  }, [])

  const flush = useCallback(() => chain.current, [])
  return { session, update, error, flush }
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T) => {
      setVal(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* sem armazenamento */
      }
    },
    [key],
  )
  return [val, set]
}
