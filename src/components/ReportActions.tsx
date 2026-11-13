import { useState } from 'react'
import { ClipboardCopy, Download, Share2 } from 'lucide-react'
import { canShareFiles, copyText, downloadFile, shareFile } from '../lib/files'
import { Sheet, useToast } from './ui'

/** Botões “COPIAR RELATÓRIO” e “EXPORTAR RELATÓRIO” (texto para colar no ChatGPT). */
export function ReportActions({ text, filename, extra }: { text: string; filename: string; extra?: React.ReactNode }) {
  const toast = useToast()
  const [manual, setManual] = useState(false)
  const copy = async () => {
    if (await copyText(text)) toast('Relatório copiado. Cola-o no ChatGPT.')
    else setManual(true)
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button data-testid="copy-report" className="btn-primary" onClick={copy}>
          <ClipboardCopy size={18} /> COPIAR RELATÓRIO
        </button>
        <button
          data-testid="export-report"
          className="btn-soft"
          onClick={() => {
            downloadFile(filename, text, 'text/plain;charset=utf-8')
            toast('Relatório exportado.')
          }}
        >
          <Download size={18} /> EXPORTAR RELATÓRIO
        </button>
        {canShareFiles() && (
          <button className="btn-ghost col-span-2" onClick={() => shareFile(filename, text, 'text/plain')}>
            <Share2 size={18} /> Partilhar ficheiro
          </button>
        )}
        {extra}
      </div>
      <Sheet open={manual} onClose={() => setManual(false)} title="Copiar manualmente">
        <p className="mb-2 text-sm text-muted">O navegador não permitiu copiar automaticamente. Seleciona o texto abaixo e copia.</p>
        <textarea readOnly className="input min-h-64 py-3 font-mono text-xs" value={text} onFocus={(e) => e.target.select()} aria-label="Texto do relatório" />
      </Sheet>
    </>
  )
}
