import { useState, useCallback } from 'react'

export type DocType = 'book' | 'paper' | 'thesis' | 'research' | 'notes' | 'cover'

export const PAPER_THICKNESS_MM: Record<80 | 90 | 115, number> = {
  80: 0.05,    // mm per page
  90: 0.055,
  115: 0.0675,
}

export const BOOK_FORMATS = [
  { id: '14x21',  label: '14 × 21 cm', widthMM: 140, heightMM: 210 },
  { id: '15x23',  label: '15 × 23 cm', widthMM: 150, heightMM: 230 },
  { id: '21x297', label: '21 × 29.7 cm (A4)', widthMM: 210, heightMM: 297 },
  { id: 'custom', label: 'Personalizado', widthMM: 0, heightMM: 0 },
] as const

export interface CoverConfig {
  formatId: string
  coverWidthMM: number
  coverHeightMM: number
  pageCount: number
  paperWeight: 80 | 90 | 115
  bleedMM: number
  spineMM: number    // calculated: pageCount × thickness
}
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

export interface ParagraphStyle {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right' | 'justify'
  textColor: string
  letterSpacing: number
}

export const DEFAULT_PARAGRAPH_STYLES: ParagraphStyle[] = [
  { id: 'ps-body',    name: 'Cuerpo',      fontFamily: 'serif', fontSize: 12, lineHeight: 1.6, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left',   textColor: '#1a1714', letterSpacing: 0 },
  { id: 'ps-h1',     name: 'Título 1',    fontFamily: 'sans',  fontSize: 28, lineHeight: 1.2, fontWeight: 'bold',   fontStyle: 'normal', textAlign: 'left',   textColor: '#1a1714', letterSpacing: 0 },
  { id: 'ps-h2',     name: 'Título 2',    fontFamily: 'sans',  fontSize: 20, lineHeight: 1.3, fontWeight: 'bold',   fontStyle: 'normal', textAlign: 'left',   textColor: '#1a1714', letterSpacing: 0 },
  { id: 'ps-quote',  name: 'Epígrafe',    fontFamily: 'serif', fontSize: 11, lineHeight: 1.5, fontWeight: 'normal', fontStyle: 'italic', textAlign: 'left',   textColor: '#5c5043', letterSpacing: 0.5 },
  { id: 'ps-caption',name: 'Pie de foto', fontFamily: 'sans',  fontSize: 9,  lineHeight: 1.4, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center', textColor: '#64748b', letterSpacing: 0 },
]

export interface Guide {
  id: string
  axis: 'h' | 'v'
  position: number  // page pixels
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
  layoutGuides?: Guide[]
  paragraphStyles?: ParagraphStyle[]
  coverConfig?: CoverConfig
  filePath?: string
  projectFolderPath?: string
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
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle')
  const [ollamaActiveModel, setOllamaActiveModel] = useState('')
  const [pendingChatMessage, setPendingChatMessage] = useState<{ text: string; action: string } | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

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
      paragraphStyles: DEFAULT_PARAGRAPH_STYLES,
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

  const upsertDocument = useCallback((doc: Document) => {
    setDocuments(prev => {
      const exists = prev.some(d => d.id === doc.id)
      return exists ? prev.map(d => d.id === doc.id ? { ...d, ...doc } : d) : [...prev, doc]
    })
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
    upsertDocument,
    sidebarOpen, setSidebarOpen,
    sidebarTab, setSidebarTab,
    browserUrl, setBrowserUrl,
    aiResult, setAIResult,
    selectedText, setSelectedText,
    apiKey, setApiKeyState,
    showSettings, setShowSettings,
    showExport, setShowExport,
    ollamaStatus, setOllamaStatus,
    ollamaActiveModel, setOllamaActiveModel,
    pendingChatMessage, setPendingChatMessage,
    theme, setTheme,
    createDocument,
    updateDocument,
    deleteDocument,
  }
}
