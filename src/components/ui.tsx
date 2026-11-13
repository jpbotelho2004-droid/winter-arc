import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, X } from 'lucide-react'
import { parseNum } from '../lib/calc'

// ------------------------------------------------------------------ toast

type ToastKind = 'ok' | 'error'
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Array<{ id: number; msg: string; kind: ToastKind }>>([])
  const idRef = useRef(0)
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = ++idRef.current
    setItems((x) => [...x, { id, msg, kind }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 6000 : 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`anim-pop pointer-events-none max-w-md rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
              t.kind === 'error' ? 'border-danger/40 bg-surface text-danger' : 'border-line bg-surface2 text-ink'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ------------------------------------------------------------------ estrutura

export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string
  subtitle?: string
  back?: boolean | string
  right?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <header className="mb-4 flex items-start gap-2">
      {back && (
        <button
          aria-label="Voltar"
          onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
          className="-ml-2 mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted active:bg-surface2"
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="display text-[28px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  )
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  )
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`num mt-1 text-2xl font-bold leading-none ${accent ? 'text-accent' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function Progress({ value, max = 100, tone = 'accent' }: { value: number; max?: number; tone?: 'accent' | 'warn' | 'danger' }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))
  const color = tone === 'accent' ? 'bg-accent' : tone === 'warn' ? 'bg-warn' : 'bg-danger'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Notice({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'danger'; title?: string; children?: ReactNode; action?: ReactNode }) {
  const cls = tone === 'danger' ? 'border-danger/40 bg-danger/10' : tone === 'warn' ? 'border-warn/40 bg-warn/10' : 'border-line bg-surface'
  return (
    <div className={`rounded-2xl border p-4 ${cls}`} role={tone === 'info' ? undefined : 'alert'}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className="mt-1 text-sm text-muted [&_strong]:text-ink">{children}</div>}
      {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

// ------------------------------------------------------------------ controlos

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode; testId?: string }>
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl bg-surface2 p-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          data-testid={o.testId}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${
            o.value === value ? 'bg-accent text-accent-ink' : 'text-muted active:bg-surface'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface2'}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div id={id}>{children}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export interface NumInputProps {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  decimals?: boolean
  min?: number
  max?: number
  className?: string
  'aria-label'?: string
  id?: string
  testId?: string
  disabled?: boolean
  onEnter?: () => void
}

/** Campo numérico com texto local (aceita vírgula), validação de limites e teclado numérico. */
export function NumInput({ value, onChange, placeholder, decimals = true, min = 0, max, className = '', testId, disabled, onEnter, ...rest }: NumInputProps) {
  const toText = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','))
  const [txt, setTxt] = useState(toText(value))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => {
    if (value !== parseNum(txt)) setTxt(toText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      {...rest}
      data-testid={testId}
      disabled={disabled}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      placeholder={placeholder}
      value={txt}
      aria-invalid={invalid || undefined}
      className={`input-num ${invalid ? '!border-danger' : ''} ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.target as HTMLInputElement).blur()
          onEnter?.()
        }
      }}
      onChange={(e) => {
        const raw = e.target.value
        const re = decimals ? /^\d*[.,]?\d*$/ : /^\d*$/
        if (!re.test(raw)) return
        setTxt(raw)
        if (raw.trim() === '') {
          setInvalid(false)
          onChange(undefined)
          return
        }
        const n = parseNum(raw)
        if (n === undefined) return
        if (n < min || (max !== undefined && n > max)) {
          setInvalid(true)
          return
        }
        setInvalid(false)
        onChange(n)
      }}
      onBlur={() => {
        setInvalid(false)
        setTxt(toText(value))
      }}
      onFocus={(e) => e.target.select()}
    />
  )
}

export function ScaleInput({ value, onChange, labels, label, testId }: { value: number | undefined; onChange: (v: number | undefined) => void; labels?: [string, string]; label: string; testId?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label !mb-0">{label}</span>
        {labels && (
          <span className="text-[11px] text-muted">
            1 = {labels[0]} · 5 = {labels[1]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            data-testid={testId ? `${testId}-${n}` : undefined}
            onClick={() => onChange(value === n ? undefined : n)}
            className={`num min-h-12 rounded-xl text-lg font-bold transition ${value === n ? 'bg-accent text-accent-ink' : 'bg-surface2 text-muted active:bg-line'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ sheets & diálogos

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="anim-pop relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-surface md:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="display text-xl font-bold">{title}</h2>
          <button aria-label="Fechar" onClick={onClose} className="flex size-10 items-center justify-center rounded-xl text-muted active:bg-surface2">
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-5 pb-3 pt-3">{footer}</div>}
        {!footer && <div className="safe-bottom" />}
      </div>
    </div>
  )
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {message && <div className="mb-4 text-sm text-muted">{message}</div>}
      <div className="flex flex-col gap-2 pb-2">
        <button data-testid="confirm-yes" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </Sheet>
  )
}
