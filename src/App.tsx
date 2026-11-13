import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, requestPersistence } from './lib/db'
import { ensureSeeded } from './lib/repo'
import { unlockAudio } from './lib/alerts'
import { Layout } from './components/Layout'
import { Loading, Notice } from './components/ui'
import Home from './pages/Home'
import Train from './pages/Train'
import Workout from './pages/Workout'
import SessionDetail from './pages/SessionDetail'
import Nutrition from './pages/Nutrition'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Backup from './pages/Backup'
import History from './pages/History'
import CalendarPage from './pages/CalendarPage'
import DayPage from './pages/DayPage'
import Reports from './pages/Reports'
import ProgramPage from './pages/ProgramPage'
import TemplateEditor from './pages/TemplateEditor'
import Exercises from './pages/Exercises'

const Progress = lazy(() => import('./pages/Progress'))
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'))
const Recovery = lazy(() => import('./pages/Recovery'))

function useTheme() {
  const theme = useLiveQuery(async () => (await db.settings.get('main'))?.theme ?? 'dark', [], 'dark')
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0b' : '#f3f4f6')
    }
    apply()
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useTheme()

  useEffect(() => {
    ensureSeeded()
      .then(() => {
        setReady(true)
        void requestPersistence()
      })
      .catch((e) => setError((e as Error).message))
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  if (error)
    return (
      <div className="mx-auto max-w-md p-6">
        <Notice tone="danger" title="Não foi possível abrir o armazenamento local">
          {error}. Em navegação privada o Safari pode bloquear o armazenamento. Abre a aplicação numa janela normal.
        </Notice>
      </div>
    )
  if (!ready) return <Loading />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="treinar" element={<Train />} />
          <Route path="treino" element={<Workout />} />
          <Route path="sessao/:id" element={<SessionDetail />} />
          <Route path="evolucao" element={<Progress />} />
          <Route path="nutricao" element={<Nutrition />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="recuperacao" element={<Recovery />} />
          <Route path="definicoes" element={<Settings />} />
          <Route path="backup" element={<Backup />} />
          <Route path="historico" element={<History />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="dia/:date" element={<DayPage />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="programa" element={<ProgramPage />} />
          <Route path="treinos/:id" element={<TemplateEditor />} />
          <Route path="exercicios" element={<Exercises />} />
          <Route path="exercicio/:id" element={<ExerciseDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
