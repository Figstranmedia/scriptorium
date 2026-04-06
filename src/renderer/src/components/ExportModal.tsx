import React, { useState } from 'react'
import { generatePrintHTML, DEFAULT_PDF_OPTIONS, type PDFOptions } from '../lib/printHTML'
import type { Document, CitationStyle } from '../store/useStore'

interface Props {
  document: Document
  onClose: () => void
}

const PAGE_SIZES = ['A4', 'Letter', 'A5', 'Legal'] as const
const CITATION_STYLES: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7ª ed.' },
  { id: 'mla', label: 'MLA 9ª ed.' },
  { id: 'chicago', label: 'Chicago 17ª' },
  { id: 'ieee', label: 'IEEE' },
]

export function ExportModal({ document, onClose }: Props) {
  const [opts, setOpts] = useState<PDFOptions>({
    ...DEFAULT_PDF_OPTIONS,
    citationStyle: document.citationStyle || 'apa',
  })
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string; filePath?: string } | null>(null)

  const set = <K extends keyof PDFOptions>(k: K, v: PDFOptions[K]) =>
    setOpts(prev => ({ ...prev, [k]: v }))

  const handleExport = async () => {
    setExporting(true)
    setResult(null)
    const html = generatePrintHTML(document, opts)
    const res = await window.api.exportPDF(html, document.title)
    setExporting(false)
    if (res?.canceled) { onClose(); return }
    setResult(res)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-ink-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-sans font-semibold">Exportar a PDF</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Page size */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-2">Tamaño de página</label>
            <div className="flex gap-2">
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => set('pageSize', s)}
                  className={`flex-1 py-1.5 rounded text-xs font-sans border transition ${opts.pageSize === s ? 'border-accent-400 bg-accent-50 text-accent-700 font-semibold' : 'border-ink-200 text-ink-500 hover:border-ink-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Margins */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-2">Márgenes (mm)</label>
            <div className="grid grid-cols-4 gap-2">
              {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((k, i) => (
                <div key={k} className="text-center">
                  <input type="number" min={10} max={60} value={opts[k]}
                    onChange={(e) => set(k, Number(e.target.value))}
                    className="w-full text-center text-sm px-1 py-1.5 border border-ink-200 rounded outline-none focus:border-accent-400 font-sans" />
                  <span className="text-[10px] text-ink-400 font-sans">{['Sup', 'Der', 'Inf', 'Izq'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Citation style */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-2">
              Estilo de bibliografía
              {(document.references?.length || 0) > 0 && (
                <span className="ml-2 text-ink-400 font-normal">({document.references!.length} referencia{document.references!.length !== 1 ? 's' : ''})</span>
              )}
            </label>
            <div className="flex gap-2 flex-wrap">
              {CITATION_STYLES.map(s => (
                <button key={s.id} onClick={() => set('citationStyle', s.id)}
                  className={`px-3 py-1.5 rounded text-xs font-sans border transition ${opts.citationStyle === s.id ? 'border-accent-400 bg-accent-50 text-accent-700 font-semibold' : 'border-ink-200 text-ink-500 hover:border-ink-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page numbers */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-sans font-semibold text-ink-600">Numeración de páginas</label>
            <button
              onClick={() => set('includePageNumbers', !opts.includePageNumbers)}
              className={`relative w-10 h-5 rounded-full transition ${opts.includePageNumbers ? 'bg-accent-500' : 'bg-ink-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${opts.includePageNumbers ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Result */}
          {result?.success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs font-sans text-emerald-700">
              ✓ PDF exportado correctamente
              <p className="text-emerald-500 mt-0.5 font-mono truncate">{result.filePath}</p>
            </div>
          )}
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs font-sans text-red-700">
              ✗ {result.error}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-sans text-ink-500 hover:bg-ink-50 transition">
            {result?.success ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result?.success && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-5 py-2 rounded-lg text-sm font-sans text-white bg-accent-500 hover:bg-accent-600 transition font-semibold disabled:opacity-60"
            >
              {exporting ? 'Exportando...' : '⬇ Exportar PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
