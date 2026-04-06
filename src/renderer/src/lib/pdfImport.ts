/**
 * PDF Import — extracts text blocks with approximate positions using pdfjs-dist.
 * Returns structured data that LayoutCanvas converts to LayoutFrames.
 */
import * as pdfjsLib from 'pdfjs-dist'

// Set worker — Vite resolves this URL at bundle time
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).href

export interface PDFTextBlock {
  pageIndex: number
  x: number         // PDF user units (points)
  y: number         // from top of page
  width: number
  height: number
  text: string
  fontSize: number
  isBold: boolean
  isHeading: boolean
}

export interface PDFImportResult {
  pageCount: number
  pageWidthPts: number
  pageHeightPts: number
  pageSizeName: string   // detected nearest standard size
  blocks: PDFTextBlock[]
}

/** Parse a PDF from base64-encoded data and extract text blocks. */
export async function parsePDF(base64Data: string): Promise<PDFImportResult> {
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const pageCount = pdf.numPages
  let pageWidthPts = 595
  let pageHeightPts = 842
  const allBlocks: PDFTextBlock[] = []

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })

    if (p === 1) {
      pageWidthPts = vp.width
      pageHeightPts = vp.height
    }

    const tc = await page.getTextContent()

    // pdfjs TextItem: str, transform[4]=x, transform[5]=y (from bottom), width, height, fontName
    type RawItem = { str: string; transform: number[]; width: number; height: number; fontName: string }
    const items = (tc.items as RawItem[]).filter(i => i.str.trim().length > 0)

    // Convert y: PDF origin is bottom-left; we want top-left origin
    const mapped = items.map(i => ({
      str: i.str,
      x: i.transform[4],
      y: vp.height - i.transform[5] - Math.abs(i.transform[3]),  // top of character
      w: i.width,
      h: Math.abs(i.transform[3]) || i.height || 11,
      fontName: i.fontName || '',
    }))

    // Sort top-to-bottom, left-to-right
    mapped.sort((a, b) => {
      const dy = a.y - b.y
      if (Math.abs(dy) > 4) return dy
      return a.x - b.x
    })

    const blocks = clusterIntoBlocks(mapped, p - 1)
    allBlocks.push(...blocks)
  }

  return {
    pageCount,
    pageWidthPts,
    pageHeightPts,
    pageSizeName: detectPageSizeName(pageWidthPts, pageHeightPts),
    blocks: allBlocks,
  }
}

type MappedItem = { str: string; x: number; y: number; w: number; h: number; fontName: string }

function clusterIntoBlocks(items: MappedItem[], pageIndex: number): PDFTextBlock[] {
  if (items.length === 0) return []

  const blocks: PDFTextBlock[] = []
  let group: MappedItem[] = [items[0]]

  const flush = (g: MappedItem[]) => {
    if (g.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let maxH = 0
    let hasBold = false
    const lines: string[] = []
    let currentLine = ''
    let prevY = -1

    g.forEach(i => {
      if (prevY >= 0 && i.y - prevY > i.h * 0.8) {
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = ''
      }
      currentLine += (currentLine ? ' ' : '') + i.str
      prevY = i.y

      minX = Math.min(minX, i.x)
      minY = Math.min(minY, i.y)
      maxX = Math.max(maxX, i.x + i.w)
      maxY = Math.max(maxY, i.y + i.h)
      maxH = Math.max(maxH, i.h)
      if (i.fontName.toLowerCase().includes('bold')) hasBold = true
    })
    if (currentLine.trim()) lines.push(currentLine.trim())

    const text = lines.join('\n')
    if (!text.trim()) return

    blocks.push({
      pageIndex,
      x: minX,
      y: minY,
      width: Math.max(80, maxX - minX),
      height: Math.max(16, maxY - minY),
      text,
      fontSize: Math.round(maxH),
      isBold: hasBold,
      isHeading: maxH >= 14 || hasBold,
    })
  }

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const cur = items[i]
    // New block if large vertical gap or far left margin jump (new column)
    const gap = cur.y - (prev.y + prev.h)
    if (gap > prev.h * 1.5 || (cur.x < prev.x - 60 && gap > 2)) {
      flush(group)
      group = [cur]
    } else {
      group.push(cur)
    }
  }
  flush(group)

  return blocks
}

/** Detect nearest standard page size name from PDF points. */
function detectPageSizeName(w: number, h: number): string {
  const sizes: Array<[string, number, number]> = [
    ['A4', 595, 842],
    ['Letter', 612, 792],
    ['A5', 420, 595],
    ['Legal', 612, 1008],
  ]
  let best = 'A4'
  let bestDiff = Infinity
  for (const [name, sw, sh] of sizes) {
    const diff = Math.abs(w - sw) + Math.abs(h - sh)
    if (diff < bestDiff) { bestDiff = diff; best = name }
  }
  return best
}
