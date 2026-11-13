import { useRef, useState } from 'react'
import { Download, Share2, ShieldAlert, Upload } from 'lucide-react'
import { APP_VERSION, TABLE_LABEL, backupFileName, exportBackup, importBackup, parseBackupText, planImport, type BackupFile, type ImportMode, type ImportPlan, type ValidationResult } from '../lib/backup'
import { formatDateTimePT, todayISO } from '../lib/dates'
import { canShareFiles, downloadFile, shareFile } from '../lib/files'
import { updateSettings } from '../lib/repo'
import { BACKUP_TABLES } from '../lib/types'
import { Confirm, Loading, Notice, PageHeader, Section, Segmented, Toggle, useToast } from '../components/ui'
import { useSnap } from '../hooks/hooks'

export default function Backup() {
  const snap = useSnap()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState(true)
  const [busy, setBusy] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState<ImportMode>('merge')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  if (!snap) return <Loading />
  const last = snap.settings.lastBackupAt

  const doExport = async (share = false) => {
    setBusy(true)
    try {
      const file = await exportBackup({ includePhotos: photos })
      const text = JSON.stringify(file)
      const name = backupFileName(todayISO())
      if (share && canShareFiles()) await shareFile(name, text, 'application/json')
      else downloadFile(name, text, 'application/json')
      await updateSettings({ lastBackupAt: Date.now() })
      toast('Cópia de segurança exportada.')
    } catch (e) {
      toast(`Falha ao exportar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (f: File | undefined) => {
    setResult(null)
    setPlan(null)
    setValidation(null)
    if (!f) return
    setFileName(f.name)
    const text = await f.text()
    const v = parseBackupText(text)
    setValidation(v)
    if (v.ok && v.file) setPlan(await planImport(v.file, mode))
  }

  const changeMode = async (m: ImportMode) => {
    setMode(m)
    if (validation?.ok && validation.file) setPlan(await planImport(validation.file, m))
  }

  const runImport = async () => {
    if (!validation?.file) return
    setBusy(true)
    try {
      const r = await importBackup(validation.file as BackupFile, mode)
      setResult(`Importação concluída (${mode === 'merge' ? 'fusão' : 'substituição'}): ${r.plan.totals.add} adicionados, ${r.plan.totals.update} atualizados, ${r.plan.totals.skip} ignorados (já existiam).`)
      setValidation(null)
      setPlan(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      toast(`A importação falhou e nada foi alterado: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }

  return (
    <div>
      <PageHeader title="Cópia de segurança" subtitle="Exportar e restaurar todos os teus dados" back />

      <Notice tone="warn" title="Os dados ficam apenas neste navegador">
        Se o armazenamento do Safari/navegador for limpo (ou se desinstalares a app), a base de dados perde-se. Exporta uma cópia regularmente e guarda-a no iCloud Drive, e-mail ou outro local seguro.
      </Notice>

      <Section title="Exportar">
        <div className="card space-y-3 p-4">
          <p className="text-sm text-muted">
            {last ? `Última cópia: ${formatDateTimePT(last)}.` : 'Ainda não fizeste nenhuma cópia de segurança.'} Ficheiro JSON versionado (esquema 1, app {APP_VERSION}) com sessões, plano, corpo, nutrição, recuperação, performance e definições.
          </p>
          <Toggle checked={photos} onChange={setPhotos} label="Incluir fotografias de progresso" hint="Aumenta o tamanho do ficheiro." />
          <button data-testid="export-backup" className="btn-primary w-full" disabled={busy} onClick={() => doExport(false)}>
            <Download size={18} /> Exportar cópia de segurança
          </button>
          {canShareFiles() && (
            <button className="btn-soft w-full" disabled={busy} onClick={() => doExport(true)}>
              <Share2 size={18} /> Partilhar / guardar em Ficheiros
            </button>
          )}
        </div>
      </Section>

      <Section title="Importar">
        <div className="card space-y-3 p-4">
          <input ref={fileRef} data-testid="import-file" type="file" accept="application/json,.json" className="sr-only" id="import-input" onChange={(e) => onFile(e.target.files?.[0])} />
          <label htmlFor="import-input" className="btn-soft w-full cursor-pointer">
            <Upload size={18} /> Escolher ficheiro de cópia de segurança
          </label>
          {fileName && <p className="text-xs text-muted">Ficheiro: {fileName}</p>}

          {validation && !validation.ok && (
            <div data-testid="import-errors">
              <Notice tone="danger" title="Ficheiro inválido — nada foi alterado">
                <ul className="list-disc space-y-1 pl-5">
                  {validation.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}

          {validation?.ok && plan && (
            <div className="space-y-3" data-testid="import-summary">
              <p className="font-semibold text-accent">Ficheiro válido ✓</p>
              {validation.warnings.length > 0 && (
                <Notice tone="warn">
                  <ul className="list-disc pl-5">
                    {validation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              )}
              <p className="text-xs text-muted">
                Exportado em {validation.file?.exportedAt ? formatDateTimePT(Date.parse(validation.file.exportedAt)) : '—'} · esquema {validation.schemaVersion} · {validation.file?.includesPhotos ? 'com' : 'sem'} fotografias
              </p>
              <Segmented<ImportMode>
                value={mode}
                onChange={changeMode}
                label="Modo de importação"
                options={[{ value: 'merge', label: 'Fundir (recomendado)', testId: 'mode-merge' }, { value: 'replace', label: 'Substituir', testId: 'mode-replace' }]}
              />
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="num w-full text-sm">
                  <thead>
                    <tr className="bg-surface2 text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">Dados</th>
                      <th className="font-medium">No ficheiro</th>
                      <th className="font-medium">Novos</th>
                      <th className="pr-3 text-right font-medium">{mode === 'replace' ? 'A apagar' : 'Atualizar'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BACKUP_TABLES.filter((t) => (validation.summary[t] ?? 0) > 0 || (plan.perTable[t]?.remove ?? 0) > 0).map((t) => (
                      <tr key={t} className="border-t border-line">
                        <td className="px-3 py-2">{TABLE_LABEL[t]}</td>
                        <td>{validation.summary[t] ?? 0}</td>
                        <td>{plan.perTable[t]?.add ?? 0}</td>
                        <td className="pr-3 text-right">{mode === 'replace' ? plan.perTable[t]?.remove ?? 0 : plan.perTable[t]?.update ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.notes.map((n, i) => (
                <p key={i} className="text-xs text-muted">
                  {n}
                </p>
              ))}
              {mode === 'replace' && (
                <Notice tone="danger" title="Substituir apaga os dados atuais">
                  <span className="flex items-start gap-2"><ShieldAlert size={16} className="mt-0.5 shrink-0" /> Exporta primeiro uma cópia dos dados atuais se tiveres dúvidas.</span>
                </Notice>
              )}
              <button data-testid="import-confirm" className={mode === 'replace' ? 'btn-danger w-full' : 'btn-primary w-full'} disabled={busy} onClick={() => setConfirm(true)}>
                {mode === 'replace' ? 'Substituir dados…' : 'Importar (fundir)…'}
              </button>
            </div>
          )}
          {result && (
            <div data-testid="import-result">
              <Notice tone="info" title="Concluído ✓">
                {result}
              </Notice>
            </div>
          )}
        </div>
      </Section>

      <Confirm
        open={confirm}
        danger={mode === 'replace'}
        title={mode === 'replace' ? 'Substituir todos os dados?' : 'Importar e fundir dados?'}
        message={
          plan
            ? mode === 'replace'
              ? `Serão apagados ${plan.totals.remove} registos atuais e importados ${plan.totals.add} do ficheiro. Esta ação não pode ser anulada.`
              : `Serão adicionados ${plan.totals.add} registos novos e atualizados ${plan.totals.update}. Os dados existentes não são apagados.`
            : ''
        }
        confirmLabel={mode === 'replace' ? 'Substituir' : 'Importar'}
        onCancel={() => setConfirm(false)}
        onConfirm={runImport}
      />
    </div>
  )
}
