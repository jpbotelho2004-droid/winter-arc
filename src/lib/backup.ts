// Cópia de segurança completa (JSON versionado): exportar, validar, resumir e importar (fundir ou substituir).

import { db } from './db'
import { isValidISO } from './dates'
import { applyProgramV2 } from './repo'
import { BACKUP_APP, BACKUP_SCHEMA_VERSION, BACKUP_TABLES, type BackupTable } from './types'

export const APP_VERSION = '1.0.0'

export interface BackupFile {
  app: typeof BACKUP_APP
  schemaVersion: number
  appVersion: string
  exportedAt: string
  includesPhotos: boolean
  data: Partial<Record<BackupTable, unknown[]>>
}

type AnyRec = Record<string, unknown> & { id: string; updatedAt?: number }

// ---------------------------------------------------------------- exportar

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!m) throw new Error('Fotografia inválida no ficheiro.')
  const mime = m[1] || 'application/octet-stream'
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: mime })
  const bin = atob(m[3])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function exportBackup(opts: { includePhotos?: boolean } = {}): Promise<BackupFile> {
  const includePhotos = opts.includePhotos ?? true
  const data: BackupFile['data'] = {}
  for (const t of BACKUP_TABLES) {
    if (t === 'photos') continue
    data[t] = await (db[t] as unknown as { toArray(): Promise<unknown[]> }).toArray()
  }
  if (includePhotos) {
    const photos = await db.photos.toArray()
    data.photos = await Promise.all(
      photos.map(async (p) => ({ id: p.id, date: p.date, mime: p.mime, note: p.note, updatedAt: p.updatedAt, dataUrl: await blobToDataUrl(p.blob) })),
    )
  } else {
    data.photos = []
  }
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    includesPhotos: includePhotos,
    data,
  }
}

export function backupFileName(date: string): string {
  return `winter-arc-backup-${date}.json`
}

// ---------------------------------------------------------------- validar

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  file?: BackupFile
  summary: Partial<Record<BackupTable, number>>
  schemaVersion?: number
}

/** Migrações entre versões do esquema (cada passo converte N -> N+1). */
const MIGRATIONS: Record<number, (f: BackupFile) => BackupFile> = {
  // exemplo futuro: 1: (f) => ({ ...f, schemaVersion: 2, data: {...} })
}

export function migrateBackup(file: BackupFile): BackupFile {
  let f = file
  while (f.schemaVersion < BACKUP_SCHEMA_VERSION) {
    const step = MIGRATIONS[f.schemaVersion]
    if (!step) throw new Error(`Não existe migração a partir da versão ${f.schemaVersion}.`)
    f = step(f)
  }
  return f
}

const SESSION_STATUS = new Set(['active', 'completed', 'partial'])
const DATE_TABLES: BackupTable[] = ['bodyLogs', 'dayLogs', 'recovery', 'assessments', 'meals', 'schedule', 'sessions', 'photos']

export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const summary: ValidationResult['summary'] = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['O ficheiro não é um objeto JSON válido.'], warnings, summary }
  }
  const o = raw as Record<string, unknown>
  if (o.app !== BACKUP_APP) {
    return { ok: false, errors: ['Este ficheiro não é uma cópia de segurança do Winter Arc.'], warnings, summary }
  }
  const v = o.schemaVersion
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return { ok: false, errors: ['Versão do esquema em falta ou inválida.'], warnings, summary }
  }
  if (v > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Ficheiro criado por uma versão mais recente da aplicação (esquema ${v}). Atualiza a aplicação antes de importar.`],
      warnings,
      summary,
      schemaVersion: v,
    }
  }
  const data = o.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['O ficheiro não contém a secção "data".'], warnings, summary, schemaVersion: v }
  }
  const d = data as Record<string, unknown>
  for (const key of Object.keys(d)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(key)) warnings.push(`Secção desconhecida ignorada: ${key}`)
  }
  for (const t of BACKUP_TABLES) {
    const rows = d[t]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) {
      errors.push(`A secção "${t}" deve ser uma lista.`)
      continue
    }
    summary[t] = rows.length
    const seen = new Set<string>()
    rows.forEach((r, i) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) {
        errors.push(`${t}[${i}]: registo inválido.`)
        return
      }
      const rec = r as Record<string, unknown>
      if (typeof rec.id !== 'string' || !rec.id) {
        errors.push(`${t}[${i}]: falta o identificador (id).`)
        return
      }
      if (seen.has(rec.id)) warnings.push(`${t}: identificador repetido "${rec.id}" (será usado o último).`)
      seen.add(rec.id)
      if (DATE_TABLES.includes(t) && 'date' in rec && !isValidISO(rec.date)) errors.push(`${t}[${i}]: data inválida (${String(rec.date)}).`)
      if (t === 'sessions') {
        if (!Array.isArray(rec.exercises)) errors.push(`sessions[${i}]: falta a lista de exercícios.`)
        if (typeof rec.startedAt !== 'number') errors.push(`sessions[${i}]: hora de início inválida.`)
        if (!SESSION_STATUS.has(String(rec.status))) errors.push(`sessions[${i}]: estado inválido.`)
      }
      if (t === 'photos' && typeof rec.dataUrl !== 'string') errors.push(`photos[${i}]: fotografia sem conteúdo.`)
      if (t === 'meals') for (const k of ['kcal', 'protein', 'carbs', 'fat']) if (typeof rec[k] !== 'number' || !Number.isFinite(rec[k] as number)) errors.push(`meals[${i}]: valor inválido em ${k}.`)
    })
  }
  if (errors.length > 20) {
    const n = errors.length
    errors.splice(20, n - 20, `… e mais ${n - 20} erro(s).`)
  }
  if (errors.length) return { ok: false, errors, warnings, summary, schemaVersion: v }
  let file = raw as unknown as BackupFile
  if (v < BACKUP_SCHEMA_VERSION) {
    try {
      file = migrateBackup(file)
      warnings.push(`O ficheiro foi convertido do esquema ${v} para ${BACKUP_SCHEMA_VERSION}.`)
    } catch (e) {
      return { ok: false, errors: [(e as Error).message], warnings, summary, schemaVersion: v }
    }
  }
  return { ok: true, errors, warnings, file, summary, schemaVersion: v }
}

export function parseBackupText(text: string): ValidationResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['O ficheiro não é JSON válido (pode estar corrompido ou incompleto).'], warnings: [], summary: {} }
  }
  return validateBackup(raw)
}

// ---------------------------------------------------------------- planear / importar

export type ImportMode = 'merge' | 'replace'

export interface ImportPlan {
  mode: ImportMode
  perTable: Partial<Record<BackupTable, { add: number; update: number; skip: number; remove: number }>>
  totals: { add: number; update: number; skip: number; remove: number }
  notes: string[]
}

function tableOf(t: BackupTable) {
  return db[t] as unknown as {
    toArray(): Promise<AnyRec[]>
    bulkPut(rows: unknown[]): Promise<unknown>
    clear(): Promise<void>
    count(): Promise<number>
  }
}

export async function planImport(file: BackupFile, mode: ImportMode): Promise<ImportPlan> {
  const perTable: ImportPlan['perTable'] = {}
  const totals = { add: 0, update: 0, skip: 0, remove: 0 }
  const notes: string[] = []
  for (const t of BACKUP_TABLES) {
    const incoming = (file.data[t] ?? []) as AnyRec[]
    if (t === 'photos' && !file.includesPhotos && mode === 'replace') {
      perTable[t] = { add: 0, update: 0, skip: 0, remove: 0 }
      notes.push('A cópia não inclui fotografias: as fotografias atuais serão mantidas.')
      continue
    }
    const existing = new Map((await tableOf(t).toArray()).map((r) => [r.id, r]))
    const row = { add: 0, update: 0, skip: 0, remove: 0 }
    if (mode === 'replace') {
      row.remove = existing.size
      row.add = incoming.length
    } else {
      for (const r of incoming) {
        const cur = existing.get(r.id)
        if (!cur) row.add++
        else if (t === 'settings') row.skip++
        else if ((r.updatedAt ?? 0) > (cur.updatedAt ?? 0)) row.update++
        else row.skip++
      }
    }
    perTable[t] = row
    totals.add += row.add
    totals.update += row.update
    totals.skip += row.skip
    totals.remove += row.remove
  }
  if (mode === 'replace') notes.push('Substituir apaga os dados atuais (exceto fotografias, se a cópia não as incluir) antes de importar.')
  else notes.push('Fundir mantém os dados atuais e acrescenta os que faltam; em conflito prevalece o registo mais recente. Não cria duplicados.')
  return { mode, perTable, totals, notes }
}

export interface ImportResult {
  plan: ImportPlan
}

export async function importBackup(file: BackupFile, mode: ImportMode): Promise<ImportResult> {
  const plan = await planImport(file, mode)
  const tables = BACKUP_TABLES.map((t) => db[t])
  await db.transaction('rw', tables, async () => {
    const activeNow = await db.sessions.where('status').equals('active').first()
    for (const t of BACKUP_TABLES) {
      let rows = ((file.data[t] ?? []) as AnyRec[]).slice()
      if (t === 'photos') {
        if (mode === 'replace' && !file.includesPhotos) continue
        rows = rows.map((r) => ({
          id: r.id,
          date: r.date,
          mime: r.mime,
          note: r.note,
          updatedAt: r.updatedAt ?? Date.now(),
          blob: dataUrlToBlob(String(r.dataUrl)),
        })) as unknown as AnyRec[]
      }
      const table = tableOf(t)
      if (mode === 'replace') {
        await table.clear()
        await table.bulkPut(rows)
        continue
      }
      const existing = new Map((await table.toArray()).map((r) => [r.id, r]))
      const toPut: AnyRec[] = []
      for (const r of rows) {
        const cur = existing.get(r.id)
        if (!cur) toPut.push(r)
        else if (t === 'settings') continue
        else if ((r.updatedAt ?? 0) > (cur.updatedAt ?? 0)) toPut.push(r)
      }
      if (t === 'sessions') {
        for (const r of toPut) {
          // só pode existir uma sessão ativa
          if (r.status === 'active' && activeNow && activeNow.id !== r.id) {
            r.status = 'partial'
            r.endedAt = (r.updatedAt as number) ?? Date.now()
          }
        }
      }
      if (toPut.length) await table.bulkPut(toPut)
    }
  })
  // depois de importar (ex.: cópia antiga com o plano anterior), garante o programa atual sem apagar nada
  await db.transaction('rw', db.settings, db.templates, async () => {
    await applyProgramV2()
  })
  return { plan }
}

export const TABLE_LABEL: Record<BackupTable, string> = {
  settings: 'Definições',
  templates: 'Treinos (plano)',
  sessions: 'Sessões de treino',
  schedule: 'Alterações de calendário',
  bodyLogs: 'Registos corporais',
  photos: 'Fotografias',
  foods: 'Alimentos',
  savedMeals: 'Refeições guardadas',
  meals: 'Refeições registadas',
  dayLogs: 'Hidratação / suplementos / descanso',
  recovery: 'Recuperação',
  assessments: 'Testes de performance',
  customExercises: 'Exercícios personalizados',
  exerciseMeta: 'Favoritos / notas de exercícios',
}
