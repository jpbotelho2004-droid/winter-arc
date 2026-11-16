import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dumbbell, Home, Timer, TrendingUp, User, Utensils } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { db } from '../lib/db'
import { beep, notify, vibrate } from '../lib/alerts'
import { clock } from '../lib/calc'
import { useActiveSession, useNow } from '../hooks/hooks'
import { useToast } from './ui'
import { VariantPickerHost } from './VariantPicker'

const TABS = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/treinar', label: 'Treinar', icon: Dumbbell },
  { to: '/evolucao', label: 'Evolução', icon: TrendingUp },
  { to: '/nutricao', label: 'Nutrição', icon: Utensils },
  { to: '/perfil', label: 'Perfil', icon: User },
]

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="leading-none">
      <p className="display text-2xl font-extrabold tracking-wider">
        WINTER <span className="text-accent">ARC</span>
      </p>
      {!compact && <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Athletic Performance</p>}
    </div>
  )
}

const alerted = new Set<number>()

/** Avisa quando o descanso termina (som, vibração, notificação). Funciona com timestamps. */
function RestAlerts() {
  const active = useActiveSession()
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const toast = useToast()
  const rest = active?.rest
  const endsAt = rest?.endsAt
  useEffect(() => {
    if (!endsAt) return
    const fire = () => {
      if (alerted.has(endsAt)) return
      alerted.add(endsAt)
      if (Date.now() - endsAt > 60_000) return // já passou há muito; sem alarme tardio
      if (settings?.sound !== false) beep()
      if (settings?.vibrate !== false) vibrate()
      if (document.hidden && settings?.notifications) notify('Descanso terminado', 'Próxima série.')
      toast('Descanso terminado — próxima série.')
    }
    const ms = endsAt - Date.now()
    if (ms <= 0) {
      fire()
      return
    }
    const id = setTimeout(fire, ms)
    const onVis = () => !document.hidden && Date.now() >= endsAt && fire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [endsAt, settings?.sound, settings?.vibrate, settings?.notifications, toast])
  return null
}

function MiniBar() {
  const active = useActiveSession()
  const now = useNow(1000)
  const loc = useLocation()
  if (!active || loc.pathname === '/treino') return null
  const restLeft = active.rest ? Math.max(0, Math.ceil((active.rest.endsAt - now) / 1000)) : 0
  return (
    <Link
      to="/treino"
      data-testid="mini-bar"
      className="anim-pop pointer-events-auto fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-accent/40 bg-surface px-4 py-3 shadow-2xl md:bottom-4 md:left-[calc(15rem+1rem)] md:right-4 md:mx-0"
    >
      <span className="pulse flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Timer size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">Treino em curso · {active.name}</span>
        <span className="num block text-xs text-muted">
          {clock((now - active.startedAt) / 1000)}
          {restLeft > 0 ? ` · descanso ${clock(restLeft)}` : ''}
        </span>
      </span>
      <span className="text-sm font-semibold text-accent">Abrir</span>
    </Link>
  )
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()
  const active = useActiveSession()
  useEffect(() => {
    if (!offlineReady || needRefresh) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, needRefresh, setOfflineReady])
  if (!needRefresh && !offlineReady) return null
  return (
    <div className={`${needRefresh ? '' : 'pointer-events-none '}fixed inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-[90] mx-auto max-w-md rounded-2xl border border-line bg-surface2 p-4 text-sm shadow-2xl`} role="status">
      {needRefresh ? (
        <>
          <p className="font-semibold">Nova versão disponível</p>
          <p className="mt-1 text-muted">Os teus dados não são afetados.{active ? ' Termina o treino em curso antes de atualizar.' : ''}</p>
          <button className="btn-primary btn-sm mt-3" disabled={!!active} onClick={() => updateServiceWorker(true)}>
            Atualizar agora
          </button>
        </>
      ) : (
        <>
          <p className="font-semibold">Pronta para utilizar offline</p>
          <button className="btn-soft btn-sm mt-3" onClick={() => setOfflineReady(false)}>
            OK
          </button>
        </>
      )}
    </div>
  )
}

export function Layout() {
  const loc = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  return (
    <div className="min-h-dvh md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Navegação principal">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold transition ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface2'}`}
            >
              <t.icon size={20} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+140px)] pt-[calc(env(safe-area-inset-top)+16px)] md:pb-28">
        <Outlet />
      </main>

      <MiniBar />
      <RestAlerts />
      <UpdatePrompt />
      <VariantPickerHost />

      <nav
        aria-label="Navegação principal"
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface md:hidden"
      >
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                <t.icon size={22} />
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
