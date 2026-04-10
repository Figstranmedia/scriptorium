import React, { useState } from 'react'
import type { LayoutFrame, LayoutImageFrame, LayoutShapeFrame, LayoutChartFrame, AnyLayoutFrame } from '../../lib/threadEngine'
import { isImageFrame, isShapeFrame, isChartFrame } from '../../lib/threadEngine'
import { FontPicker } from './FontPicker'
import type { ParagraphStyle } from '../../store/useStore'

// ─── Design tokens (dark panel) ───────────────────────────────────────────────
const BG       = '#1a1b1e'
const ROW_BG   = '#2d2f36'
const BORDER   = 'rgba(255,255,255,0.07)'
const ACCENT   = '#d4522b'
const TEXT     = '#e2e2e6'
const MUTED    = '#6b7280'
const LABEL    = '#9ca3af'

interface Props {
  frame: AnyLayoutFrame | null
  styles?: ParagraphStyle[]
  onUpdate: (id: string, updates: Partial<AnyLayoutFrame>) => void
  onUnlink: (id: string) => void
  onApplyStyle?: (frameId: string, style: ParagraphStyle) => void
}

// ─── Shared field components ─────────────────────────────────────────────────
function NumField({ label, value, min, max, step = 1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
      <label style={{ fontSize: 10, color: LABEL, fontFamily: 'Figtree, sans-serif', flexShrink: 0 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <input
          type="number" min={min} max={max} step={step} value={Math.round(value * 100) / 100}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 52, textAlign: 'right', padding: '2px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', fontFamily: 'Figtree, sans-serif' }}
        />
        {unit && <span style={{ fontSize: 9, color: MUTED }}>{unit}</span>}
      </div>
    </div>
  )
}

function ColorFieldDark({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = value && value !== 'transparent' ? value : '#e2e8f0'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
      <label style={{ fontSize: 10, color: LABEL, fontFamily: 'Figtree, sans-serif', flexShrink: 0 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ position: 'relative', width: 22, height: 22, borderRadius: 4, border: `1px solid ${BORDER}`, overflow: 'hidden', background: value === 'transparent' ? 'repeating-conic-gradient(#444 0% 25%,#2a2a2a 0% 50%) 0 0 / 6px 6px' : value }}>
          <input type="color" value={safe} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
        </div>
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ width: 62, fontSize: 10, padding: '2px 5px', background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', fontFamily: 'monospace' }} />
      </div>
    </div>
  )
}

// ─── Accordion section ────────────────────────────────────────────────────────
function Accordion({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer',
          fontFamily: 'Figtree, sans-serif', fontSize: 10, fontWeight: 600, color: MUTED,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 8, color: MUTED, transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '6px 10px 10px', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function isStyleOverridden(tf: LayoutFrame, style: ParagraphStyle): boolean {
  return (
    tf.fontFamily !== style.fontFamily || tf.fontSize !== style.fontSize ||
    tf.lineHeight !== style.lineHeight || tf.fontWeight !== style.fontWeight ||
    tf.fontStyle !== style.fontStyle || tf.textAlign !== style.textAlign ||
    tf.textColor !== style.textColor || (tf.letterSpacing || 0) !== style.letterSpacing
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LayoutPropertiesPanel({ frame, styles = [], onUpdate, onUnlink, onApplyStyle }: Props) {
  if (!frame) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 16 }}>
        <p style={{ fontSize: 11, color: MUTED, fontFamily: 'Figtree, sans-serif', textAlign: 'center' }}>
          Selecciona un marco
        </p>
      </div>
    )
  }

  const upd = (updates: Partial<AnyLayoutFrame>) => onUpdate(frame.id, updates)

  // ── Chart frame ─────────────────────────────────────────────────────────────
  if (isChartFrame(frame)) {
    const cf = frame as LayoutChartFrame
    const TYPES = [
      { v: 'bar', l: '▊' }, { v: 'line', l: '📈' }, { v: 'area', l: '◼' },
      { v: 'pie', l: '◑' }, { v: 'scatter', l: '⋯' },
    ] as const
    return (
      <div style={{ background: BG, fontSize: 11, fontFamily: 'Figtree, sans-serif', color: TEXT }}>
        <Accordion title="Posición y tamaño">
          <NumField label="X" value={cf.x} min={0} max={2000} onChange={v => upd({ x: v })} unit="px" />
          <NumField label="Y" value={cf.y} min={0} max={3000} onChange={v => upd({ y: v })} unit="px" />
          <NumField label="Ancho" value={cf.width} min={80} max={2000} onChange={v => upd({ width: v })} unit="px" />
          <NumField label="Alto" value={cf.height} min={60} max={3000} onChange={v => upd({ height: v })} unit="px" />
        </Accordion>
        <Accordion title="Tipo de gráfico">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TYPES.map(t => (
              <button key={t.v} onClick={() => upd({ chartType: t.v } as any)}
                style={{ flex: 1, padding: '5px 2px', borderRadius: 5, border: `1px solid ${cf.chartType === t.v ? ACCENT : BORDER}`, background: cf.chartType === t.v ? 'rgba(212,82,43,0.15)' : ROW_BG, color: cf.chartType === t.v ? ACCENT : MUTED, cursor: 'pointer', fontSize: 12 }}>
                {t.l}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: MUTED }}>Doble clic → editar datos</div>
        </Accordion>
        <Accordion title="Capa">
          <NumField label="Opacidad" value={cf.opacity * 100} min={0} max={100} onChange={v => upd({ opacity: v / 100 } as any)} unit="%" />
          <NumField label="Z-order" value={cf.zIndex} min={0} max={100} onChange={v => upd({ zIndex: v } as any)} />
        </Accordion>
      </div>
    )
  }

  // ── Shape frame ──────────────────────────────────────────────────────────────
  if (isShapeFrame(frame)) {
    const sf = frame as LayoutShapeFrame
    return (
      <div style={{ background: BG, fontSize: 11, fontFamily: 'Figtree, sans-serif', color: TEXT }}>
        <Accordion title="Posición y tamaño">
          <NumField label="X" value={sf.x} min={0} max={2000} onChange={v => upd({ x: v })} unit="px" />
          <NumField label="Y" value={sf.y} min={0} max={3000} onChange={v => upd({ y: v })} unit="px" />
          <NumField label="Ancho" value={sf.width} min={10} max={2000} onChange={v => upd({ width: v })} unit="px" />
          {sf.shapeType !== 'line' && <NumField label="Alto" value={sf.height} min={10} max={3000} onChange={v => upd({ height: v })} unit="px" />}
        </Accordion>
        <Accordion title="Forma">
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['rect', 'ellipse', 'line'] as const).map(t => (
              <button key={t} onClick={() => upd({ shapeType: t } as any)}
                style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: `1px solid ${sf.shapeType === t ? '#059669' : BORDER}`, background: sf.shapeType === t ? 'rgba(5,150,105,0.15)' : ROW_BG, color: sf.shapeType === t ? '#34d399' : MUTED, cursor: 'pointer', fontSize: 13 }}>
                {t === 'rect' ? '▭' : t === 'ellipse' ? '◯' : '╱'}
              </button>
            ))}
          </div>
          <ColorFieldDark label="Relleno" value={sf.fillColor || 'transparent'} onChange={v => upd({ fillColor: v } as any)} />
          <ColorFieldDark label="Borde" value={sf.strokeColor || '#64748b'} onChange={v => upd({ strokeColor: v } as any)} />
          <NumField label="Grosor borde" value={sf.strokeWidth} min={0} max={20} step={0.5} onChange={v => upd({ strokeWidth: v } as any)} unit="px" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <label style={{ fontSize: 10, color: LABEL, flexShrink: 0 }}>Estilo borde</label>
            <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
              {(['solid', 'dashed', 'dotted'] as const).map(s => (
                <button key={s} onClick={() => upd({ strokeStyle: s } as any)}
                  style={{ padding: '2px 6px', borderRadius: 4, border: `1px solid ${sf.strokeStyle === s ? '#059669' : BORDER}`, background: sf.strokeStyle === s ? 'rgba(5,150,105,0.15)' : ROW_BG, color: sf.strokeStyle === s ? '#34d399' : MUTED, cursor: 'pointer', fontSize: 10 }}>
                  {s === 'solid' ? '—' : s === 'dashed' ? '- -' : '···'}
                </button>
              ))}
            </div>
          </div>
          {sf.shapeType === 'rect' && <NumField label="Radio esquina" value={sf.cornerRadius} min={0} max={200} onChange={v => upd({ cornerRadius: v } as any)} unit="px" />}
        </Accordion>
        <Accordion title="Capa">
          <NumField label="Opacidad" value={sf.opacity * 100} min={0} max={100} onChange={v => upd({ opacity: v / 100 } as any)} unit="%" />
          <NumField label="Z-order" value={sf.zIndex} min={0} max={100} onChange={v => upd({ zIndex: v } as any)} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <label style={{ fontSize: 10, color: LABEL }}>Bloqueado</label>
            <button onClick={() => upd({ locked: !sf.locked } as any)}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${sf.locked ? '#d97706' : BORDER}`, background: sf.locked ? 'rgba(217,119,6,0.15)' : ROW_BG, color: sf.locked ? '#fbbf24' : MUTED, cursor: 'pointer' }}>
              {sf.locked ? '🔒 Sí' : '🔓 No'}
            </button>
          </div>
        </Accordion>
      </div>
    )
  }

  // ── Image frame ──────────────────────────────────────────────────────────────
  if (isImageFrame(frame)) {
    const imgF = frame as LayoutImageFrame
    return (
      <div style={{ background: BG, fontSize: 11, fontFamily: 'Figtree, sans-serif', color: TEXT }}>
        <Accordion title="Posición y tamaño">
          <NumField label="X" value={imgF.x} min={0} max={2000} onChange={v => upd({ x: v })} unit="px" />
          <NumField label="Y" value={imgF.y} min={0} max={3000} onChange={v => upd({ y: v })} unit="px" />
          <NumField label="Ancho" value={imgF.width} min={40} max={2000} onChange={v => upd({ width: v })} unit="px" />
          <NumField label="Alto" value={imgF.height} min={30} max={3000} onChange={v => upd({ height: v })} unit="px" />
        </Accordion>
        <Accordion title="Imagen">
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {(['fit', 'fill', 'crop'] as const).map(f => (
              <button key={f} onClick={() => upd({ fit: f })}
                style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: `1px solid ${imgF.fit === f ? ACCENT : BORDER}`, background: imgF.fit === f ? 'rgba(212,82,43,0.15)' : ROW_BG, color: imgF.fit === f ? ACCENT : MUTED, cursor: 'pointer', fontSize: 10 }}>
                {f}
              </button>
            ))}
          </div>
          <input
            type="text" value={imgF.caption || ''} placeholder="Leyenda..."
            onChange={e => upd({ caption: e.target.value })}
            style={{ width: '100%', padding: '4px 8px', fontSize: 10, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', fontFamily: 'Figtree, sans-serif', boxSizing: 'border-box' }}
          />
        </Accordion>
        <Accordion title="Apariencia">
          <ColorFieldDark label="Borde color" value={imgF.borderColor || 'transparent'} onChange={v => upd({ borderColor: v })} />
          <NumField label="Borde grosor" value={imgF.borderWidth || 0} min={0} max={20} onChange={v => upd({ borderWidth: v })} unit="px" />
          <NumField label="Radio esquina" value={imgF.cornerRadius || 0} min={0} max={200} onChange={v => upd({ cornerRadius: v })} unit="px" />
        </Accordion>
        <Accordion title="Capa">
          <NumField label="Opacidad" value={(imgF.opacity ?? 1) * 100} min={0} max={100} onChange={v => upd({ opacity: v / 100 })} unit="%" />
          <NumField label="Z-order" value={imgF.zIndex || 10} min={0} max={100} onChange={v => upd({ zIndex: v })} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <label style={{ fontSize: 10, color: LABEL }}>Bloqueado</label>
            <button onClick={() => upd({ locked: !imgF.locked })}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${imgF.locked ? '#d97706' : BORDER}`, background: imgF.locked ? 'rgba(217,119,6,0.15)' : ROW_BG, color: imgF.locked ? '#fbbf24' : MUTED, cursor: 'pointer' }}>
              {imgF.locked ? '🔒 Sí' : '🔓 No'}
            </button>
          </div>
        </Accordion>
      </div>
    )
  }

  // ── Text frame ───────────────────────────────────────────────────────────────
  const tf = frame as LayoutFrame
  const appliedStyle = styles.find(s => s.id === tf.paragraphStyleId)
  const overridden = appliedStyle ? isStyleOverridden(tf, appliedStyle) : false

  return (
    <div style={{ background: BG, fontSize: 11, fontFamily: 'Figtree, sans-serif', color: TEXT }}>

      {/* Posición y tamaño */}
      <Accordion title="Posición y tamaño">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {[
            { label: 'X', key: 'x', value: tf.x },
            { label: 'Y', key: 'y', value: tf.y },
            { label: 'An', key: 'width', value: tf.width },
            { label: 'Al', key: 'height', value: tf.height },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>{f.label}</div>
              <input type="number" value={Math.round(f.value)}
                onChange={e => upd({ [f.key]: parseInt(e.target.value) || 0 } as any)}
                style={{ width: '100%', padding: '3px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
      </Accordion>

      {/* Estilo de texto */}
      <Accordion title="Estilo de texto">
        {/* Style preset selector */}
        {styles.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select
                value={tf.paragraphStyleId || ''}
                onChange={e => {
                  const style = styles.find(s => s.id === e.target.value)
                  if (style && onApplyStyle) onApplyStyle(tf.id, style)
                  else upd({ paragraphStyleId: e.target.value || undefined } as any)
                }}
                style={{ flex: 1, fontSize: 10, padding: '3px 5px', background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', fontFamily: 'Figtree, sans-serif' }}
              >
                <option value="">— Libre —</option>
                {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {overridden && (
                <button onClick={() => appliedStyle && onApplyStyle && onApplyStyle(tf.id, appliedStyle)}
                  title="Restablecer estilo base"
                  style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(212,82,43,0.15)', border: `1px solid ${ACCENT}`, borderRadius: 4, color: ACCENT, cursor: 'pointer' }}>↩</button>
              )}
            </div>
          </div>
        )}

        {/* Font family */}
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 9, color: MUTED, display: 'block', marginBottom: 2 }}>Fuente</label>
          <FontPicker value={tf.fontFamily} onChange={v => upd({ fontFamily: v })} />
        </div>

        {/* Size + line height */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>Tamaño</div>
            <input type="number" min={6} max={144} value={tf.fontSize}
              onChange={e => upd({ fontSize: Number(e.target.value) })}
              style={{ width: '100%', padding: '3px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>Interlineado</div>
            <input type="number" min={1} max={4} step={0.05} value={Math.round(tf.lineHeight * 100) / 100}
              onChange={e => upd({ lineHeight: Number(e.target.value) })}
              style={{ width: '100%', padding: '3px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Letter spacing */}
        <NumField label="Espaciado letras" value={tf.letterSpacing || 0} min={-5} max={20} step={0.5} onChange={v => upd({ letterSpacing: v } as any)} unit="px" />

        {/* B / I buttons + align */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          <button onClick={() => upd({ fontWeight: tf.fontWeight === 'bold' ? 'normal' : 'bold' } as any)}
            style={{ width: 28, height: 26, borderRadius: 5, border: `1px solid ${tf.fontWeight === 'bold' ? ACCENT : BORDER}`, background: tf.fontWeight === 'bold' ? 'rgba(212,82,43,0.15)' : ROW_BG, color: tf.fontWeight === 'bold' ? ACCENT : MUTED, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>B</button>
          <button onClick={() => upd({ fontStyle: tf.fontStyle === 'italic' ? 'normal' : 'italic' } as any)}
            style={{ width: 28, height: 26, borderRadius: 5, border: `1px solid ${tf.fontStyle === 'italic' ? ACCENT : BORDER}`, background: tf.fontStyle === 'italic' ? 'rgba(212,82,43,0.15)' : ROW_BG, color: tf.fontStyle === 'italic' ? ACCENT : MUTED, cursor: 'pointer', fontStyle: 'italic', fontSize: 12 }}>I</button>
          <div style={{ flex: 1 }} />
          {(['left', 'center', 'right', 'justify'] as const).map(a => (
            <button key={a} onClick={() => upd({ textAlign: a } as any)}
              style={{ width: 28, height: 26, borderRadius: 5, border: `1px solid ${tf.textAlign === a ? ACCENT : BORDER}`, background: tf.textAlign === a ? 'rgba(212,82,43,0.15)' : ROW_BG, color: tf.textAlign === a ? ACCENT : MUTED, cursor: 'pointer', fontSize: 11 }}>
              {a === 'left' ? '⬛' : a === 'center' ? '⬜' : a === 'right' ? '⬛' : '▬'}
            </button>
          ))}
        </div>

        {/* Text color */}
        <ColorFieldDark label="Color" value={tf.textColor || '#1a1714'} onChange={v => upd({ textColor: v } as any)} />

        {/* Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>Columnas</div>
            <input type="number" min={1} max={4} value={tf.columns}
              onChange={e => upd({ columns: Number(e.target.value) })}
              style={{ width: '100%', padding: '3px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          {tf.columns > 1 && (
            <div>
              <div style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>Medianil</div>
              <input type="number" min={8} max={60} value={tf.columnGutter}
                onChange={e => upd({ columnGutter: Number(e.target.value) })}
                style={{ width: '100%', padding: '3px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>
      </Accordion>

      {/* Relleno interno */}
      <Accordion title="Relleno interno" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {[
            { label: 'Sup', key: 'paddingTop', value: tf.paddingTop ?? 4 },
            { label: 'Der', key: 'paddingRight', value: tf.paddingRight ?? 6 },
            { label: 'Inf', key: 'paddingBottom', value: tf.paddingBottom ?? 4 },
            { label: 'Izq', key: 'paddingLeft', value: tf.paddingLeft ?? 6 },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>{f.label}</div>
              <input type="number" min={0} max={80} value={f.value}
                onChange={e => upd({ [f.key]: Number(e.target.value) } as any)}
                style={{ width: '100%', padding: '3px 5px', fontSize: 11, background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', textAlign: 'right', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
      </Accordion>

      {/* Encadenado de texto */}
      <Accordion title="Encadenado de texto" defaultOpen={false}>
        {tf.threadNextId ? (
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '6px 8px', fontSize: 10 }}>
            <p style={{ color: '#a5b4fc', marginBottom: 4 }}>→ Vinculado al marco siguiente</p>
            <button onClick={() => onUnlink(tf.id)}
              style={{ fontSize: 10, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Desvincular</button>
          </div>
        ) : (
          <p style={{ fontSize: 10, color: MUTED }}>Sin enlace. Usa <strong style={{ color: TEXT }}>⛓ Vincular</strong> para encadenar marcos.</p>
        )}
        {tf.threadPrevId && (
          <div style={{ marginTop: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#a5b4fc' }}>
            ← Recibe texto del marco anterior
          </div>
        )}
      </Accordion>

      {/* Apariencia */}
      <Accordion title="Apariencia" defaultOpen={false}>
        <ColorFieldDark label="Fondo" value={tf.backgroundColor || 'transparent'} onChange={v => upd({ backgroundColor: v } as any)} />
        <ColorFieldDark label="Borde" value={tf.borderColor || 'transparent'} onChange={v => upd({ borderColor: v } as any)} />
        <NumField label="Grosor borde" value={tf.borderWidth || 0} min={0} max={20} onChange={v => upd({ borderWidth: v } as any)} unit="px" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <label style={{ fontSize: 10, color: LABEL, flexShrink: 0 }}>Estilo borde</label>
          <select value={tf.borderStyle || 'solid'} onChange={e => upd({ borderStyle: e.target.value as any })}
            style={{ flex: 1, fontSize: 10, padding: '3px 5px', background: ROW_BG, border: `1px solid ${BORDER}`, borderRadius: 5, color: TEXT, outline: 'none', fontFamily: 'Figtree, sans-serif' }}>
            <option value="solid">Sólido</option>
            <option value="dashed">Rayado</option>
            <option value="dotted">Punteado</option>
          </select>
        </div>
        <NumField label="Radio esquina" value={tf.cornerRadius || 0} min={0} max={100} onChange={v => upd({ cornerRadius: v } as any)} unit="px" />
      </Accordion>

      {/* Capa */}
      <Accordion title="Capa" defaultOpen={false}>
        <NumField label="Opacidad" value={(tf.opacity ?? 1) * 100} min={0} max={100} onChange={v => upd({ opacity: v / 100 } as any)} unit="%" />
        <NumField label="Z-order" value={tf.zIndex || 10} min={1} max={100} onChange={v => upd({ zIndex: v } as any)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <label style={{ fontSize: 10, color: LABEL }}>Bloqueado</label>
          <button onClick={() => upd({ locked: !tf.locked } as any)}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${tf.locked ? '#d97706' : BORDER}`, background: tf.locked ? 'rgba(217,119,6,0.15)' : ROW_BG, color: tf.locked ? '#fbbf24' : MUTED, cursor: 'pointer' }}>
            {tf.locked ? '🔒 Sí' : '🔓 No'}
          </button>
        </div>
      </Accordion>

    </div>
  )
}
