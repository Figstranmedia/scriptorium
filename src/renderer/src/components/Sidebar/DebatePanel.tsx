/**
 * DebatePanel — Motor de debate multi-agente integrado en Scriptorium.
 * Permite configurar agentes, lanzar un debate y exportar el resultado.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateAgent {
  id: string
  name: string
  emoji: string
  color: string
  systemPrompt: string
}

type Segment =
  | { kind: 'round'; round: number; max: number }
  | { kind: 'turn'; id: string; agentId: string; agentName: string; agentEmoji: string; agentColor: string; round: number; text: string; streaming: boolean }
  | { kind: 'mediator' }
  | { kind: 'consensus'; conclusion: string; confidence: number; round: number }
  | { kind: 'end'; rounds: number }
  | { kind: 'error'; message: string }

// ─── Default agents ───────────────────────────────────────────────────────────

const DEFAULT_AGENTS: DebateAgent[] = [
  {
    id: 'critico',
    name: 'Crítico',
    emoji: '⚡',
    color: '#ef4444',
    systemPrompt: 'Eres un pensador crítico riguroso. Analizas argumentos buscando falacias, premisas débiles y contraejemplos. Cuando algo está mal fundamentado, lo dices directamente. Máximo 160 palabras por turno. Responde en español.',
  },
  {
    id: 'sintetico',
    name: 'Sintetizador',
    emoji: '◈',
    color: '#3b82f6',
    systemPrompt: 'Eres un pensador sintético. Tu objetivo es integrar perspectivas dispares en marcos coherentes, identificar puntos de convergencia y construir síntesis sólidas. Máximo 160 palabras por turno. Responde en español.',
  },
  {
    id: 'empirico',
    name: 'Empírico',
    emoji: '◎',
    color: '#10b981',
    systemPrompt: 'Eres un científico empírico. Anclas el debate en evidencia observable, datos y ejemplos concretos. Desconfías de afirmaciones sin respaldo verificable. Máximo 160 palabras por turno. Responde en español.',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exportDebateTxt(segments: Segment[], topic: string, model: string): string {
  const date = new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })
  const lines: string[] = [
    'DEBATE DE INVESTIGACIÓN',
    '═══════════════════════════════════════',
    `Tema   : ${topic}`,
    `Fecha  : ${date}`,
    `Modelo : ${model}`,
    '',
  ]

  for (const seg of segments) {
    if (seg.kind === 'round') {
      lines.push('', `─── RONDA ${seg.round} / ${seg.max} ───────────────────────────────`, '')
    } else if (seg.kind === 'turn') {
      lines.push(`${seg.agentEmoji} ${seg.agentName.toUpperCase()} —`)
      lines.push(seg.text)
      lines.push('')
    } else if (seg.kind === 'consensus') {
      lines.push('', '═══ CONSENSO ALCANZADO ═══════════════════')
      lines.push(`Confianza: ${Math.round(seg.confidence * 100)}%  ·  Ronda ${seg.round}`)
      lines.push('')
      lines.push(seg.conclusion)
      lines.push('')
    } else if (seg.kind === 'end') {
      lines.push('', `─── FIN DEL DEBATE (${seg.rounds} rondas, sin consenso formal) ───`)
    }
  }

  return lines.join('\n')
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentEditor({ agent, onChange, onRemove, canRemove }: {
  agent: DebateAgent
  onChange: (a: DebateAgent) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${agent.color}33` }}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none"
        style={{ background: `${agent.color}18` }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ fontSize: 14 }}>{agent.emoji}</span>
        <span className="text-xs font-sans font-semibold flex-1" style={{ color: agent.color }}>{agent.name}</span>
        <span className="text-[10px]" style={{ color: '#48484f' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="px-2 py-2 space-y-1.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex gap-1.5">
            <input
              value={agent.emoji}
              onChange={e => onChange({ ...agent, emoji: e.target.value })}
              maxLength={2}
              className="w-10 text-center text-sm rounded px-1 py-1 outline-none"
              style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e6' }}
            />
            <input
              value={agent.name}
              onChange={e => onChange({ ...agent, name: e.target.value })}
              className="flex-1 text-xs rounded px-2 py-1 outline-none"
              style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e6' }}
              placeholder="Nombre del agente"
            />
            <input
              type="color"
              value={agent.color}
              onChange={e => onChange({ ...agent, color: e.target.value })}
              className="w-8 h-7 rounded cursor-pointer"
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: 2 }}
            />
          </div>
          <textarea
            value={agent.systemPrompt}
            onChange={e => onChange({ ...agent, systemPrompt: e.target.value })}
            rows={3}
            className="w-full text-[10px] rounded px-2 py-1.5 outline-none resize-none"
            style={{ background: '#222226', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', lineHeight: 1.5, fontFamily: 'system-ui' }}
            placeholder="Instrucción de sistema del agente…"
          />
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: '#6b7280', background: 'rgba(255,255,255,0.05)' }}
            >
              Eliminar agente
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  projectFolderPath?: string
  activeDocTitle?: string
  initialDebate?: { topic: string; model: string; segments: any[] }
  onSaveDebate?: (topic: string, model: string, segments: Segment[]) => void
  docContent?: string
  researchContext?: string
}

export function DebatePanel({ projectFolderPath, activeDocTitle, initialDebate, onSaveDebate, docContent, researchContext }: Props) {
  const [view, setView] = useState<'config' | 'debate'>('config')
  const [topic, setTopic] = useState(initialDebate?.topic ?? '')
  const [agents, setAgents] = useState<DebateAgent[]>(DEFAULT_AGENTS)
  const [maxRounds, setMaxRounds] = useState(6)
  const [model, setModel] = useState(initialDebate?.model ?? '')
  const [models, setModels] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [segments, setSegments] = useState<Segment[]>((initialDebate?.segments as Segment[]) ?? [])
  const [status, setStatus] = useState('')
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const onSaveDebateRef = useRef(onSaveDebate)
  useEffect(() => { onSaveDebateRef.current = onSaveDebate }, [onSaveDebate])
  const topicRef = useRef(topic)
  useEffect(() => { topicRef.current = topic }, [topic])
  const modelRef = useRef(model)
  useEffect(() => { modelRef.current = model }, [model])

  // Show last debate transcript if one was restored
  useEffect(() => {
    if (initialDebate?.segments?.length && !running) {
      setView('debate')
    }
  }, [])

  // Load available Ollama models
  useEffect(() => {
    window.api.ollamaListModels().then(res => {
      if (res.models?.length) {
        setModels(res.models)
        setModel(prev => prev || res.models![0])
      }
    })
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments])

  // Register debate event listener
  useEffect(() => {
    window.api.onDebateEvent((data: any) => {
      switch (data.type) {
        case 'start':
          setStatus(`Modelo: ${data.model}`)
          setView('debate')
          break

        case 'round_start':
          setSegments(prev => [...prev, { kind: 'round', round: data.round, max: data.max }])
          setStatus(`Ronda ${data.round} / ${data.max}`)
          break

        case 'agent_start':
          setCurrentAgentId(data.agentId)
          setSegments(prev => [...prev, {
            kind: 'turn',
            id: `${data.agentId}-${Date.now()}`,
            agentId: data.agentId,
            agentName: data.agentName,
            agentEmoji: data.agentEmoji,
            agentColor: data.agentColor,
            round: 0,
            text: '',
            streaming: true,
          }])
          break

        case 'chunk':
          setSegments(prev => {
            const copy = [...prev]
            // Update the last streaming turn for this agent
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].kind === 'turn' && copy[i].agentId === data.agentId && copy[i].streaming) {
                copy[i] = { ...copy[i], text: copy[i].text + data.text }
                break
              }
            }
            return copy
          })
          break

        case 'agent_done':
          setCurrentAgentId(null)
          setSegments(prev => {
            const copy = [...prev]
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].kind === 'turn' && copy[i].agentId === data.agentId && copy[i].streaming) {
                copy[i] = { ...copy[i], streaming: false, text: data.fullText }
                break
              }
            }
            return copy
          })
          break

        case 'mediator_thinking':
          setSegments(prev => [...prev, { kind: 'mediator' }])
          setStatus('Mediador analizando…')
          break

        case 'mediator_result':
          // Remove last mediator placeholder
          setSegments(prev => {
            const idx = [...prev].reverse().findIndex(s => s.kind === 'mediator')
            if (idx === -1) return prev
            const real_idx = prev.length - 1 - idx
            const copy = [...prev]
            copy.splice(real_idx, 1)
            return copy
          })
          break

        case 'consensus': {
          const consensusSeg: Segment = { kind: 'consensus', conclusion: data.conclusion, confidence: data.confidence, round: data.round }
          setSegments(prev => {
            const next = [...prev, consensusSeg]
            onSaveDebateRef.current?.(topicRef.current, modelRef.current, next)
            return next
          })
          setStatus('Consenso alcanzado')
          setRunning(false)
          break
        }

        case 'end': {
          const endSeg: Segment = { kind: 'end', rounds: data.rounds }
          setSegments(prev => {
            const next = [...prev, endSeg]
            onSaveDebateRef.current?.(topicRef.current, modelRef.current, next)
            return next
          })
          setStatus('Debate finalizado')
          setRunning(false)
          break
        }

        case 'error':
          setSegments(prev => [...prev, { kind: 'error', message: data.message }])
          setStatus('Error')
          break
      }
    })
    return () => window.api.offDebateEvent()
  }, [])

  const startDebate = useCallback(async () => {
    if (!topic.trim()) return
    setSegments([])
    setStatus('Iniciando…')
    setRunning(true)
    window.api.debateRun({ topic, agents, maxRounds, model, docContent, researchContext })
  }, [topic, agents, maxRounds, model, docContent, researchContext])

  const stopDebate = useCallback(async () => {
    await window.api.debateStop()
    setRunning(false)
    setStatus('Detenido')
    setSegments(prev => {
      onSaveDebateRef.current?.(topicRef.current, modelRef.current, prev)
      return prev
    })
  }, [])

  const handleExportTxt = useCallback(() => {
    const content = exportDebateTxt(segments, topic, model)
    const safe = topic.slice(0, 40).replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')
    downloadText(content, `debate_${safe || 'sin_tema'}.txt`)
  }, [segments, topic, model])

  const handleExportPdf = useCallback(async () => {
    const txt = exportDebateTxt(segments, topic, model)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{font-family:monospace;font-size:11pt;line-height:1.6;white-space:pre-wrap;padding:2cm}</style>
      </head><body>${txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`
    const safe = topic.slice(0, 40).replace(/[^\w\s]/g, '').trim()
    await window.api.exportPDF(html, `Debate — ${safe || 'Sin tema'}`)
  }, [segments, topic, model])

  const handleSaveToProject = useCallback(async () => {
    const txt = exportDebateTxt(segments, topic, model)
    const safe = topic.slice(0, 40).replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')
    const filename = `debate_${safe || 'sin_tema'}.md`
    const md = `# Debate: ${topic}\n\n\`\`\`\n${txt}\n\`\`\`\n`
    const res = await window.api.researchSaveFile(projectFolderPath || null, filename, md)
    if (res.success) setStatus(`Guardado en ${res.dir}`)
    else setStatus(`Error al guardar: ${res.error}`)
  }, [segments, topic, model, projectFolderPath])

  const addAgent = () => {
    const colors = ['#f59e0b', '#a78bfa', '#fb7185', '#34d399']
    const c = colors[agents.length % colors.length]
    setAgents(prev => [...prev, {
      id: `agent_${Date.now()}`,
      name: `Agente ${prev.length + 1}`,
      emoji: '◆',
      color: c,
      systemPrompt: 'Eres un experto en este tema. Analiza desde tu perspectiva especializada. Máximo 160 palabras por turno. Responde en español.',
    }])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setView('config')}
          className="px-2 py-1 rounded text-[10px] transition"
          style={{ background: view === 'config' ? 'rgba(255,255,255,0.12)' : 'transparent', color: view === 'config' ? '#e4e4e6' : '#6e6e78' }}
        >⚙ Config</button>
        <button
          onClick={() => setView('debate')}
          className="px-2 py-1 rounded text-[10px] transition"
          style={{ background: view === 'debate' ? 'rgba(255,255,255,0.12)' : 'transparent', color: view === 'debate' ? '#e4e4e6' : '#6e6e78' }}
        >💬 Debate</button>
        <div className="flex-1" />
        {status && <span className="text-[9px] truncate max-w-[100px]" style={{ color: '#4b5563' }}>{status}</span>}
        {running
          ? <button onClick={stopDebate} className="px-2 py-1 rounded text-[10px] font-semibold transition" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>■ Stop</button>
          : <button
              onClick={startDebate}
              disabled={!topic.trim() || !model}
              className="px-2.5 py-1 rounded text-[10px] font-semibold transition disabled:opacity-30"
              style={{ background: '#d4522b', color: '#fff' }}
            >▶ Iniciar</button>
        }
      </div>

      {/* Config view */}
      {view === 'config' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>

          {/* Topic */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: '#6b7280' }}>Tema del debate</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              rows={3}
              placeholder="Ej: ¿Puede la inteligencia artificial desarrollar comprensión genuina del lenguaje?"
              className="w-full text-xs rounded px-2 py-1.5 outline-none resize-none"
              style={{ background: '#222226', border: '1px solid rgba(255,255,255,0.1)', color: '#c8c8cc', lineHeight: 1.5, fontFamily: 'system-ui' }}
            />
          </div>

          {/* Context indicator */}
          {(docContent || researchContext) && (
            <div className="rounded px-2.5 py-2 text-[10px] space-y-0.5" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <div className="font-semibold" style={{ color: '#4ade80' }}>Contexto disponible para los agentes:</div>
              {docContent && (
                <div style={{ color: '#86efac' }}>✓ Documento ({Math.round(docContent.length / 1000)}k caracteres)</div>
              )}
              {researchContext && (
                <div style={{ color: '#86efac' }}>✓ Referencias activas ({Math.round(researchContext.length / 1000)}k caracteres)</div>
              )}
            </div>
          )}

          {/* Model + rounds */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: '#6b7280' }}>Modelo</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full text-xs rounded px-2 py-1.5 outline-none"
                style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e6' }}
              >
                {models.length === 0 && <option value="">Sin modelos Ollama</option>}
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: '#6b7280' }}>Rondas</label>
              <select
                value={maxRounds}
                onChange={e => setMaxRounds(Number(e.target.value))}
                className="text-xs rounded px-2 py-1.5 outline-none"
                style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e6', width: 60 }}
              >
                {[2, 4, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Agents */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6b7280' }}>Agentes ({agents.length})</label>
              <button onClick={addAgent} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#d4522b', background: 'rgba(212,82,43,0.1)' }}>+ Añadir</button>
            </div>
            <div className="space-y-1.5">
              {agents.map((a, i) => (
                <AgentEditor
                  key={a.id}
                  agent={a}
                  onChange={updated => setAgents(prev => prev.map(ag => ag.id === a.id ? updated : ag))}
                  onRemove={() => setAgents(prev => prev.filter(ag => ag.id !== a.id))}
                  canRemove={agents.length > 2}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Debate transcript view */}
      {view === 'debate' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
          {segments.length === 0 && !running && (
            <div className="text-center py-10" style={{ color: '#48484f' }}>
              <div className="text-2xl mb-2">⚡</div>
              <div className="text-xs">Configura el tema y presiona Iniciar</div>
            </div>
          )}

          {segments.map((seg, i) => {
            if (seg.kind === 'round') return (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[9px] uppercase tracking-widest px-2" style={{ color: '#374151' }}>Ronda {seg.round} / {seg.max}</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            )

            if (seg.kind === 'turn') return (
              <div key={seg.id} className="rounded-lg p-2.5" style={{ background: `${seg.agentColor}10`, border: `1px solid ${seg.agentColor}28` }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ fontSize: 12 }}>{seg.agentEmoji}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: seg.agentColor }}>{seg.agentName}</span>
                  {seg.streaming && <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-1" style={{ background: seg.agentColor }} />}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#c8c8cc', fontFamily: 'system-ui', whiteSpace: 'pre-wrap' }}>
                  {seg.text}{seg.streaming ? '▌' : ''}
                </p>
              </div>
            )

            if (seg.kind === 'mediator') return (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className="h-px flex-1" style={{ background: 'rgba(167,139,250,0.15)' }} />
                <span className="text-[9px] animate-pulse" style={{ color: '#7c3aed' }}>◈ analizando consenso…</span>
                <div className="h-px flex-1" style={{ background: 'rgba(167,139,250,0.15)' }} />
              </div>
            )

            if (seg.kind === 'consensus') return (
              <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ color: '#4ade80', fontSize: 14 }}>✓</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#4ade80' }}>Consenso · {Math.round(seg.confidence * 100)}% · Ronda {seg.round}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#a7f3d0', fontFamily: 'system-ui' }}>{seg.conclusion}</p>
              </div>
            )

            if (seg.kind === 'end') return (
              <div key={i} className="text-center py-2">
                <span className="text-[10px]" style={{ color: '#374151' }}>── {seg.rounds} rondas completadas ──</span>
              </div>
            )

            if (seg.kind === 'error') return (
              <div key={i} className="rounded px-2 py-1.5 text-[10px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                ⚠ {seg.message}
              </div>
            )

            return null
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Export footer (visible only when debate tab and there's content) */}
      {view === 'debate' && segments.length > 0 && (
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: '#374151' }}>Exportar</span>
          <button onClick={handleExportTxt} className="px-2 py-1 rounded text-[10px] transition" style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
            .txt
          </button>
          <button onClick={handleExportPdf} className="px-2 py-1 rounded text-[10px] transition" style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
            .pdf
          </button>
          <button onClick={handleSaveToProject} className="px-2 py-1 rounded text-[10px] transition" style={{ background: 'rgba(212,82,43,0.1)', color: '#d4522b' }}>
            + Guardar en proyecto
          </button>
        </div>
      )}
    </div>
  )
}
