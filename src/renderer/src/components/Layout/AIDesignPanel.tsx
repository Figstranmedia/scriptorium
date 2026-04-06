/**
 * AIDesignPanel — floating panel for AI-driven design modifications.
 * The user describes what they want; AI returns property changes to apply.
 */
import React, { useState, useRef } from 'react'
import type { AnyLayoutFrame } from '../../lib/threadEngine'

interface Props {
  selectedFrame: AnyLayoutFrame | null
  onApply: (changes: Partial<AnyLayoutFrame>) => void
  onClose: () => void
}

const EXAMPLES = [
  'Fondo azul marino, texto blanco, 18pt centrado',
  'Estilo de título de capítulo: grande, serif, bold',
  'Marco de nota al margen: fondo amarillo claro, borde izquierdo azul',
  'Texto de pie de foto: pequeño, gris, cursiva',
  'Cuerpo de texto académico: justificado, 11pt, interlineado 1.6',
]

export function AIDesignPanel({ selectedFrame, onApply, onClose }: Props) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ changes?: Partial<AnyLayoutFrame>; error?: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!instruction.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const frameProps = selectedFrame
        ? {
            type: 'src' in selectedFrame ? 'image' : 'text',
            fontSize: (selectedFrame as any).fontSize,
            fontFamily: (selectedFrame as any).fontFamily,
            fontWeight: (selectedFrame as any).fontWeight,
            textAlign: (selectedFrame as any).textAlign,
            textColor: (selectedFrame as any).textColor,
            backgroundColor: (selectedFrame as any).backgroundColor,
            borderColor: (selectedFrame as any).borderColor,
            borderWidth: (selectedFrame as any).borderWidth,
            cornerRadius: (selectedFrame as any).cornerRadius,
            opacity: (selectedFrame as any).opacity,
            lineHeight: (selectedFrame as any).lineHeight,
          }
        : {}

      const res = await window.api.aiDesign(instruction, frameProps)
      setResult(res)
    } catch (err) {
      setResult({ error: String(err) })
    }
    setLoading(false)
  }

  const handleApply = () => {
    if (result?.changes) {
      onApply(result.changes)
      setInstruction('')
      setResult(null)
    }
  }

  return (
    <div style={{
      width: 280,
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 8,
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>✨</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>IA Diseño</span>
          {!selectedFrame && <span style={{ fontSize: 10, color: '#f97316', marginLeft: 4 }}>— selecciona un marco</span>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px' }}>
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Describe el estilo que quieres…"
          rows={3}
          style={{
            width: '100%',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#e2e8f0',
            fontSize: 12,
            padding: '8px 10px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !instruction.trim() || !selectedFrame}
          style={{
            marginTop: 6,
            width: '100%',
            padding: '7px',
            background: loading ? '#374151' : '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            fontSize: 12,
            cursor: loading || !selectedFrame ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: !selectedFrame ? 0.5 : 1,
          }}
        >
          {loading ? '⏳ Generando…' : '✨ Aplicar con IA'}
        </button>
      </div>

      {/* Result preview */}
      {result && (
        <div style={{ padding: '0 12px 10px' }}>
          {result.error ? (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 5, padding: '8px 10px', fontSize: 11, color: '#fca5a5' }}>
              {result.error}
            </div>
          ) : result.changes ? (
            <div style={{ background: '#0f2d1a', border: '1px solid #166534', borderRadius: 5, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, color: '#86efac', marginBottom: 6, fontWeight: 600 }}>Cambios propuestos:</p>
              {Object.entries(result.changes).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#dcfce7', marginBottom: 2 }}>
                  <span style={{ color: '#86efac' }}>{k}</span>
                  <span>{String(v)}</span>
                </div>
              ))}
              <button
                onClick={handleApply}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '6px',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >✓ Aplicar cambios</button>
            </div>
          ) : null}
        </div>
      )}

      {/* Examples */}
      <div style={{ padding: '0 12px 10px', borderTop: '1px solid #1e3a5f' }}>
        <p style={{ fontSize: 10, color: '#475569', marginBottom: 5, marginTop: 8 }}>Ejemplos:</p>
        {EXAMPLES.map((ex, i) => (
          <div
            key={i}
            onClick={() => { setInstruction(ex); textareaRef.current?.focus() }}
            style={{
              fontSize: 10,
              color: '#64748b',
              cursor: 'pointer',
              padding: '3px 0',
              borderBottom: '1px solid #1e293b',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
          >
            → {ex}
          </div>
        ))}
      </div>
    </div>
  )
}
