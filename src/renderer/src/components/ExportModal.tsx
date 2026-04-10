import React, { useState } from 'react'
import {
  generatePrintHTML,
  generateLayoutPrintHTML,
  generateLayoutSVGPages,
  DEFAULT_PDF_OPTIONS,
  DEFAULT_LAYOUT_EXPORT_OPTIONS,
  type PDFOptions,
  type LayoutExportOptions,
} from '../lib/printHTML'
import { mmToPx } from './Layout/LayoutPage'
import type { Document, CitationStyle } from '../store/useStore'
import type { AnyLayoutFrame } from '../lib/threadEngine'
import { isImageFrame } from '../lib/threadEngine'
import { framesToDocxData } from '../lib/docxExport'

interface Props {
  document: Document
  onClose: () => void
}

type ExportTab = 'write' | 'layout'
type ExportFormat = 'pdf' | 'png' | 'svg' | 'docx'

const PAGE_SIZES = ['A4', 'Letter', 'A5', 'Legal'] as const
const CITATION_STYLES: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7ª' },
  { id: 'mla', label: 'MLA 9ª' },
  { id: 'chicago', label: 'Chicago 17ª' },
  { id: 'ieee', label: 'IEEE' },
]

// Build per-page HTML for PNG export (one HTML string per page)
function buildPageHTMLs(
  doc: Document,
  opts: LayoutExportOptions
): Array<{ html: string; widthPx: number; heightPx: number }> {
  const frames    = (doc.layoutFrames  || []) as AnyLayoutFrame[]
  const pageCount = doc.layoutPageCount || 1
  const sizeKey   = doc.layoutPageSize  || 'A4'
  const PAGE_DIMS: Record<string, { widthMM: number; heightMM: number }> = {
    A4:     { widthMM: 210, heightMM: 297 },
    Letter: { widthMM: 216, heightMM: 279 },
    A5:     { widthMM: 148, heightMM: 210 },
    Legal:  { widthMM: 216, heightMM: 356 },
  }
  const { widthMM, heightMM } = PAGE_DIMS[sizeKey] ?? PAGE_DIMS.A4
  const widthPx  = Math.round(mmToPx(widthMM))
  const heightPx = Math.round(mmToPx(heightMM))

  function pxToMm(px: number) { return (px * 25.4) / 96 }
  function resolveFont(family: string) {
    if (family === 'serif') return 'Georgia, serif'
    if (family === 'sans')  return 'Arial, sans-serif'
    if (family === 'mono')  return '"Courier New", monospace'
    return `"${family}", serif`
  }

  return Array.from({ length: pageCount }, (_, i) => {
    const pFrames = [...frames.filter(f => f.pageIndex === i)]
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

    const framesHTML = pFrames.map(f => {
      const x = pxToMm(f.x).toFixed(3)
      const y = pxToMm(f.y).toFixed(3)
      const w = pxToMm(f.width).toFixed(3)
      const h = pxToMm(f.height).toFixed(3)
      const r = pxToMm(f.cornerRadius ?? 0).toFixed(3)

      if (isImageFrame(f)) {
        const bdr = f.borderWidth > 0 ? `border:${pxToMm(f.borderWidth).toFixed(2)}mm solid ${f.borderColor};` : ''
        return `<div style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;overflow:hidden;border-radius:${r}mm;opacity:${f.opacity};${bdr}"><img src="${f.src}" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
      }

      const tf = f as any
      const bg  = tf.backgroundColor && tf.backgroundColor !== 'transparent' ? `background:${tf.backgroundColor};` : ''
      const bdr = tf.borderWidth > 0 ? `border:${pxToMm(tf.borderWidth).toFixed(2)}mm solid ${tf.borderColor};` : ''
      return `<div style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;overflow:hidden;font-family:${resolveFont(tf.fontFamily)};font-size:${tf.fontSize}pt;line-height:${tf.lineHeight};font-weight:${tf.fontWeight};font-style:${tf.fontStyle};text-align:${tf.textAlign};color:${tf.textColor};padding:${pxToMm(tf.paddingTop??4).toFixed(2)}mm ${pxToMm(tf.paddingRight??6).toFixed(2)}mm ${pxToMm(tf.paddingBottom??4).toFixed(2)}mm ${pxToMm(tf.paddingLeft??6).toFixed(2)}mm;border-radius:${r}mm;opacity:${tf.opacity??1};${bg}${bdr}">${tf.ownContent||''}</div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>@page{size:${widthMM}mm ${heightMM}mm;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{margin:0;padding:0;background:white;width:${widthMM}mm;height:${heightMM}mm;overflow:hidden}</style></head><body><div style="position:relative;width:${widthMM}mm;height:${heightMM}mm;background:white;overflow:hidden;">${framesHTML}</div></body></html>`

    return { html, widthPx, heightPx }
  })
}

export function ExportModal({ document, onClose }: Props) {
  // Auto-select tab: layout if doc has layout frames
  const hasLayout = (document.layoutFrames?.length ?? 0) > 0
  const [tab, setTab] = useState<ExportTab>(hasLayout ? 'layout' : 'write')
  const [format, setFormat] = useState<ExportFormat>('pdf')

  // Write mode opts
  const [opts, setOpts] = useState<PDFOptions>({
    ...DEFAULT_PDF_OPTIONS,
    citationStyle: document.citationStyle || 'apa',
  })

  // Layout mode opts
  const [layoutOpts, setLayoutOpts] = useState<LayoutExportOptions>({
    ...DEFAULT_LAYOUT_EXPORT_OPTIONS,
  })

  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string; filePath?: string; paths?: string[]; count?: number } | null>(null)

  const setOpt = <K extends keyof PDFOptions>(k: K, v: PDFOptions[K]) =>
    setOpts(prev => ({ ...prev, [k]: v }))
  const setLOpt = <K extends keyof LayoutExportOptions>(k: K, v: LayoutExportOptions[K]) =>
    setLayoutOpts(prev => ({ ...prev, [k]: v }))

  const handleExportWrite = async () => {
    setExporting(true)
    setResult(null)
    const html = generatePrintHTML(document, opts)
    const res = await window.api.exportPDF(html, document.title)
    setExporting(false)
    if (res?.canceled) { onClose(); return }
    setResult(res)
  }

  const handleExportLayout = async () => {
    setExporting(true)
    setResult(null)

    if (format === 'pdf') {
      const html = generateLayoutPrintHTML(document, layoutOpts)
      const res = await window.api.exportLayoutPDF(html, document.title)
      setExporting(false)
      if (res?.canceled) { onClose(); return }
      setResult(res)
    } else if (format === 'png') {
      const pages = buildPageHTMLs(document, layoutOpts)
      const res = await window.api.exportPNGPages(pages, document.title)
      setExporting(false)
      if (res?.canceled) { onClose(); return }
      setResult(res)
    } else if (format === 'docx') {
      // DOCX export
      const framesData = framesToDocxData((document.layoutFrames || []) as AnyLayoutFrame[])
      const res = await window.api.exportDocx(framesData, document.title)
      setExporting(false)
      if (res?.canceled) { onClose(); return }
      setResult(res)
    } else {
      // SVG / Affinity Designer
      const svgPages = generateLayoutSVGPages(document)
      const res = await window.api.exportLayoutSVG(svgPages, document.title)
      setExporting(false)
      if (res?.canceled) { onClose(); return }
      setResult(res)
    }
  }

  const isLayout = tab === 'layout'
  const pageCount = document.layoutPageCount || 0
  const pageSizeName = document.layoutPageSize || 'A4'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
           style={{ background: '#1e1f22', border: '1px solid #3a3a40' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5"
             style={{ background: '#18181b', borderBottom: '1px solid #2e2e34' }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white font-sans">Exportar</span>
            {/* Tabs */}
            <div className="flex gap-1 ml-2">
              {(['write', 'layout'] as ExportTab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); setResult(null) }}
                  className="px-3 py-1 rounded text-xs font-sans transition"
                  style={{
                    background: tab === t ? '#3a3a80' : 'transparent',
                    color: tab === t ? '#a5b4fc' : '#888',
                    border: tab === t ? '1px solid #4f4fa8' : '1px solid transparent',
                  }}>
                  {t === 'write' ? '✍ Texto' : '🗂 Maquetación'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className="text-lg leading-none transition"
            style={{ color: '#666' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#666')}>×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Write mode ─────────────────────────────────────────────── */}
          {!isLayout && <>
            {/* Page size */}
            <div>
              <label className="block text-xs font-sans font-semibold mb-2" style={{ color: '#9ca3af' }}>
                Tamaño de página
              </label>
              <div className="flex gap-2">
                {PAGE_SIZES.map(s => (
                  <button key={s} onClick={() => setOpt('pageSize', s)}
                    className="flex-1 py-1.5 rounded text-xs font-sans transition"
                    style={{
                      background: opts.pageSize === s ? '#2d2d60' : '#2a2a2e',
                      color: opts.pageSize === s ? '#a5b4fc' : '#9ca3af',
                      border: opts.pageSize === s ? '1px solid #4f4fa8' : '1px solid #3a3a40',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Margins */}
            <div>
              <label className="block text-xs font-sans font-semibold mb-2" style={{ color: '#9ca3af' }}>
                Márgenes (mm)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((k, i) => (
                  <div key={k} className="text-center">
                    <input type="number" min={10} max={60} value={opts[k]}
                      onChange={e => setOpt(k, Number(e.target.value))}
                      className="w-full text-center text-sm px-1 py-1.5 rounded outline-none font-sans"
                      style={{ background: '#2a2a2e', border: '1px solid #3a3a40', color: '#e2e2e6' }} />
                    <span className="text-[10px] font-sans" style={{ color: '#6b7280' }}>
                      {['Sup', 'Der', 'Inf', 'Izq'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Citation style */}
            <div>
              <label className="block text-xs font-sans font-semibold mb-2" style={{ color: '#9ca3af' }}>
                Bibliografía
                {(document.references?.length || 0) > 0 && (
                  <span className="ml-2 font-normal" style={{ color: '#6b7280' }}>
                    ({document.references!.length} ref.)
                  </span>
                )}
              </label>
              <div className="flex gap-2 flex-wrap">
                {CITATION_STYLES.map(s => (
                  <button key={s.id} onClick={() => setOpt('citationStyle', s.id)}
                    className="px-3 py-1.5 rounded text-xs font-sans transition"
                    style={{
                      background: opts.citationStyle === s.id ? '#2d2d60' : '#2a2a2e',
                      color: opts.citationStyle === s.id ? '#a5b4fc' : '#9ca3af',
                      border: opts.citationStyle === s.id ? '1px solid #4f4fa8' : '1px solid #3a3a40',
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Page numbers toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans font-semibold" style={{ color: '#9ca3af' }}>
                Numeración de páginas
              </span>
              <button
                onClick={() => setOpt('includePageNumbers', !opts.includePageNumbers)}
                className="relative w-9 h-5 rounded-full transition"
                style={{ background: opts.includePageNumbers ? '#4f4fa8' : '#3a3a40' }}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${opts.includePageNumbers ? 'left-4' : 'left-0.5'}`} />
              </button>
            </div>
          </>}

          {/* ── Layout mode ────────────────────────────────────────────── */}
          {isLayout && <>
            {/* Info row */}
            <div className="rounded-lg p-3 flex items-center gap-3"
                 style={{ background: '#2a2a2e', border: '1px solid #3a3a40' }}>
              <div className="text-2xl">🗂</div>
              <div>
                <p className="text-xs font-sans font-semibold" style={{ color: '#e2e2e6' }}>
                  Maquetación — {pageSizeName}
                </p>
                <p className="text-xs font-sans mt-0.5" style={{ color: '#9ca3af' }}>
                  {pageCount} {pageCount === 1 ? 'página' : 'páginas'} ·{' '}
                  {(document.layoutFrames?.length ?? 0)} marcos
                </p>
              </div>
            </div>

            {/* Format selector */}
            <div>
              <label className="block text-xs font-sans font-semibold mb-2" style={{ color: '#9ca3af' }}>
                Formato de exportación
              </label>
              <div className="flex gap-2">
                {([
                  { id: 'pdf',  label: '📄 PDF' },
                  { id: 'png',  label: '🖼 PNG' },
                  { id: 'svg',  label: '🎨 SVG' },
                  { id: 'docx', label: '📝 DOCX' },
                ] as { id: ExportFormat; label: string }[]).map(f => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    className="flex-1 py-2 rounded text-xs font-sans transition"
                    style={{
                      background: format === f.id ? '#2d2d60' : '#2a2a2e',
                      color: format === f.id ? '#a5b4fc' : '#9ca3af',
                      border: format === f.id ? '1px solid #4f4fa8' : '1px solid #3a3a40',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
              {format === 'png' && (
                <p className="mt-1.5 text-xs font-sans" style={{ color: '#6b7280' }}>
                  Exporta cada página como imagen independiente (alta resolución).
                </p>
              )}
              {format === 'svg' && (
                <p className="mt-1.5 text-xs font-sans" style={{ color: '#6b7280' }}>
                  SVG vectorial compatible con Affinity Designer 2. Formas y gráficos como capas editables.
                </p>
              )}
              {format === 'docx' && (
                <p className="mt-1.5 text-xs font-sans" style={{ color: '#6b7280' }}>
                  Word / LibreOffice. Exporta el texto de los marcos de texto en orden de lectura (página, posición vertical).
                </p>
              )}
            </div>

            {/* Bleed marks (PDF only) */}
            {format === 'pdf' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-sans font-semibold" style={{ color: '#9ca3af' }}>
                      Marcas de corte (sangría)
                    </span>
                    <p className="text-[10px] font-sans mt-0.5" style={{ color: '#6b7280' }}>
                      Para impresión profesional
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !layoutOpts.cropMarks
                      setLOpt('cropMarks', next)
                      if (next && layoutOpts.bleedMM === 0) setLOpt('bleedMM', 3)
                      if (!next) setLOpt('bleedMM', 0)
                    }}
                    className="relative w-9 h-5 rounded-full transition"
                    style={{ background: layoutOpts.cropMarks ? '#4f4fa8' : '#3a3a40' }}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${layoutOpts.cropMarks ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>

                {layoutOpts.cropMarks && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-sans" style={{ color: '#9ca3af' }}>
                      Sangría (mm)
                    </label>
                    <input
                      type="number" min={1} max={10} step={0.5}
                      value={layoutOpts.bleedMM}
                      onChange={e => setLOpt('bleedMM', Number(e.target.value))}
                      className="w-16 text-center text-sm px-2 py-1 rounded outline-none font-sans"
                      style={{ background: '#2a2a2e', border: '1px solid #3a3a40', color: '#e2e2e6' }}
                    />
                    <span className="text-xs font-sans" style={{ color: '#6b7280' }}>
                      Estándar: 3 mm
                    </span>
                  </div>
                )}
              </div>
            )}
          </>}

          {/* Result */}
          {result?.success && (
            <div className="rounded-lg p-3 text-xs font-sans"
                 style={{ background: '#162316', border: '1px solid #2d5a2d', color: '#86efac' }}>
              {format === 'png' && result.count
                ? `✓ ${result.count} PNG${result.count !== 1 ? 's' : ''} exportado${result.count !== 1 ? 's' : ''}`
                : format === 'svg' && result.count
                  ? `✓ ${result.count} SVG${result.count !== 1 ? 's' : ''} exportado${result.count !== 1 ? 's' : ''}`
                  : '✓ Exportado correctamente'}
              {result.filePath && (
                <p className="mt-0.5 font-mono truncate" style={{ color: '#4ade80', opacity: 0.7 }}>
                  {result.filePath}
                </p>
              )}
            </div>
          )}
          {result?.error && (
            <div className="rounded-lg p-3 text-xs font-sans"
                 style={{ background: '#2a1010', border: '1px solid #5a2d2d', color: '#fca5a5' }}>
              ✗ {result.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-3"
             style={{ borderTop: '1px solid #2e2e34', paddingTop: '1rem' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-sans transition"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
            {result?.success ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result?.success && (
            <button
              onClick={isLayout ? handleExportLayout : handleExportWrite}
              disabled={exporting}
              className="px-5 py-2 rounded-lg text-sm font-sans font-semibold transition"
              style={{
                background: exporting ? '#3a3a60' : '#4f4fa8',
                color: exporting ? '#9ca3af' : '#fff',
                opacity: exporting ? 0.7 : 1,
              }}>
              {exporting
                ? 'Exportando…'
                : format === 'png' && isLayout
                  ? `⬇ Exportar ${pageCount} PNG${pageCount !== 1 ? 's' : ''}`
                  : format === 'svg' && isLayout
                    ? `⬇ Exportar ${pageCount} SVG${pageCount !== 1 ? 's' : ''}`
                    : format === 'docx' && isLayout
                      ? '⬇ Exportar DOCX'
                      : '⬇ Exportar PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
