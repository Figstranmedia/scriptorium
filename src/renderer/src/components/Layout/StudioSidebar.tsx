import React, { useState, useRef, useCallback } from 'react'
import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame, LayoutShapeFrame, LayoutChartFrame } from '../../lib/threadEngine'
import { isImageFrame, isShapeFrame, isChartFrame } from '../../lib/threadEngine'
import { LayoutPropertiesPanel } from './LayoutPropertiesPanel'
import { LayersPanel } from './LayersPanel'
import { StylesPanel } from './StylesPanel'
import { MasterPagePanel, type MasterPage } from './MasterPagePanel'
import type { ParagraphStyle } from '../../store/useStore'
import type { PreflightReport } from '../../lib/preflight'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG        = '#1a1b1e'
const BG_HEADER = '#242428'
const BORDER    = '#2d2f36'
const ACCENT    = '#d4522b'
const TAB_ACTIVE   = '#ffffff'
const TAB_INACTIVE = '#6b7280'
const TEXT_MUTED   = '#9ca3af'

// ─── Sidebar Section ─────────────────────────────────────────────────────────
interface SectionProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (id: string) => void
  collapsed: boolean
  onToggle: () => void
  flex?: boolean
  minHeight?: number
  children: React.ReactNode
}

function SidebarSection({ tabs, activeTab, onTabChange, collapsed, onToggle, flex, minHeight = 0, children }: SectionProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: collapsed ? '0 0 auto' : flex ? '1 1 0' : '0 0 auto',
      minHeight: collapsed ? 0 : (flex ? 80 : minHeight),
      borderBottom: `1px solid ${BORDER}`,
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: BG_HEADER,
        borderBottom: collapsed ? 'none' : `1px solid ${BORDER}`,
        flexShrink: 0,
        minHeight: 28,
      }}>
        {/* Accent bar */}
        <div style={{ width: 3, alignSelf: 'stretch', background: ACCENT, flexShrink: 0, borderRadius: '0 2px 2px 0' }} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { onTabChange(t.id); if (collapsed) onToggle() }}
              style={{
                padding: '5px 8px', fontSize: 10, fontFamily: 'Figtree, sans-serif',
                fontWeight: activeTab === t.id && !collapsed ? 600 : 400,
                color: activeTab === t.id && !collapsed ? TAB_ACTIVE : TAB_INACTIVE,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === t.id && !collapsed ? `2px solid ${ACCENT}` : '2px solid transparent',
                whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Collapse toggle */}
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', color: TAB_INACTIVE, cursor: 'pointer',
          fontSize: 11, padding: '4px 8px', flexShrink: 0, lineHeight: 1,
          transition: 'color 0.15s',
        }}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ flex: 1, overflow: 'auto', background: BG }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Section 1 panels ─────────────────────────────────────────────────────────

// Color Panel
function ColorPanel({ frame, onUpdate }: { frame: AnyLayoutFrame | null; onUpdate: (id: string, u: Partial<AnyLayoutFrame>) => void }) {
  if (!frame) return (
    <div style={{ padding: 16, color: TEXT_MUTED, fontSize: 11, fontFamily: 'Figtree, sans-serif', textAlign: 'center' }}>
      Selecciona un marco
    </div>
  )

  const isShape = isShapeFrame(frame)
  const isImg   = isImageFrame(frame)
  const isChart = isChartFrame(frame)
  const tf = frame as LayoutFrame

  const fillColor   = isShape ? (frame as LayoutShapeFrame).fillColor : (!isImg && !isChart ? (tf.backgroundColor || 'transparent') : null)
  const strokeColor = isShape ? (frame as LayoutShapeFrame).strokeColor : (!isImg ? tf.borderColor : (frame as LayoutImageFrame).borderColor)
  const opacity     = frame.opacity ?? 1

  const swatchStyle = (color: string | null): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
    border: `2px solid ${BORDER}`,
    background: color === 'transparent' || !color ? 'repeating-conic-gradient(#444 0% 25%, #2a2a2a 0% 50%) 0 0 / 8px 8px' : color,
    position: 'relative',
  })

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'Figtree, sans-serif' }}>
      {/* Fill */}
      {fillColor !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: TEXT_MUTED, width: 36 }}>Relleno</span>
          <div style={{ position: 'relative' }}>
            <div style={swatchStyle(fillColor)} />
            <input type="color" value={fillColor === 'transparent' ? '#e2e8f0' : fillColor}
              onChange={e => {
                if (isShape) onUpdate(frame.id, { fillColor: e.target.value } as any)
                else onUpdate(frame.id, { backgroundColor: e.target.value } as any)
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </div>
          <button onClick={() => {
            if (isShape) onUpdate(frame.id, { fillColor: 'transparent' } as any)
            else onUpdate(frame.id, { backgroundColor: 'transparent' } as any)
          }} style={{ fontSize: 10, color: TEXT_MUTED, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>Sin relleno</button>
        </div>
      )}

      {/* Stroke/Border */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: TEXT_MUTED, width: 36 }}>Borde</span>
        <div style={{ position: 'relative' }}>
          <div style={swatchStyle(strokeColor)} />
          <input type="color" value={strokeColor || '#64748b'}
            onChange={e => {
              if (isShape) onUpdate(frame.id, { strokeColor: e.target.value } as any)
              else onUpdate(frame.id, { borderColor: e.target.value } as any)
            }}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <input type="number" min={0} max={20} step={0.5}
            defaultValue={isShape ? (frame as LayoutShapeFrame).strokeWidth : (tf.borderWidth ?? 0)}
            onChange={e => {
              if (isShape) onUpdate(frame.id, { strokeWidth: parseFloat(e.target.value) } as any)
              else onUpdate(frame.id, { borderWidth: parseFloat(e.target.value) } as any)
            }}
            style={{ width: '100%', background: '#2d2f36', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '3px 6px', color: '#e2e2e6', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* Opacity */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: TEXT_MUTED }}>Opacidad</span>
          <span style={{ fontSize: 10, color: TEXT_MUTED }}>{Math.round(opacity * 100)}%</span>
        </div>
        <input type="range" min={0} max={100} step={1} value={Math.round(opacity * 100)}
          onChange={e => onUpdate(frame.id, { opacity: parseInt(e.target.value) / 100 })}
          style={{ width: '100%', accentColor: ACCENT }} />
      </div>

      {/* Hex value */}
      {fillColor && fillColor !== 'transparent' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: TEXT_MUTED, width: 36 }}>HEX</span>
          <input type="text"
            value={fillColor.replace('#', '').toUpperCase()}
            onChange={e => {
              const v = '#' + e.target.value.replace('#','').slice(0,6)
              if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                if (isShape) onUpdate(frame.id, { fillColor: v } as any)
                else onUpdate(frame.id, { backgroundColor: v } as any)
              }
            }}
            style={{ flex: 1, background: '#2d2f36', border: `1px solid ${BORDER}`, borderRadius: 5, padding: '4px 8px', color: '#e2e2e6', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
        </div>
      )}
    </div>
  )
}

// Palettes Panel
const PALETTE_COLORS = [
  // Scriptorium brand
  '#d4522b','#b03e20','#f97316','#fbbf24','#d97706',
  // Blues
  '#2563eb','#1d4ed8','#3b82f6','#60a5fa','#93c5fd',
  // Greens
  '#059669','#047857','#10b981','#34d399','#6ee7b7',
  // Purples
  '#7c3aed','#6d28d9','#8b5cf6','#a78bfa','#c4b5fd',
  // Neutrals
  '#0f172a','#1e293b','#334155','#64748b','#94a3b8',
  '#cbd5e1','#e2e8f0','#f1f5f9','#ffffff','#000000',
  // Warm
  '#dc2626','#ef4444','#db2777','#be185d','#9d174d',
]

function PalettesPanel({ frame, onUpdate }: { frame: AnyLayoutFrame | null; onUpdate: (id: string, u: Partial<AnyLayoutFrame>) => void }) {
  return (
    <div style={{ padding: 10 }}>
      <p style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'Figtree, sans-serif', marginBottom: 8 }}>
        Clic = relleno · Mayús+clic = borde
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {PALETTE_COLORS.map(c => (
          <button
            key={c}
            onClick={e => {
              if (!frame) return
              if (e.shiftKey) {
                if (isShapeFrame(frame)) onUpdate(frame.id, { strokeColor: c } as any)
                else onUpdate(frame.id, { borderColor: c } as any)
              } else {
                if (isShapeFrame(frame)) onUpdate(frame.id, { fillColor: c } as any)
                else if (!isImageFrame(frame) && !isChartFrame(frame)) onUpdate(frame.id, { backgroundColor: c } as any)
              }
            }}
            title={c}
            style={{
              width: '100%', aspectRatio: '1', borderRadius: 4,
              background: c, border: `1px solid rgba(255,255,255,0.1)`,
              cursor: frame ? 'pointer' : 'default',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          />
        ))}
      </div>
    </div>
  )
}

// AI Images Panel (BLOQUE 11)
const AI_IMAGE_SIZES = [
  { label: '1:1  512', w: 512,  h: 512  },
  { label: '1:1 1024', w: 1024, h: 1024 },
  { label: '16:9 1280', w: 1280, h: 720  },
  { label: '4:3  1024', w: 1024, h: 768  },
  { label: 'Retrato',  w: 768,  h: 1024 },
]
const AI_IMAGE_MODELS = ['flux', 'turbo', 'flux-realism', 'flux-anime', 'flux-3d']

interface AIImagesPanelProps {
  onInsertImage?: (dataUrl: string) => void
}

function AIImagesPanel({ onInsertImage }: AIImagesPanelProps) {
  const [prompt, setPrompt]     = useState('')
  const [sizeIdx, setSizeIdx]   = useState(0)
  const [model, setModel]       = useState('flux')
  const [loading, setLoading]   = useState(false)
  const [preview, setPreview]   = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    setPreview(null)
    const { w, h } = AI_IMAGE_SIZES[sizeIdx]
    try {
      const res = await window.api.aiGenerateImage(prompt.trim(), w, h, model)
      if (res.error) { setError(res.error); return }
      if (res.dataUrl) setPreview(res.dataUrl)
    } catch (e: any) {
      setError(e?.message ?? 'Error al generar imagen')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#242428',
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    color: '#e2e2e6',
    fontSize: 11,
    padding: '5px 8px',
    fontFamily: 'system-ui',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'Figtree, sans-serif' }}>
      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe la imagen…"
        rows={3}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.4 }}
      />

      {/* Size + Model row */}
      <div style={{ display: 'flex', gap: 6 }}>
        <select value={sizeIdx} onChange={e => setSizeIdx(Number(e.target.value))}
          style={{ ...inputStyle, flex: 1 }}>
          {AI_IMAGE_SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>
        <select value={model} onChange={e => setModel(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}>
          {AI_IMAGE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        style={{
          background: loading ? '#3a3a42' : ACCENT,
          color: '#fff', border: 'none', borderRadius: 6,
          padding: '7px 12px', fontSize: 12, fontWeight: 600,
          cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
          opacity: !prompt.trim() ? 0.5 : 1,
          transition: 'background 0.15s',
        }}
      >
        {loading ? '⏳ Generando…' : '✨ Generar imagen'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#ef4444' }}>
          ⚠ {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <img
            src={preview}
            alt="Generada"
            style={{ width: '100%', borderRadius: 6, border: `1px solid ${BORDER}`, display: 'block' }}
          />
          {onInsertImage && (
            <button
              onClick={() => onInsertImage(preview)}
              style={{
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
                borderRadius: 6, color: '#4ade80', fontSize: 11, fontWeight: 600,
                padding: '6px 10px', cursor: 'pointer',
              }}
            >
              ↗ Insertar en layout
            </button>
          )}
        </div>
      )}

      <div style={{ color: TEXT_MUTED, fontSize: 9, textAlign: 'center' }}>
        Pollinations.ai · sin clave API · sin límite de uso
      </div>
    </div>
  )
}

// Equations Reference Panel
const MATH_REFS = [
  { label: 'Fracción', latex: '\\frac{a}{b}' },
  { label: 'Raíz', latex: '\\sqrt{x}' },
  { label: 'Potencia', latex: 'x^{n}' },
  { label: 'Subíndice', latex: 'x_{i}' },
  { label: 'Sumatoria', latex: '\\sum_{i=0}^{n}' },
  { label: 'Integral', latex: '\\int_{a}^{b}' },
  { label: 'Límite', latex: '\\lim_{x \\to \\infty}' },
  { label: 'Derivada', latex: '\\frac{d}{dx}' },
  { label: 'Vectorial', latex: '\\vec{v}' },
  { label: 'Norma', latex: '\\|\\vec{v}\\|' },
  { label: 'Conjunto ℝ', latex: '\\mathbb{R}' },
  { label: 'Por tanto', latex: '\\therefore' },
]

function EcuacionesPanel() {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (latex: string) => {
    navigator.clipboard.writeText(latex)
    setCopied(latex)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div style={{ padding: 10, fontFamily: 'Figtree, sans-serif' }}>
      <p style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 8 }}>
        Usa Σ / Σ₌ en el toolbar del frame · Clic para copiar LaTeX
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {MATH_REFS.map(r => (
          <button key={r.latex} onClick={() => copy(r.latex)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: copied === r.latex ? 'rgba(212,82,43,0.15)' : '#2d2f36',
              border: `1px solid ${copied === r.latex ? ACCENT : 'transparent'}`,
              borderRadius: 6, padding: '5px 8px', cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}>
            <span style={{ fontSize: 10, color: TEXT_MUTED }}>{r.label}</span>
            <code style={{ fontSize: 10, color: copied === r.latex ? ACCENT : '#a5f3fc', fontFamily: 'monospace' }}>
              {r.latex}
            </code>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Section 3 panels ─────────────────────────────────────────────────────────

// Transform Panel
interface TransformProps {
  frame: AnyLayoutFrame | null
  selectedCount: number
  onUpdate: (id: string, u: Partial<AnyLayoutFrame>) => void
  onAlign: (type: string) => void
}

function TransformPanel({ frame, selectedCount, onUpdate, onAlign }: TransformProps) {
  const numStyle: React.CSSProperties = {
    width: '100%', background: '#2d2f36', border: `1px solid ${BORDER}`,
    borderRadius: 5, padding: '4px 5px', color: '#e2e2e6', fontSize: 11,
    outline: 'none', textAlign: 'right', fontFamily: 'Figtree, sans-serif',
  }
  const labelStyle: React.CSSProperties = { fontSize: 10, color: TEXT_MUTED, fontFamily: 'Figtree, sans-serif' }
  const alignBtn = (type: string, label: string, title: string) => (
    <button onClick={() => onAlign(type)} title={title}
      style={{
        flex: 1, padding: '5px 0', background: '#2d2f36', border: `1px solid ${BORDER}`,
        borderRadius: 5, color: TEXT_MUTED, cursor: 'pointer', fontSize: 12,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#3d3f46')}
      onMouseLeave={e => (e.currentTarget.style.background = '#2d2f36')}
    >{label}</button>
  )

  return (
    <div style={{ padding: 10, fontFamily: 'Figtree, sans-serif', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Position + Size */}
      {frame ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'X', key: 'x', value: Math.round(frame.x) },
            { label: 'Y', key: 'y', value: Math.round(frame.y) },
            { label: 'An', key: 'width', value: Math.round(frame.width) },
            { label: 'Al', key: 'height', value: Math.round(frame.height) },
          ].map(f => (
            <div key={f.key}>
              <div style={{ ...labelStyle, marginBottom: 2 }}>{f.label}</div>
              <input type="number" value={f.value}
                onChange={e => onUpdate(frame.id, { [f.key]: parseInt(e.target.value) || 0 } as any)}
                style={numStyle} />
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 10, color: TEXT_MUTED, textAlign: 'center' }}>Selecciona un marco</p>
      )}

      {/* Alignment */}
      <div>
        <p style={{ ...labelStyle, marginBottom: 6 }}>Alinear {selectedCount > 1 ? `(${selectedCount} sel.)` : ''}</p>
        <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
          {alignBtn('left',   '⬢◻◻', 'Izquierda')}
          {alignBtn('cx',     '◻⬢◻', 'Centro H')}
          {alignBtn('right',  '◻◻⬢', 'Derecha')}
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
          {alignBtn('top',    '⬢', 'Arriba')}
          {alignBtn('cy',     '⬡', 'Centro V')}
          {alignBtn('bottom', '⬣', 'Abajo')}
        </div>
        {selectedCount > 1 && (
          <div style={{ display: 'flex', gap: 3 }}>
            {alignBtn('distrib-h', '↔ Distrib H', 'Distribuir horizontal')}
            {alignBtn('distrib-v', '↕ Distrib V', 'Distribuir vertical')}
          </div>
        )}
      </div>
    </div>
  )
}

// Historial Panel
interface HistorialProps {
  labels: string[]
  currentIndex: number
  onJumpTo: (idx: number) => void
}

function HistorialPanel({ labels, currentIndex, onJumpTo }: HistorialProps) {
  const listRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={listRef} style={{ fontFamily: 'Figtree, sans-serif' }}>
      {labels.length === 0 && (
        <p style={{ fontSize: 10, color: TEXT_MUTED, padding: 12, textAlign: 'center' }}>Sin historial</p>
      )}
      {[...labels].reverse().map((label, revIdx) => {
        const idx = labels.length - 1 - revIdx
        const isCurrent = idx === currentIndex
        const isFuture  = idx > currentIndex
        return (
          <button
            key={idx}
            onClick={() => onJumpTo(idx)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '5px 10px', textAlign: 'left',
              background: isCurrent ? 'rgba(212,82,43,0.15)' : 'transparent',
              border: 'none', cursor: isFuture ? 'default' : 'pointer',
              borderLeft: isCurrent ? `2px solid ${ACCENT}` : '2px solid transparent',
              opacity: isFuture ? 0.4 : 1,
            }}
          >
            <span style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: 'monospace', minWidth: 20 }}>
              {idx}
            </span>
            <span style={{ fontSize: 11, color: isCurrent ? '#f1f0ee' : TEXT_MUTED }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main StudioSidebar ───────────────────────────────────────────────────────

export interface StudioSidebarProps {
  width?: number
  // Selection
  selectedFrame: AnyLayoutFrame | null
  selectedFrameIds: string[]
  frames: AnyLayoutFrame[]
  currentPageIndex: number
  pageCount: number
  // Typography / styles
  paragraphStyles: ParagraphStyle[]
  onUpdateStyles: (s: ParagraphStyle[]) => void
  onApplyStyle: (frameId: string, style: ParagraphStyle) => void
  // Frame operations
  onUpdateFrame: (id: string, u: Partial<AnyLayoutFrame>) => void
  onDeleteFrame: (id: string) => void
  onSelectFrame: (id: string) => void
  onUnlink: (id: string) => void
  onAlign: (type: string) => void
  // Masters
  masters: MasterPage[]
  pageAssignments: Record<number, string>
  onCreateMaster: (name: string) => void
  onDeleteMaster: (id: string) => void
  onUpdateMaster: (id: string, u: Partial<MasterPage>) => void
  onAssignMaster: (pageIndex: number, masterId: string | null) => void
  // Preflight
  preflightReport: PreflightReport
  // History
  historyLabels: string[]
  historyCurrentIndex: number
  onJumpToHistory: (idx: number) => void
  // AI Images
  onInsertImage?: (dataUrl: string) => void
}

export function StudioSidebar({
  width = 220,
  selectedFrame, selectedFrameIds, frames, currentPageIndex, pageCount,
  paragraphStyles, onUpdateStyles, onApplyStyle,
  onUpdateFrame, onDeleteFrame, onSelectFrame, onUnlink, onAlign,
  masters, pageAssignments, onCreateMaster, onDeleteMaster, onUpdateMaster, onAssignMaster,
  preflightReport,
  historyLabels, historyCurrentIndex, onJumpToHistory,
  onInsertImage,
}: StudioSidebarProps) {
  // Section 1
  const [s1collapsed, setS1] = useState(false)
  const [s1tab, setS1tab]    = useState('color')

  // Section 2
  const [s2collapsed, setS2] = useState(false)
  const [s2tab, setS2tab]    = useState('props')

  // Section 3
  const [s3collapsed, setS3] = useState(false)
  const [s3tab, setS3tab]    = useState('transform')

  // Filter layers to current page
  const pageFrames = frames.filter(f => f.pageIndex === currentPageIndex)

  return (
    <div style={{
      width, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: BG,
      borderLeft: `1px solid ${BORDER}`,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* ── Section 1: Color & Media ───────────────────────────────────────── */}
      <SidebarSection
        tabs={[
          { id: 'color',      label: 'Color' },
          { id: 'imagenes',   label: 'Imágenes IA' },
          { id: 'paletas',    label: 'Paletas' },
          { id: 'ecuaciones', label: 'Ecuaciones' },
        ]}
        activeTab={s1tab}
        onTabChange={setS1tab}
        collapsed={s1collapsed}
        onToggle={() => setS1(v => !v)}
        minHeight={180}
      >
        {s1tab === 'color'      && <ColorPanel    frame={selectedFrame} onUpdate={onUpdateFrame} />}
        {s1tab === 'imagenes'   && <AIImagesPanel onInsertImage={onInsertImage} />}
        {s1tab === 'paletas'    && <PalettesPanel frame={selectedFrame} onUpdate={onUpdateFrame} />}
        {s1tab === 'ecuaciones' && <EcuacionesPanel />}
      </SidebarSection>

      {/* ── Section 2: Document panels (flex) ─────────────────────────────── */}
      <SidebarSection
        tabs={[
          { id: 'props',   label: 'Propiedades' },
          { id: 'capas',   label: 'Capas' },
          { id: 'estilos', label: 'Estilos' },
          { id: 'masters', label: 'Masters' },
        ]}
        activeTab={s2tab}
        onTabChange={setS2tab}
        collapsed={s2collapsed}
        onToggle={() => setS2(v => !v)}
        flex
      >
        {s2tab === 'props' && (
          <LayoutPropertiesPanel
            frame={selectedFrame}
            styles={paragraphStyles}
            onUpdate={onUpdateFrame}
            onUnlink={onUnlink}
            onApplyStyle={onApplyStyle}
          />
        )}
        {s2tab === 'capas' && (
          <LayersPanel
            frames={pageFrames}
            selectedFrameIds={selectedFrameIds}
            pageCount={1}
            onSelectFrame={onSelectFrame}
            onUpdateFrame={onUpdateFrame}
            onDeleteFrame={onDeleteFrame}
          />
        )}
        {s2tab === 'estilos' && (
          <StylesPanel styles={paragraphStyles} onUpdate={onUpdateStyles} />
        )}
        {s2tab === 'masters' && (
          <MasterPagePanel
            masters={masters}
            pageAssignments={pageAssignments}
            pageCount={pageCount}
            onCreateMaster={onCreateMaster}
            onDeleteMaster={onDeleteMaster}
            onUpdateMaster={onUpdateMaster}
            onAssignMaster={onAssignMaster}
          />
        )}
      </SidebarSection>

      {/* ── Section 3: Transform & History ────────────────────────────────── */}
      <SidebarSection
        tabs={[
          { id: 'transform',  label: 'Transformar' },
          { id: 'historial',  label: 'Historial' },
        ]}
        activeTab={s3tab}
        onTabChange={setS3tab}
        collapsed={s3collapsed}
        onToggle={() => setS3(v => !v)}
        minHeight={160}
      >
        {s3tab === 'transform' && (
          <TransformPanel
            frame={selectedFrame}
            selectedCount={selectedFrameIds.length}
            onUpdate={onUpdateFrame}
            onAlign={onAlign}
          />
        )}
        {s3tab === 'historial' && (
          <HistorialPanel
            labels={historyLabels}
            currentIndex={historyCurrentIndex}
            onJumpTo={onJumpToHistory}
          />
        )}
      </SidebarSection>

      {/* ── Footer stats ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '4px 10px', borderTop: `1px solid ${BORDER}`,
        fontSize: 10, color: '#4b5563', fontFamily: 'Figtree, sans-serif',
        display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span>{pageFrames.length} marcos · pág {currentPageIndex + 1}</span>
        {selectedFrameIds.length > 1 && (
          <span style={{ color: ACCENT }}>{selectedFrameIds.length} sel.</span>
        )}
        {preflightReport.status !== 'ok' && (
          <span style={{ color: '#f59e0b' }}>⚠ {preflightReport.issues.length}</span>
        )}
      </div>
    </div>
  )
}
