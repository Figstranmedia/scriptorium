/**
 * DocumentSetupModal — Configuración del documento (estilo Affinity Publisher).
 * Controla tamaño de página, orientación, márgenes, sangrado y páginas enfrentadas.
 */
import React, { useState } from 'react'
import { PAGE_SIZES, mmToPx } from './Layout/LayoutPage'

export interface DocumentSetup {
  pageSizeKey: string
  customWidthMM: number
  customHeightMM: number
  orientation: 'portrait' | 'landscape'
  pageCount: number
  facingPages: boolean
  marginTopMM: number
  marginBottomMM: number
  marginInnerMM: number
  marginOuterMM: number
  bleedMM: number
}

interface Props {
  setup: DocumentSetup
  onApply: (setup: DocumentSetup) => void
  onClose: () => void
}

const PRESET_SIZES = [
  { key: 'A4',     label: 'A4 (21 × 29.7 cm)',    w: 210, h: 297 },
  { key: 'Letter', label: 'Carta (21.6 × 27.9 cm)', w: 216, h: 279 },
  { key: 'A5',     label: 'A5 (14.8 × 21 cm)',      w: 148, h: 210 },
  { key: 'Legal',  label: 'Legal (21.6 × 35.6 cm)', w: 216, h: 356 },
  { key: 'custom', label: 'Personalizado…',          w: 0,   h: 0   },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <span className="text-xs font-sans" style={{ color: '#9ca3af' }}>{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function MMInput({ value, onChange, min = 0, max = 9999 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={0.1}
        onChange={e => onChange(Math.max(min, Math.min(max, parseFloat(e.target.value) || 0)))}
        className="w-20 text-right rounded px-2 py-1 text-xs outline-none"
        style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.12)', color: '#e4e4e6' }}
      />
      <span className="text-xs" style={{ color: '#6b7280' }}>mm</span>
    </div>
  )
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded text-xs font-sans transition"
      style={{
        background: active ? '#d4522b' : 'rgba(255,255,255,0.06)',
        color: active ? '#fff' : '#9ca3af',
        border: `1px solid ${active ? '#d4522b' : 'rgba(255,255,255,0.1)'}`,
      }}
    >{children}</button>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative rounded-full transition-colors"
      style={{
        width: 36, height: 20,
        background: value ? '#d4522b' : 'rgba(255,255,255,0.15)',
        flexShrink: 0,
      }}
    >
      <div
        className="absolute top-0.5 rounded-full transition-transform"
        style={{
          width: 16, height: 16,
          background: '#fff',
          left: value ? 18 : 2,
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}

// Mini page preview
function PagePreview({ widthMM, heightMM, orientation, facingPages, marginTop, marginBottom, marginInner, marginOuter }: {
  widthMM: number; heightMM: number; orientation: 'portrait' | 'landscape'
  facingPages: boolean
  marginTop: number; marginBottom: number; marginInner: number; marginOuter: number
}) {
  const w = orientation === 'landscape' ? heightMM : widthMM
  const h = orientation === 'landscape' ? widthMM : heightMM
  const scale = Math.min(120 / w, 160 / h)
  const pw = w * scale
  const ph = h * scale

  const mT = marginTop * scale
  const mB = marginBottom * scale
  const mI = marginInner * scale
  const mO = marginOuter * scale

  const SinglePage = ({ left }: { left?: boolean }) => (
    <div style={{
      width: pw, height: ph,
      background: '#fff',
      border: '1px solid rgba(99,102,241,0.5)',
      position: 'relative',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: mT, bottom: mB,
        left: left ? mO : mI,
        right: left ? mI : mO,
        border: '1px dashed rgba(99,102,241,0.4)',
      }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: facingPages ? 2 : 0, alignItems: 'flex-end', justifyContent: 'center' }}>
      {facingPages && <SinglePage left />}
      <SinglePage />
    </div>
  )
}

export function DocumentSetupModal({ setup, onApply, onClose }: Props) {
  const [s, setS] = useState<DocumentSetup>({ ...setup })

  const effectiveW = s.orientation === 'landscape' ? s.customHeightMM : s.customWidthMM
  const effectiveH = s.orientation === 'landscape' ? s.customWidthMM : s.customHeightMM

  const setPreset = (key: string) => {
    const preset = PRESET_SIZES.find(p => p.key === key)
    if (!preset || preset.key === 'custom') {
      setS(prev => ({ ...prev, pageSizeKey: 'custom' }))
      return
    }
    setS(prev => ({
      ...prev,
      pageSizeKey: key,
      customWidthMM: preset.w,
      customHeightMM: preset.h,
    }))
  }

  const S = { background: '#1a1b1e', color: '#e4e4e6' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-xl shadow-2xl flex overflow-hidden"
        style={{ background: '#1a1b1e', border: '1px solid rgba(255,255,255,0.08)', width: 740, maxHeight: '90vh' }}
      >
        {/* Left — Preview + tabs placeholder */}
        <div className="flex flex-col items-center justify-center p-6 gap-4" style={{ width: 260, background: '#111113', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <PagePreview
            widthMM={effectiveW}
            heightMM={effectiveH}
            orientation={s.orientation}
            facingPages={s.facingPages}
            marginTop={s.marginTopMM}
            marginBottom={s.marginBottomMM}
            marginInner={s.marginInnerMM}
            marginOuter={s.marginOuterMM}
          />
          <div className="text-center" style={{ color: '#6b7280', fontSize: 10, fontFamily: 'system-ui' }}>
            {Math.round(effectiveW * 10) / 10} × {Math.round(effectiveH * 10) / 10} mm
            {s.facingPages && <div style={{ color: '#4b5563' }}>páginas enfrentadas</div>}
          </div>
        </div>

        {/* Right — Settings */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-sans font-semibold" style={{ color: '#e4e4e6' }}>Configuración del documento</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4" style={{ scrollbarWidth: 'thin' }}>

            {/* Dimensiones */}
            <section>
              <h3 className="text-xs font-sans font-bold mb-2" style={{ color: '#e4e4e6', letterSpacing: '0.05em' }}>Dimensiones</h3>

              <Field label="Tamaño preestablecido">
                <select
                  value={s.pageSizeKey}
                  onChange={e => setPreset(e.target.value)}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.12)', color: '#e4e4e6', minWidth: 160 }}
                >
                  {PRESET_SIZES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </Field>

              <Field label="Anchura">
                <MMInput value={s.customWidthMM} onChange={v => setS(p => ({ ...p, customWidthMM: v, pageSizeKey: 'custom' }))} min={10} max={2000} />
              </Field>

              <Field label="Altura">
                <MMInput value={s.customHeightMM} onChange={v => setS(p => ({ ...p, customHeightMM: v, pageSizeKey: 'custom' }))} min={10} max={2000} />
              </Field>

              <Field label="Orientación">
                <div className="flex gap-1">
                  <ToggleButton active={s.orientation === 'portrait'} onClick={() => setS(p => ({ ...p, orientation: 'portrait' }))}>
                    <span style={{ fontSize: 13 }}>▯</span> Vertical
                  </ToggleButton>
                  <ToggleButton active={s.orientation === 'landscape'} onClick={() => setS(p => ({ ...p, orientation: 'landscape' }))}>
                    <span style={{ fontSize: 13 }}>▭</span> Horizontal
                  </ToggleButton>
                </div>
              </Field>
            </section>

            {/* Modelo */}
            <section>
              <h3 className="text-xs font-sans font-bold mb-2" style={{ color: '#e4e4e6', letterSpacing: '0.05em' }}>Modelo</h3>

              <Field label="Número de páginas">
                <input
                  type="number" min={1} max={999} value={s.pageCount}
                  onChange={e => setS(p => ({ ...p, pageCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-20 text-right rounded px-2 py-1 text-xs outline-none"
                  style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.12)', color: '#e4e4e6' }}
                />
              </Field>

              <Field label="Páginas enfrentadas">
                <Toggle value={s.facingPages} onChange={v => setS(p => ({ ...p, facingPages: v }))} />
              </Field>
            </section>

            {/* Márgenes */}
            <section>
              <h3 className="text-xs font-sans font-bold mb-2" style={{ color: '#e4e4e6', letterSpacing: '0.05em' }}>Márgenes</h3>

              <Field label={s.facingPages ? 'Interior' : 'Izquierdo'}>
                <MMInput value={s.marginInnerMM} onChange={v => setS(p => ({ ...p, marginInnerMM: v }))} max={200} />
              </Field>
              <Field label={s.facingPages ? 'Exterior' : 'Derecho'}>
                <MMInput value={s.marginOuterMM} onChange={v => setS(p => ({ ...p, marginOuterMM: v }))} max={200} />
              </Field>
              <Field label="Superior">
                <MMInput value={s.marginTopMM} onChange={v => setS(p => ({ ...p, marginTopMM: v }))} max={200} />
              </Field>
              <Field label="Inferior">
                <MMInput value={s.marginBottomMM} onChange={v => setS(p => ({ ...p, marginBottomMM: v }))} max={200} />
              </Field>
            </section>

            {/* Sangrado */}
            <section>
              <h3 className="text-xs font-sans font-bold mb-2" style={{ color: '#e4e4e6', letterSpacing: '0.05em' }}>Sangrado (bleed)</h3>
              <Field label="Sangrado uniforme">
                <MMInput value={s.bleedMM} onChange={v => setS(p => ({ ...p, bleedMM: v }))} max={25} />
              </Field>
            </section>

          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs font-sans transition"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}
            >Cancelar</button>
            <button
              onClick={() => onApply(s)}
              className="px-4 py-1.5 rounded text-xs font-sans font-semibold transition"
              style={{ background: '#d4522b', color: '#fff', border: 'none' }}
            >Aceptar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Construye un DocumentSetup con los defaults del documento activo */
export function buildSetupFromDocument(doc: any): DocumentSetup {
  const pageSizeKey = doc?.layoutPageSize || 'A4'
  const ps = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4
  return {
    pageSizeKey,
    customWidthMM: ps.widthMM,
    customHeightMM: ps.heightMM,
    orientation: 'portrait',
    pageCount: doc?.layoutPageCount || 1,
    facingPages: doc?.facingPages || false,
    marginTopMM: doc?.marginTopMM ?? 20,
    marginBottomMM: doc?.marginBottomMM ?? 20,
    marginInnerMM: doc?.marginInnerMM ?? 20,
    marginOuterMM: doc?.marginOuterMM ?? 25,
    bleedMM: doc?.bleedMM ?? 0,
  }
}
