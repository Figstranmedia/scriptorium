import React, { useState, useMemo } from 'react'
import type { CoverConfig } from '../../store/useStore'
import { BOOK_FORMATS, PAPER_THICKNESS_MM } from '../../store/useStore'

interface Props {
  onClose: () => void
  onCreate: (config: CoverConfig) => void
}

export function CoverSetupModal({ onClose, onCreate }: Props) {
  const [formatId, setFormatId] = useState('14x21')
  const [customW, setCustomW] = useState(148)
  const [customH, setCustomH] = useState(210)
  const [pageCount, setPageCount] = useState(200)
  const [paperWeight, setPaperWeight] = useState<80 | 90 | 115>(80)
  const [bleedMM, setBleedMM] = useState(3)

  const format = BOOK_FORMATS.find(f => f.id === formatId) || BOOK_FORMATS[0]
  const coverWidthMM  = formatId === 'custom' ? customW : format.widthMM
  const coverHeightMM = formatId === 'custom' ? customH : format.heightMM
  const spineMM = +(pageCount * PAPER_THICKNESS_MM[paperWeight]).toFixed(2)
  const totalWidthMM = bleedMM + coverWidthMM + spineMM + coverWidthMM + bleedMM
  const totalHeightMM = bleedMM + coverHeightMM + bleedMM

  function handleCreate() {
    onCreate({
      formatId,
      coverWidthMM,
      coverHeightMM,
      pageCount,
      paperWeight,
      bleedMM,
      spineMM,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-ink-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-sans font-semibold">Configurar portada de libro</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-white text-xl leading-none transition">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Format */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-1">Formato del libro</label>
            <div className="grid grid-cols-2 gap-2">
              {BOOK_FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormatId(f.id)}
                  className={`px-3 py-2 rounded-lg border text-xs font-sans text-left transition ${
                    formatId === f.id
                      ? 'border-accent-400 bg-accent-50 text-accent-700 font-semibold'
                      : 'border-ink-200 hover:border-ink-300 text-ink-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom size */}
          {formatId === 'custom' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-sans text-ink-500 mb-1">Ancho (mm)</label>
                <input
                  type="number" min={50} max={500}
                  value={customW}
                  onChange={e => setCustomW(+e.target.value)}
                  className="w-full border border-ink-200 rounded px-2 py-1 text-sm font-sans focus:outline-none focus:border-accent-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-sans text-ink-500 mb-1">Alto (mm)</label>
                <input
                  type="number" min={50} max={500}
                  value={customH}
                  onChange={e => setCustomH(+e.target.value)}
                  className="w-full border border-ink-200 rounded px-2 py-1 text-sm font-sans focus:outline-none focus:border-accent-400"
                />
              </div>
            </div>
          )}

          {/* Page count */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-1">Número de páginas interiores</label>
            <input
              type="number" min={10} max={2000} step={2}
              value={pageCount}
              onChange={e => setPageCount(Math.max(10, +e.target.value))}
              className="w-full border border-ink-200 rounded px-3 py-2 text-sm font-sans focus:outline-none focus:border-accent-400"
            />
            <p className="text-xs text-ink-400 mt-1">Debe ser un número par (páginas del libro terminado)</p>
          </div>

          {/* Paper weight */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-1">Gramaje del papel interior</label>
            <div className="flex gap-2">
              {([80, 90, 115] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setPaperWeight(w)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-sans transition ${
                    paperWeight === w
                      ? 'border-accent-400 bg-accent-50 text-accent-700 font-semibold'
                      : 'border-ink-200 hover:border-ink-300 text-ink-600'
                  }`}
                >
                  {w} g/m²
                </button>
              ))}
            </div>
          </div>

          {/* Bleed */}
          <div>
            <label className="block text-xs font-sans font-semibold text-ink-600 mb-1">Sangría (bleed)</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={10} step={0.5}
                value={bleedMM}
                onChange={e => setBleedMM(+e.target.value)}
                className="w-24 border border-ink-200 rounded px-3 py-2 text-sm font-sans focus:outline-none focus:border-accent-400"
              />
              <span className="text-xs text-ink-500">mm (estándar: 3 mm)</span>
            </div>
          </div>

          {/* Spine preview */}
          <div className="bg-ink-50 rounded-lg p-4 border border-ink-100">
            <p className="text-xs font-sans font-semibold text-ink-600 mb-2">Cálculo del lomo</p>
            <div className="flex justify-between text-xs font-sans text-ink-500 mb-1">
              <span>{pageCount} páginas × {PAPER_THICKNESS_MM[paperWeight]} mm</span>
              <span className="font-semibold text-ink-800">{spineMM} mm</span>
            </div>
            <div className="flex justify-between text-xs font-sans text-ink-500">
              <span>Extensión total de la portada</span>
              <span className="font-semibold text-ink-800">{totalWidthMM.toFixed(1)} × {totalHeightMM.toFixed(1)} mm</span>
            </div>
            {spineMM < 5 && (
              <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                Lomo muy delgado ({spineMM} mm). Difícil de imprimir texto en el lomo.
              </p>
            )}
          </div>

          {/* Spread mini preview */}
          <div className="flex items-end justify-center gap-0 h-14 overflow-hidden">
            <SpreadPreview
              coverW={coverWidthMM} coverH={coverHeightMM}
              spineW={spineMM} bleed={bleedMM}
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-sans text-ink-500 hover:bg-ink-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 rounded-lg text-sm font-sans text-white bg-accent-500 hover:bg-accent-600 transition font-semibold"
          >
            Crear portada
          </button>
        </div>
      </div>
    </div>
  )
}

function SpreadPreview({ coverW, coverH, spineW, bleed }: { coverW: number; coverH: number; spineW: number; bleed: number }) {
  const scale = 40 / (coverH + bleed * 2)
  const bPx = bleed * scale
  const cWPx = coverW * scale
  const sWPx = Math.max(spineW * scale, 3)
  const cHPx = coverH * scale
  const totalH = (coverH + bleed * 2) * scale

  return (
    <div className="flex items-center" style={{ height: totalH }}>
      {/* bleed left */}
      <div style={{ width: bPx, height: totalH, background: '#fecaca', opacity: 0.8 }} />
      {/* back cover */}
      <div style={{ width: cWPx, height: totalH, background: '#e2e8f0', border: '1px solid #94a3b8', position: 'relative' }}>
        <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 6, color: '#64748b', whiteSpace: 'nowrap' }}>Contraportada</span>
      </div>
      {/* spine */}
      <div style={{ width: sWPx, height: totalH, background: '#c7d2fe', border: '1px solid #818cf8', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', fontSize: 5, color: '#3730a3', whiteSpace: 'nowrap' }}>LOMO</span>
      </div>
      {/* front cover */}
      <div style={{ width: cWPx, height: totalH, background: '#dcfce7', border: '1px solid #4ade80', position: 'relative' }}>
        <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 6, color: '#166534', whiteSpace: 'nowrap' }}>Portada</span>
      </div>
      {/* bleed right */}
      <div style={{ width: bPx, height: totalH, background: '#fecaca', opacity: 0.8 }} />
    </div>
  )
}
