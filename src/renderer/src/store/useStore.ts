import { useState, useCallback } from 'react'

export type DocType = 'book' | 'paper' | 'thesis' | 'research' | 'notes'
export type SidebarTab = 'research' | 'suggest' | 'restructure' | 'browser' | 'replace' | 'bibliography'
export type LayoutStyle = 'default' | 'book' | 'thesis' | 'paper'
export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee'

export interface Reference {
  id: string
  type: 'book' | 'article' | 'website' | 'thesis' | 'conference'
  author: string          // "Apellido, N." o "Apellido, N. & Apellido2, N."
  title: string
  year: string
  publisher?: string
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  url?: string
  doi?: string
  city?: string
  edition?: string
  accessDate?: string
}

export interface Document {
  id: string
  title: string
  content: string
  docType: DocType
  layout: LayoutStyle
  frames?: any[]
  references?: Reference[]
  citationStyle?: CitationStyle
  layoutFrames?: any[]
  layoutPageCount?: number
  layoutPageSize?: string
  layoutMasters?: any[]
  layoutPageAssignments?: Record<number, string>
  createdAt: number
  updatedAt: number
}

export interface AIResult {
  type: SidebarTab
  loading: boolean
  content: string
  error: string
}

export function useStore() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('research')
  const [browserUrl, setBrowserUrl] = useState('https://scholar.google.com')
  const [aiResult, setAIResult] = useState<AIResult>({ type: 'research', loading: false, content: '', error: '' })
  const [selectedText, setSelectedText] = useState('')
  const [apiKey, setApiKeyState] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const activeDoc = documents.find(d => d.id === activeDocId) || null

  const createDocument = useCallback((docType: DocType = 'book') => {
    const id = `doc_${Date.now()}`
    const doc: Document = {
      id,
      title: 'Sin título',
      content: '',
      docType,
      layout: docType === 'book' ? 'book' : docType === 'thesis' ? 'thesis' : docType === 'paper' ? 'paper' : 'default',
      references: [],
      citationStyle: 'apa',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setDocuments(prev => [...prev, doc])
    setActiveDocId(id)
    return doc
  }, [])

  const updateDocument = useCallback((id: string, updates: Partial<Document>) => {
    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d)
    )
  }, [])

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => {
      const next = prev.filter(d => d.id !== id)
      if (activeDocId === id) {
        setActiveDocId(next.length > 0 ? next[next.length - 1].id : null)
      }
      return next
    })
  }, [activeDocId])

  return {
    documents, setDocuments,
    activeDocId, setActiveDocId,
    activeDoc,
    sidebarOpen, setSidebarOpen,
    sidebarTab, setSidebarTab,
    browserUrl, setBrowserUrl,
    aiResult, setAIResult,
    selectedText, setSelectedText,
    apiKey, setApiKeyState,
    showSettings, setShowSettings,
    showExport, setShowExport,
    createDocument,
    updateDocument,
    deleteDocument,
  }
}
