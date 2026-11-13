import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDayMonth } from '../lib/dates'
import type { ISODate } from '../lib/types'

const AXIS = { stroke: 'var(--muted)', fontSize: 11 }

export interface Series {
  key: string
  label: string
  color?: string
  dashed?: boolean
}

export function TimeChart({
  data,
  series,
  height = 190,
  unit,
  decimals = 1,
  area,
  domain,
  empty = 'Sem dados suficientes.',
}: {
  data: Array<{ date: ISODate } & Record<string, number | string | undefined>>
  series: Series[]
  height?: number
  unit?: string
  decimals?: number
  area?: boolean
  domain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax']
  empty?: string
}) {
  if (data.length < 1) return <p className="py-8 text-center text-sm text-muted">{empty}</p>
  const fmtv = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('pt-PT', { maximumFractionDigits: decimals }) : String(v ?? '—'))
  const colors = ['var(--accent)', '#5ec8ff', '#ffb84d', '#c18bff']
  const common = (
    <>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="date" tickFormatter={(d) => formatDayMonth(d as ISODate)} {...AXIS} tickLine={false} axisLine={false} minTickGap={24} />
      <YAxis {...AXIS} tickLine={false} axisLine={false} width={40} domain={domain ?? ['auto', 'auto']} tickFormatter={(v) => v.toLocaleString('pt-PT', { maximumFractionDigits: decimals })} />
      <Tooltip
        contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }}
        labelFormatter={(d) => formatDayMonth(d as ISODate)}
        formatter={(v, name) => [`${fmtv(v)}${unit ? ' ' + unit : ''}`, name]}
      />
    </>
  )
  return (
    <div style={{ height }} role="img" aria-label="Gráfico de evolução">
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {common}
            {series.map((s, i) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? colors[i % colors.length]} fill={s.color ?? colors[i % colors.length]} fillOpacity={0.12} strokeWidth={2.5} connectNulls dot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {common}
            {series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? colors[i % colors.length]} strokeWidth={2.5} strokeDasharray={s.dashed ? '5 4' : undefined} connectNulls dot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export function BarsChart({
  data,
  dataKey,
  label,
  unit,
  height = 170,
  xKey = 'label',
}: {
  data: Array<Record<string, number | string | undefined>>
  dataKey: string
  label: string
  unit?: string
  height?: number
  xKey?: string
}) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">Sem dados suficientes.</p>
  return (
    <div style={{ height }} role="img" aria-label={`Gráfico de barras: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} tickLine={false} axisLine={false} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ fill: 'var(--surface2)' }}
            contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }}
            formatter={(v) => [`${typeof v === 'number' ? v.toLocaleString('pt-PT', { maximumFractionDigits: 1 }) : v}${unit ? ' ' + unit : ''}`, label]}
          />
          <Bar dataKey={dataKey} fill="var(--accent)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Spark({ values, color = 'var(--accent)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const rng = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / rng) * 24}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" className="h-7 w-20" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
