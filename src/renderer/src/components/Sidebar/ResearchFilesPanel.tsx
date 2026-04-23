/**
 * ResearchFilesPanel — Gestión de archivos de referencia extraídos de PDFs.
 * Permite subir PDFs, extraer su texto como .md, y gestionar la biblioteca de referencias.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { parsePDF } from '../../lib/pdfImport'

interface ResearchFile {
  name: string
  path: string
  size: number
  modified: number
}

interface Props {
  projectFolderPath?: string
  onContextUpdate?: (contextText: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString('es', { month: 'short', day: 'numeric' })
}

// ─── PDF → Markdown conversion ────────────────────────────────────────────────

async function pdfToMarkdown(base64Data: string, filename: string): Promise<string> {
  const result = await parsePDF(base64Data)
  const date = new Date().toLocaleDateString('es', { dateStyle: 'long' })

  const lines: string[] = [
    `# ${filename.replace(/\.pdf$/i, '')}`,
    '',
    `> Extraído automáticamente por Scriptorium — ${date}`,
    `> Páginas: ${result.pageCount} · Tamaño: ${result.pageSizeName}`,
    '',
    '---',
    '',
  ]

  let lastPage = -1
  let currentPara: string[] = []

  const flush = () => {
    if (currentPara.length > 0) {
      lines.push(currentPara.join(' '))
      lines.push('')
      currentPara = []
    }
  }

  for (const block of result.blocks) {
    if (block.pageIndex !== lastPage) {
      flush()
      if (lastPage >= 0) {
        lines.push(`---`)
        lines.push('')
      }
      lines.push(`<!-- Página ${block.pageIndex + 1} -->`)
      lastPage = block.pageIndex
    }

    const text = block.text.trim()
    if (!text) continue

    if (block.isHeading || block.fontSize >= 14) {
      flush()
      const level = block.fontSize >= 18 ? '##' : '###'
      lines.push(`${level} ${text}`)
      lines.push('')
    } else {
      // Collect paragraph lines
      const paras = text.split('\n').filter(l => l.trim())
      for (const para of paras) {
        if (para.length > 80) {
          flush()
          lines.push(para)
          lines.push('')
        } else {
          currentPara.push(para)
        }
      }
    }
  }
  flush()

  return lines.join('\n')
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResearchFilesPanel({ projectFolderPath, onContextUpdate }: Props) {
  const [files, setFiles] = useState<ResearchFile[]>([])
  const [dir, setDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [activeContext, setActiveContext] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const res = await window.api.researchListFiles(projectFolderPath || null)
    setFiles(res.files || [])
    if (res.dir) setDir(res.dir)
    setLoading(false)
  }, [projectFolderPath])

  useEffect(() => { loadFiles() }, [loadFiles])

  // Notify parent when active context changes
  useEffect(() => {
    if (!onContextUpdate) return
    if (activeContext.size === 0) { onContextUpdate(''); return }
    // Build combined context from active files
    const contextFiles = files.filter(f => activeContext.has(f.path))
    Promise.all(contextFiles.map(f => window.api.researchReadFile(f.path))).then(results => {
      const combined = results
        .map((r, i) => r.content ? `=== ${contextFiles[i].name} ===\n${r.content.slice(0, 3000)}` : '')
        .filter(Boolean)
        .join('\n\n')
      onContextUpdate(combined)
    })
  }, [activeContext, files])

  const handleExtractPDF = useCallback(async () => {
    setExtracting(true)
    setStatus('Seleccionando PDF…')
    try {
      const res = await window.api.importPDF()
      if (!res) { setExtracting(false); setStatus(''); return }

      setStatus('Extrayendo texto…')
      const mdContent = await pdfToMarkdown(res.data, res.name)
      const mdName = res.name.replace(/\.pdf$/i, '') + '.md'

      setStatus('Guardando…')
      const saveRes = await window.api.researchSaveFile(projectFolderPath || null, mdName, mdContent)
      if (saveRes.error) {
        setStatus(`Error: ${saveRes.error}`)
      } else {
        setStatus(`✓ Guardado: ${mdName}`)
        await loadFiles()
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
    }
    setExtracting(false)
    setTimeout(() => setStatus(''), 3000)
  }, [projectFolderPath, loadFiles])

  const handleViewFile = useCallback(async (filePath: string) => {
    if (selectedFile === filePath) { setSelectedFile(null); setFileContent(''); return }
    const res = await window.api.researchReadFile(filePath)
    setSelectedFile(filePath)
    setFileContent(res.content || res.error || '')
  }, [selectedFile])

  const handleDeleteFile = useCallback(async (filePath: string) => {
    if (!confirm('¿Eliminar este archivo de referencia?')) return
    await window.api.researchDeleteFile(filePath)
    setActiveContext(prev => { const next = new Set(prev); next.delete(filePath); return next })
    if (selectedFile === filePath) { setSelectedFile(null); setFileContent('') }
    await loadFiles()
  }, [selectedFile, loadFiles])

  const toggleContext = useCallback((filePath: string) => {
    setActiveContext(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }, [])

  const handleDownloadFile = useCallback(async (file: ResearchFile) => {
    const res = await window.api.researchReadFile(file.path)
    if (!res.content) return
    const blob = new Blob([res.content], { type: 'text/plain; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleExtractPDF}
          disabled={extracting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-semibold transition disabled:opacity-40"
          style={{ background: '#d4522b', color: '#fff' }}
        >
          {extracting ? '⏳' : '⬆'} PDF → MD
        </button>
        <button
          onClick={loadFiles}
          className="px-2 py-1.5 rounded text-[10px] transition"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}
          title="Actualizar lista"
        >↺</button>
        <div className="flex-1" />
        {status && <span className="text-[9px] truncate max-w-[110px]" style={{ color: status.startsWith('✓') ? '#4ade80' : '#6b7280' }}>{status}</span>}
      </div>

      {/* Dir indicator */}
      {dir && (
        <div className="px-3 py-1 shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-[9px] font-mono truncate block" style={{ color: '#374151' }} title={dir}>
            📁 …{dir.slice(-40)}
          </span>
        </div>
      )}

      {/* Context active notice */}
      {activeContext.size > 0 && (
        <div className="shrink-0 px-3 py-1.5 flex items-center gap-1.5" style={{ background: 'rgba(41,151,255,0.06)', borderBottom: '1px solid rgba(41,151,255,0.1)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#2997ff' }} />
          <span className="text-[10px]" style={{ color: '#60a5fa' }}>
            {activeContext.size} archivo{activeContext.size > 1 ? 's' : ''} en contexto IA
          </span>
          <button
            onClick={() => setActiveContext(new Set())}
            className="ml-auto text-[9px]"
            style={{ color: '#374151' }}
          >✕</button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {loading && (
          <div className="px-3 py-6 text-center text-[11px]" style={{ color: '#374151' }}>Cargando…</div>
        )}
        {!loading && files.length === 0 && (
          <div className="px-3 py-8 text-center space-y-2">
            <div className="text-2xl" style={{ color: '#374151' }}>📄</div>
            <div className="text-[11px]" style={{ color: '#4b5563' }}>Sin archivos de referencia</div>
            <div className="text-[10px]" style={{ color: '#374151' }}>
              Sube un PDF para extraer su texto como Markdown y usarlo como contexto de investigación.
            </div>
          </div>
        )}

        {files.map(file => {
          const isActive = activeContext.has(file.path)
          const isSelected = selectedFile === file.path
          return (
            <div key={file.path}>
              {/* File row */}
              <div
                className="flex items-center gap-2 px-3 py-2 transition cursor-pointer"
                style={{
                  background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
                onClick={() => handleViewFile(file.path)}
              >
                {/* Context toggle */}
                <button
                  onClick={e => { e.stopPropagation(); toggleContext(file.path) }}
                  title={isActive ? 'Quitar del contexto IA' : 'Añadir al contexto IA'}
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[8px] transition"
                  style={{
                    background: isActive ? 'rgba(41,151,255,0.3)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isActive ? '#2997ff' : 'rgba(255,255,255,0.1)'}`,
                    color: isActive ? '#60a5fa' : '#4b5563',
                  }}
                >
                  {isActive ? '✓' : '+'}
                </button>

                {/* File icon + name */}
                <span className="text-[11px] shrink-0" style={{ color: file.name.endsWith('.md') ? '#a78bfa' : '#6b7280' }}>
                  {file.name.endsWith('.md') ? '📝' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate" style={{ color: '#c8c8cc' }}>{file.name}</div>
                  <div className="text-[9px]" style={{ color: '#374151' }}>{formatSize(file.size)} · {formatDate(file.modified)}</div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleDownloadFile(file)}
                    title="Descargar"
                    className="text-[9px] px-1 py-0.5 rounded"
                    style={{ color: '#4b5563', background: 'rgba(255,255,255,0.04)' }}
                  >↓</button>
                  <button
                    onClick={() => handleDeleteFile(file.path)}
                    title="Eliminar"
                    className="text-[9px] px-1 py-0.5 rounded"
                    style={{ color: '#4b5563', background: 'rgba(255,255,255,0.04)' }}
                  >✕</button>
                </div>
              </div>

              {/* Inline preview */}
              {isSelected && fileContent && (
                <div className="px-3 py-2" style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <pre className="text-[10px] leading-relaxed overflow-auto max-h-48 whitespace-pre-wrap"
                    style={{ color: '#9ca3af', fontFamily: 'system-ui', scrollbarWidth: 'thin' }}>
                    {fileContent.slice(0, 2000)}{fileContent.length > 2000 ? '\n\n[…continúa]' : ''}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
