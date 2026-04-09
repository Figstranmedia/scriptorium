import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { Reference, CitationStyle } from '../../store/useStore'
import { BibliographyPanel } from './BibliographyPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string       // Extended reasoning (Claude thinking blocks)
  timestamp: number
}

interface Props {
  store: any
  onSave: (id: string, data: object) => void
  onInsertCitation?: (text: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function framesToText(frames: any[]): string {
  if (!frames?.length) return ''
  return frames
    .filter((f: any) => f.ownContent && !f.src)
    .map((f: any) => f.ownContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

function getDocContext(doc: any, conversationSummary?: string) {
  const frameText = framesToText(doc?.layoutFrames || [])
  const content = [doc?.content || '', frameText].filter(Boolean).join('\n\n').slice(0, 12000)
  return { title: doc?.title || 'Sin título', content, docType: doc?.docType || 'book', conversationSummary }
}

function buildInvestigacionMd(docTitle: string, summary: string, messages: ChatMessage[]): string {
  const date = new Date().toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })
  const sampleLines = messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => `- ${m.content.slice(0, 120)}`)
    .join('\n')

  return `# Investigación: ${docTitle}

> Generado automáticamente por Scriptorium · ${date}

${summary}

---

## Últimas consultas del usuario
${sampleLines}

---

*Este archivo se actualiza automáticamente cuando la conversación se comprime.*
`
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SUMMARY_THRESHOLD_CHARS = 12000  // Compress conversation when content > this
const KEEP_RECENT = 6                  // Keep last N messages after compression

// ─── Main component ───────────────────────────────────────────────────────────
export function AISidebar({ store, onSave, onInsertCitation }: Props) {
  const { sidebarOpen, setSidebarOpen, activeDoc, updateDocument, selectedText, pendingChatMessage, setPendingChatMessage } = store

  const [tab, setTab] = useState<'chat' | 'browser' | 'bibliography'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: 'Hola, soy tu asistente editorial. Puedo investigar temas, analizar el texto completo de tu documento, sugerir mejoras de redacción y estructura, o simplemente conversar sobre el proyecto.\n\n¿En qué estás trabajando hoy?',
    timestamp: Date.now(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [conversationSummary, setConversationSummary] = useState<string>('')
  const [projectFolderPath, setProjectFolderPath] = useState<string>(activeDoc?.projectFolderPath || '')
  const [summaryNotice, setSummaryNotice] = useState<string>('')
  const [urlInput, setUrlInput] = useState('https://scholar.google.com')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Sync project folder path from doc
  useEffect(() => {
    if (activeDoc?.projectFolderPath && !projectFolderPath) {
      setProjectFolderPath(activeDoc.projectFolderPath)
    }
  }, [activeDoc?.projectFolderPath])

  // Handle pending chat messages from editor AI actions
  useEffect(() => {
    if (!pendingChatMessage) return
    setPendingChatMessage(null)
    setSidebarOpen(true)
    sendMessage(pendingChatMessage.text)
  }, [pendingChatMessage])

  // Check if conversation needs compression
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  const needsCompression = totalChars > SUMMARY_THRESHOLD_CHARS && messages.length > KEEP_RECENT + 2

  // Auto-compress conversation
  const compressConversation = useCallback(async () => {
    if (summarizing || messages.length <= KEEP_RECENT + 2) return
    setSummarizing(true)
    setSummaryNotice('Comprimiendo conversación...')
    try {
      const res = await window.api.aiSummarizeChat(
        messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content })),
        activeDoc?.title || 'Sin título'
      )
      if (!res.result) throw new Error(res.error || 'Error al resumir')

      setConversationSummary(res.result)

      // Keep only recent messages + add summary stub
      const recent = messages.slice(-KEEP_RECENT)
      setMessages([
        {
          id: 'summary-stub-' + Date.now(),
          role: 'assistant',
          content: `*[Conversación comprimida — ${messages.length} mensajes anteriores resumidos en memoria]*`,
          timestamp: Date.now(),
        },
        ...recent,
      ])

      // Build and save investigacion.md
      const mdContent = buildInvestigacionMd(activeDoc?.title || 'Sin título', res.result, messages)

      if (projectFolderPath) {
        // Update existing project folder
        await window.api.projectUpdateMd(projectFolderPath, mdContent)
        setSummaryNotice('✓ investigacion.md actualizado')
      } else {
        // Prompt user to save project folder
        setSummaryNotice('💾 Guardando carpeta del proyecto...')
        const saveRes = await window.api.projectSaveFolder(
          activeDoc?.title || 'Sin título',
          activeDoc || {},
          mdContent
        )
        if (saveRes.folderPath && !saveRes.canceled) {
          setProjectFolderPath(saveRes.folderPath)
          if (activeDoc) {
            updateDocument(activeDoc.id, { projectFolderPath: saveRes.folderPath })
            onSave(activeDoc.id, { ...activeDoc, projectFolderPath: saveRes.folderPath })
          }
          setSummaryNotice(`✓ Proyecto guardado en ${saveRes.folderPath.split('/').pop()}`)
        } else {
          setSummaryNotice('✓ Conversación comprimida en memoria')
        }
      }
    } catch (err) {
      setSummaryNotice('⚠ Error al comprimir conversación')
    } finally {
      setSummarizing(false)
      setTimeout(() => setSummaryNotice(''), 4000)
    }
  }, [messages, summarizing, activeDoc, projectFolderPath, updateDocument, onSave])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const allMessages = [...messages, userMsg]
        .filter(m => !m.content.startsWith('*[Conversación comprimida'))
        .map(m => ({ role: m.role, content: m.content }))

      const docContext = getDocContext(activeDoc, conversationSummary || undefined)
      const res = await window.api.aiChat(allMessages, docContext)

      if (res.result) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.result!,
          thinking: res.thinking,
          timestamp: Date.now(),
        }])
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ ${res.error || 'Error desconocido'}`,
          timestamp: Date.now(),
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Error de conexión. Verifica Ollama o configura API key en ⚙ Ajustes.',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, activeDoc, conversationSummary])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const quickActions = [
    { label: '🔬 Investigar temas', prompt: 'Investiga los temas principales de mi documento y dame fuentes y contexto relevante.' },
    { label: '✍️ Mejorar redacción', prompt: 'Analiza el estilo de escritura de mi documento y sugiere mejoras de redacción y claridad.' },
    { label: '🗂 Revisar estructura', prompt: 'Analiza la estructura de mi documento. ¿Es lógica, coherente y efectiva para su tipo?' },
    { label: '📝 Análisis editorial', prompt: 'Lee el contenido completo de mi documento y dame un análisis editorial riguroso con recomendaciones específicas sobre qué funciona, qué no, y cómo mejorar.' },
  ]

  const handleAddRef = (ref: Reference) => {
    if (!activeDoc) return
    const refs = [...(activeDoc.references || []), ref]
    updateDocument(activeDoc.id, { references: refs })
    onSave(activeDoc.id, { ...activeDoc, references: refs })
  }
  const handleDeleteRef = (id: string) => {
    if (!activeDoc) return
    const refs = (activeDoc.references || []).filter((r: Reference) => r.id !== id)
    updateDocument(activeDoc.id, { references: refs })
    onSave(activeDoc.id, { ...activeDoc, references: refs })
  }
  const handleUpdateCitationStyle = (style: CitationStyle) => {
    if (!activeDoc) return
    updateDocument(activeDoc.id, { citationStyle: style })
    onSave(activeDoc.id, { ...activeDoc, citationStyle: style })
  }

  // Manual save project folder
  const handleSaveProject = useCallback(async () => {
    const mdContent = buildInvestigacionMd(
      activeDoc?.title || 'Sin título',
      conversationSummary || '*Sin resumen aún — inicia una conversación para generar uno.*',
      messages
    )
    const res = await window.api.projectSaveFolder(
      activeDoc?.title || 'Sin título',
      activeDoc || {},
      mdContent,
      projectFolderPath || undefined
    )
    if (res.folderPath && !res.canceled) {
      setProjectFolderPath(res.folderPath)
      if (activeDoc) {
        updateDocument(activeDoc.id, { projectFolderPath: res.folderPath })
        onSave(activeDoc.id, { ...activeDoc, projectFolderPath: res.folderPath })
      }
    }
  }, [activeDoc, conversationSummary, messages, projectFolderPath, updateDocument, onSave])

  // ── Collapsed mode ────────────────────────────────────────────────────────────
  if (!sidebarOpen) {
    return (
      <aside className="flex flex-col items-center py-2 gap-2 shrink-0"
        style={{ width: 36, background: '#18181b', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setSidebarOpen(true)} title="Abrir asistente IA"
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition"
          style={{ color: '#a0a0a8', background: 'rgba(255,255,255,0.05)' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, letterSpacing: 1 }}>IA</span>
        </button>
        {needsCompression && (
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f59e0b' }} title="Conversación larga — abre para comprimir" />
        )}
      </aside>
    )
  }

  // ── Expanded ──────────────────────────────────────────────────────────────────
  return (
    <aside className="shrink-0 flex flex-col overflow-hidden" style={{ width: 340, background: '#1a1a1e', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-px p-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {([
              { id: 'chat', label: '💬' },
              { id: 'bibliography', label: '📚' },
              { id: 'browser', label: '🌐' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-2 py-1 rounded text-xs transition"
                style={{ background: tab === t.id ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab === t.id ? '#e4e4e6' : '#6e6e78' }}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Project folder indicator */}
          {projectFolderPath ? (
            <button onClick={handleSaveProject} title={`Proyecto: ${projectFolderPath}`}
              className="text-[9px] px-1.5 py-0.5 rounded transition"
              style={{ color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
              📁 {projectFolderPath.split('/').pop()?.slice(0, 12)}
            </button>
          ) : (
            <button onClick={handleSaveProject} title="Crear carpeta del proyecto"
              className="text-[9px] px-1.5 py-0.5 rounded transition"
              style={{ color: '#6e6e78', background: 'rgba(255,255,255,0.05)' }}>
              📁 Guardar proyecto
            </button>
          )}
        </div>
        <button onClick={() => setSidebarOpen(false)} title="Colapsar"
          className="w-6 h-6 rounded flex items-center justify-center text-xs"
          style={{ color: '#48484f' }}>›</button>
      </div>

      {/* ── Chat tab ── */}
      {tab === 'chat' && (
        <>
          {/* Compression notice */}
          {summaryNotice && (
            <div className="px-3 py-1.5 text-[10px] shrink-0" style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.15)', color: '#fbbf24' }}>
              {summaryNotice}
            </div>
          )}

          {/* Auto-compress banner */}
          {needsCompression && !summarizing && !summaryNotice && (
            <div className="px-3 py-2 shrink-0 flex items-center justify-between" style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.12)' }}>
              <span className="text-[10px]" style={{ color: '#fbbf24' }}>Conversación larga — comprimir para seguir</span>
              <button onClick={compressConversation}
                className="text-[10px] px-2 py-0.5 rounded transition"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                Comprimir →
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#2c2c30 #1a1a1e' }}>
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {(loading || summarizing) && <TypingIndicator label={summarizing ? 'Resumiendo conversación...' : undefined} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions — only before first real exchange */}
          {messages.filter(m => m.role === 'user').length === 0 && !loading && (
            <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
              {quickActions.map(a => (
                <button key={a.label} onClick={() => sendMessage(a.prompt)}
                  className="px-2 py-2 rounded-lg text-xs text-left transition"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#a0a0a8', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#c8c8cc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0a0a8' }}>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Context + selected text */}
          <div className="px-3 pb-1 flex items-center gap-2 flex-wrap shrink-0">
            {activeDoc && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
                <span className="text-[10px]" style={{ color: '#36363c' }}>Leyendo: {activeDoc.title}</span>
              </div>
            )}
            {conversationSummary && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a78bfa' }} />
                <span className="text-[10px]" style={{ color: '#36363c' }}>Memoria activa</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {selectedText && (
              <div className="mb-2 px-2 py-1.5 rounded-lg text-[10px] italic"
                style={{ background: 'rgba(41,151,255,0.08)', color: '#60a5fa', border: '1px solid rgba(41,151,255,0.12)' }}>
                <span style={{ opacity: 0.7 }}>Texto seleccionado: </span>
                "{selectedText.slice(0, 80)}{selectedText.length > 80 ? '…' : ''}"
                <button className="ml-2 underline" style={{ color: '#93c5fd' }}
                  onClick={() => sendMessage(`Trabaja con este fragmento: "${selectedText.slice(0, 500)}"`)}>
                  Usar →
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Escribe… (↵ enviar, ⇧↵ nueva línea)"
                rows={2} className="flex-1 resize-none text-xs rounded-lg px-3 py-2 outline-none"
                style={{ background: '#222226', border: '1px solid rgba(255,255,255,0.1)', color: '#c8c8cc', lineHeight: 1.5, fontFamily: 'system-ui' }} />
              <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 disabled:opacity-30"
                style={{ background: '#2997ff', color: '#fff' }} title="Enviar (Enter)">↑</button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <button onClick={() => setMessages([{ id: 'welcome-' + Date.now(), role: 'assistant', content: '¿En qué puedo ayudarte?', timestamp: Date.now() }])}
                className="text-[10px] transition"
                style={{ color: '#36363c' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#6e6e78')}
                onMouseLeave={e => (e.currentTarget.style.color = '#36363c')}>
                ↺ Nueva conversación
              </button>
              {messages.filter(m => m.role === 'user').length > 4 && (
                <button onClick={compressConversation} disabled={summarizing}
                  className="text-[10px] transition disabled:opacity-40"
                  style={{ color: '#a78bfa' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}>
                  ⊞ Comprimir y guardar
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Bibliography tab ── */}
      {tab === 'bibliography' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <BibliographyPanel
            references={activeDoc?.references || []}
            citationStyle={activeDoc?.citationStyle || 'apa'}
            onAddRef={handleAddRef}
            onDeleteRef={handleDeleteRef}
            onUpdateStyle={handleUpdateCitationStyle}
            onInsertCitation={text => onInsertCitation?.(text)}
          />
        </div>
      )}

      {/* ── Browser tab ── */}
      {tab === 'browser' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#18181b' }}>
            <div className="flex gap-1">
              <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                className="flex-1 text-[11px] px-2 py-1.5 rounded outline-none"
                style={{ background: '#222226', border: '1px solid rgba(255,255,255,0.1)', color: '#c8c8cc', fontFamily: 'monospace' }}
                placeholder="https://..." />
            </div>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {[['Scholar', 'https://scholar.google.com'], ['PubMed', 'https://pubmed.ncbi.nlm.nih.gov'], ['JSTOR', 'https://www.jstor.org'], ['arXiv', 'https://arxiv.org'], ['Dialnet', 'https://dialnet.unirioja.es']].map(([label, url]) => (
                <button key={label} onClick={() => setUrlInput(url)}
                  className="px-2 py-0.5 rounded-full text-[10px] transition"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#6e6e78' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <webview src={urlInput} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}
    </aside>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasThinking = !!msg.thinking?.trim()
  const wordCount = msg.thinking ? msg.thinking.split(/\s+/).length : 0

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0 mt-1"
        style={{ background: isUser ? 'rgba(41,151,255,0.2)' : 'rgba(167,139,250,0.15)', color: isUser ? '#60a5fa' : '#a78bfa' }}>
        {isUser ? '↑' : '✦'}
      </div>

      <div className="max-w-[90%] flex flex-col gap-1.5 group">
        {/* Thinking block — only for assistant messages */}
        {!isUser && hasThinking && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.04)' }}>
            <button
              onClick={() => setThinkingOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left"
              style={{ background: 'transparent' }}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 10, color: '#7c3aed' }}>⬡</span>
                <span className="text-[10px] font-medium" style={{ color: '#a78bfa' }}>
                  Razonamiento
                </span>
                <span className="text-[9px]" style={{ color: '#4a4850' }}>
                  {wordCount} palabras
                </span>
              </div>
              <span style={{ color: '#4a4850', fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: thinkingOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {thinkingOpen && (
              <div className="px-3 pb-3">
                <div className="text-[10px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: '#6e6e78', fontFamily: 'system-ui', borderTop: '1px solid rgba(167,139,250,0.08)', paddingTop: 8 }}>
                  {msg.thinking}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main message bubble */}
        <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed relative"
          style={{
            background: isUser ? 'rgba(41,151,255,0.12)' : 'rgba(255,255,255,0.04)',
            color: isUser ? '#bfdbfe' : '#c8c8cc',
            border: isUser ? '1px solid rgba(41,151,255,0.18)' : '1px solid rgba(255,255,255,0.06)',
          }}>
          {isUser
            ? <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
            : <MarkdownText content={msg.content} />
          }
          <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className="absolute -bottom-4 right-0 opacity-0 group-hover:opacity-100 text-[9px] transition px-1"
            style={{ color: '#36363c' }}>
            {copied ? '✓' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0"
        style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>✦</div>
      <div className="px-3 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1 h-1 rounded-full animate-bounce"
              style={{ background: '#48484f', animationDelay: `${i * 0.18}s`, animationDuration: '0.9s' }} />
          ))}
        </div>
        {label && <span className="text-[10px]" style={{ color: '#6e6e78' }}>{label}</span>}
      </div>
    </div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <p key={i} style={{ fontWeight: 600, color: '#e4e4e6', fontSize: 11, marginTop: 6 }}>{line.slice(4)}</p>
        if (line.startsWith('## '))  return <p key={i} style={{ fontWeight: 600, color: '#e4e4e6', fontSize: 12, marginTop: 8 }}>{line.slice(3)}</p>
        if (line.startsWith('# '))   return <p key={i} style={{ fontWeight: 700, color: '#f0f0f4', fontSize: 13, marginTop: 10 }}>{line.slice(2)}</p>
        if (line.startsWith('- ') || line.startsWith('• '))
          return <p key={i} style={{ paddingLeft: 12, color: '#a0a0a8' }}>• {renderInline(line.slice(2))}</p>
        if (/^\d+\./.test(line))
          return <p key={i} style={{ paddingLeft: 12, color: '#a0a0a8' }}>{renderInline(line)}</p>
        if (line.startsWith('> '))
          return <div key={i} style={{ borderLeft: '2px solid rgba(167,139,250,0.3)', paddingLeft: 8, marginLeft: 4, color: '#6e6e78', fontStyle: 'italic', fontSize: 11 }}>{renderInline(line.slice(2))}</div>
        if (line.startsWith('---') || line.startsWith('***'))
          return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
        if (line.trim() === '') return <div key={i} style={{ height: 3 }} />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#e4e4e6', fontWeight: 600 }}>{part.slice(2,-2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))   return <em key={i} style={{ color: '#b8b8c0', fontStyle: 'italic' }}>{part.slice(1,-1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))   return <code key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '0 3px', fontFamily: 'monospace', fontSize: '0.9em' }}>{part.slice(1,-1)}</code>
    return <span key={i}>{part}</span>
  })
}
