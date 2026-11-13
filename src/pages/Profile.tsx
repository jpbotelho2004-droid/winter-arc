import { Link } from 'react-router-dom'
import { Activity, BookOpen, CalendarDays, ChevronRight, FileText, HardDrive, History, Layers, Settings as Cog } from 'lucide-react'
import { fmt } from '../lib/calc'
import { formatDatePT } from '../lib/dates'
import { programPosition } from '../lib/program'
import { finished, latestWeight } from '../lib/stats'
import { Loading, Notice, PageHeader, Section, Stat } from '../components/ui'
import { useSnap, useToday } from '../hooks/hooks'

const LINKS = [
  { to: '/recuperacao', icon: Activity, label: 'Recuperação', sub: 'Sono, energia, fadiga e dor' },
  { to: '/programa', icon: Layers, label: 'Programa de 12 semanas', sub: 'Fases, progressão e pliometria' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendário', sub: 'Mensal e semanal' },
  { to: '/historico', icon: History, label: 'Histórico', sub: 'Todas as sessões' },
  { to: '/exercicios', icon: BookOpen, label: 'Biblioteca de exercícios', sub: 'Técnica e vídeos' },
  { to: '/relatorios', icon: FileText, label: 'Relatórios', sub: 'Texto para o ChatGPT e JSON' },
  { to: '/backup', icon: HardDrive, label: 'Cópia de segurança', sub: 'Exportar e importar' },
  { to: '/definicoes', icon: Cog, label: 'Definições', sub: 'Perfil, objetivos, unidades, tema' },
]

export default function Profile() {
  const snap = useSnap()
  const today = useToday()
  if (!snap) return <Loading />
  const s = snap.settings
  const pos = programPosition(today, s)
  const lw = latestWeight(snap.bodyLogs)
  const n = finished(snap.sessions).length
  const initial = (s.displayName || 'W').trim().charAt(0).toUpperCase()
  return (
    <div>
      <PageHeader title="Perfil" />
      <div className="card flex items-center gap-4 p-4">
        <div className="display flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-3xl font-bold text-accent">{initial}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{s.displayName || 'Atleta'}</p>
          <p className="text-sm text-muted">{pos.beforeStart ? `Programa começa a ${formatDatePT(s.program.startDate)}` : `Semana ${pos.week} · Fase ${pos.phase} (${pos.phaseInfo.name})`}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Altura" value={`${s.heightCm}`} sub="cm" />
        <Stat label="Peso atual" value={lw ? fmt(lw.weightKg) : '—'} sub={lw ? `kg · ${formatDatePT(lw.date)}` : 'sem registo'} />
        <Stat label="Treinos" value={n} sub="registados" />
      </div>
      <p className="mt-2 text-xs text-muted">Peso inicial definido: {fmt(s.startWeightKg)} kg · Fuso horário: Europe/Lisbon · Unidades métricas</p>

      <Section title="Áreas">
        <div className="card divide-y divide-line">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="flex min-h-16 items-center gap-3 px-4 py-2">
              <l.icon size={22} className="text-accent" />
              <span className="flex-1">
                <span className="block font-medium">{l.label}</span>
                <span className="text-xs text-muted">{l.sub}</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          ))}
        </div>
      </Section>
      <div className="mt-6">
        <Notice tone="info" title="Os teus dados ficam neste dispositivo">
          Não há conta nem servidor. Faz cópias de segurança regulares em <Link to="/backup" className="text-accent">Cópia de segurança</Link> — limpar os dados do Safari apaga a base de dados.
        </Notice>
      </div>
    </div>
  )
}
