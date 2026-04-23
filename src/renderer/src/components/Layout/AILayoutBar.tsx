/**
 * AILayoutBar — barra de comandos IA para modificaciones de layout completo.
 * Aparece con ⌘K. La IA entiende TODOS los marcos y puede moverlos,
 * redimensionarlos, crear nuevos, eliminar o cambiar propiedades en lote.
 */
import React, { useState, useRef, useEffect } from 'react'

export type LayoutOp =
  | { op: 'update'; frameId: string; props: Record<string, any> }
  | { op: 'move';   frameId: string; xMM: number; yMM: number; wMM?: number; hMM?: number }
  | { op: 'delete'; frameId: string }
  | { op: 'create'; type: string; page: number; xMM: number; yMM: number; wMM: number; hMM: number; props?: Record<string, any> }

interface Props {
  frameCount: number
  selectedFrameLabel?: string
  onExecute: (instruction: string) => Promise<{ ops: LayoutOp[]; summary: string; error?: string }>
  onClose: () => void
}

const SUGGESTIONS = [
  'Todos los títulos en azul marino, serif bold',
  'Cuerpo de texto: 11pt, justificado, interlineado 1.6',
  'Añade un rectángulo de fondo oscuro en la página 1',
  'Centra horizontalmente todos los marcos de la página 1',
  'Cambia la paleta a tonos tierra: ocre, café, crema',
  'Aumenta el padding interior de todos los marcos de texto',
  'Marco seleccionado: fondo blanco, borde sutil, esquinas redondeadas',
  'Homogeniza tipografía: todo en sistema-ui, escala modular',
]

export function AILayoutBar({ frameCount, selectedFrameLabel, onExecute, onClose }: Props) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ summary?: string; error?: string; opsCount?: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSend = async () => {
    if (!instruction.trim() || loading) return
    setLoading(true)
    setResult(null)
    const res = await onExecute(instruction)
    if (res.error) {
      setResult({ error: res.error })
    } else {
      setResult({ summary: res.summary, opsCount: res.ops.length })
      if (res.ops.length > 0) {
        // Auto-close after success with brief delay
        setTimeout(() => onClose(), 2000)
      }
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 600,
        background: 'rgba(15,15,20,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Context info */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-0">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: '#374151' }}>
          ✨ IA Layout
        </span>
        <span className="text-[9px]" style={{ color: '#4b5563' }}>
          {frameCount} marco{frameCount !== 1 ? 's' : ''} en el documento
          {selectedFrameLabel ? ` · seleccionado: ${selectedFrameLabel}` : ''}
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-[11px] px-2 py-0.5 rounded"
          style={{ color: '#48484f' }}
        >Esc</button>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          ref={inputRef}
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder="Describe los cambios de diseño… (Enter para ejecutar)"
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: '#1c1c22',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e4e4e6',
            fontFamily: 'system-ui',
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !instruction.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-30"
          style={{ background: '#d4522b', color: '#fff', minWidth: 80 }}
        >
          {loading ? '⏳' : '→ Aplicar'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="px-4 pb-2">
          {result.error ? (
            <div className="text-xs px-3 py-1.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              ⚠ {result.error}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80' }}>
              <span>✓ {result.opsCount} operación{result.opsCount !== 1 ? 'es' : ''} aplicadas</span>
              {result.summary && <span style={{ color: '#86efac' }}>— {result.summary}</span>}
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {!loading && !result && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setInstruction(s)}
              className="text-[10px] px-2 py-1 rounded-full transition"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#4b5563', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
