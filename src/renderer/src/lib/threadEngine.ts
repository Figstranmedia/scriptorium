/**
 * Text Thread Engine
 * Distributes HTML content across a chain of frames using DOM measurement.
 * Each frame gets as much content as fits; overflow goes to the next linked frame.
 */

export interface LayoutFrame {
  id: string
  x: number
  y: number
  width: number
  height: number
  pageIndex: number
  threadNextId: string | null
  threadPrevId: string | null
  columns: number
  columnGutter: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  fontSize: number
  lineHeight: number
  fontFamily: string   // 'serif' | 'sans' | 'mono' or any installed font name
  // Direct content (when frame is standalone, not threaded)
  ownContent: string
  // Paragraph style
  textAlign: 'left' | 'center' | 'right' | 'justify'
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textColor: string
  letterSpacing: number
  // Layer
  zIndex: number
  locked: boolean
  // Appearance
  backgroundColor: string
  borderColor: string
  borderWidth: number
  borderStyle: 'solid' | 'dashed' | 'dotted'
  cornerRadius: number
  opacity: number
}

export interface LayoutImageFrame {
  id: string
  x: number
  y: number
  width: number
  height: number
  pageIndex: number
  src: string
  fit: 'fill' | 'fit' | 'crop'
  caption: string
  zIndex: number
  locked: boolean
  opacity: number
  cornerRadius: number
  borderColor: string
  borderWidth: number
}

export type AnyLayoutFrame = LayoutFrame | LayoutImageFrame

export interface ThreadResult {
  frameId: string
  html: string
  isOverflowing: boolean
}

/**
 * Measures how many HTML block elements (p, h1-h6, blockquote, ul, ol, pre)
 * fit within a container of given dimensions.
 * Uses a hidden off-screen div for measurement.
 */
export function distributeContent(
  htmlContent: string,
  frames: LayoutFrame[],
): Map<string, string> {
  const result = new Map<string, string>()
  if (frames.length === 0 || !htmlContent.trim()) return result

  // Build ordered chain of frames
  const chain = buildChain(frames)
  if (chain.length === 0) return result

  // Parse HTML into block elements
  const blocks = parseBlocks(htmlContent)
  let remaining = [...blocks]

  for (const frame of chain) {
    if (remaining.length === 0) {
      result.set(frame.id, '')
      continue
    }

    const innerWidth = frame.width - frame.paddingLeft - frame.paddingRight
    const innerHeight = frame.height - frame.paddingTop - frame.paddingBottom

    const { fitted, overflow } = fitBlocksInFrame(remaining, innerWidth, innerHeight, frame)
    result.set(frame.id, fitted.join(''))
    remaining = overflow

    if (remaining.length === 0) break
  }

  // If still overflow after last frame, append to last frame with overflow marker
  if (remaining.length > 0 && chain.length > 0) {
    const lastId = chain[chain.length - 1].id
    const existing = result.get(lastId) || ''
    result.set(lastId, existing + remaining.join(''))
  }

  return result
}

/**
 * Determines if content fits inside a frame by rendering into a hidden div.
 */
function fitBlocksInFrame(
  blocks: string[],
  innerWidth: number,
  innerHeight: number,
  frame: LayoutFrame,
): { fitted: string[]; overflow: string[] } {
  // Create measurement container
  const container = window.document.createElement('div')
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: ${innerWidth}px;
    height: ${innerHeight}px;
    overflow: hidden;
    font-size: ${frame.fontSize}px;
    line-height: ${frame.lineHeight};
    font-family: ${frame.fontFamily === 'serif' ? 'Lora, Georgia, serif' : frame.fontFamily === 'sans' ? 'Figtree, sans-serif' : frame.fontFamily === 'mono' ? 'monospace' : `"${frame.fontFamily}"`};
    column-count: ${frame.columns > 1 ? frame.columns : 'unset'};
    column-gap: ${frame.columnGutter}px;
    word-wrap: break-word;
    white-space: normal;
  `
  window.document.body.appendChild(container)

  let fittedCount = 0
  let overflowCount = blocks.length

  // Binary search for the split point
  let lo = 0
  let hi = blocks.length

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    container.innerHTML = blocks.slice(0, mid + 1).join('')

    if (container.scrollHeight <= innerHeight) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  fittedCount = lo
  overflowCount = blocks.length - lo

  window.document.body.removeChild(container)

  return {
    fitted: blocks.slice(0, fittedCount),
    overflow: blocks.slice(fittedCount),
  }
}

/**
 * Builds an ordered array of frames following threadNext links.
 */
function buildChain(frames: LayoutFrame[]): LayoutFrame[] {
  const frameMap = new Map(frames.map(f => [f.id, f]))

  // Find the first frame in each chain (no threadPrevId or threadPrevId points to non-existent)
  const starts = frames.filter(f => !f.threadPrevId || !frameMap.has(f.threadPrevId))

  if (starts.length === 0) return frames

  const chain: LayoutFrame[] = []
  const visited = new Set<string>()

  // Follow the longest chain from the first start
  let current: LayoutFrame | undefined = starts[0]
  while (current && !visited.has(current.id)) {
    chain.push(current)
    visited.add(current.id)
    current = current.threadNextId ? frameMap.get(current.threadNextId) : undefined
  }

  return chain
}

/**
 * Parses HTML into an array of block-level HTML strings.
 */
function parseBlocks(html: string): string[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.querySelector('div')!
  const blocks: string[] = []

  container.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push((node as Element).outerHTML)
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      blocks.push(`<p>${node.textContent}</p>`)
    }
  })

  return blocks.length > 0 ? blocks : [`<p>${html}</p>`]
}

// ── Default frame factory ────────────────────────────────────────────────────

let _frameCounter = 0
export function createDefaultFrame(
  pageIndex: number,
  x: number,
  y: number,
  partial?: Partial<LayoutFrame>,
): LayoutFrame {
  _frameCounter++
  return {
    id: `lf_${Date.now()}_${_frameCounter}`,
    x, y,
    width: 400,
    height: 500,
    pageIndex,
    threadNextId: null,
    threadPrevId: null,
    columns: 1,
    columnGutter: 20,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    fontSize: 11,
    lineHeight: 1.75,
    fontFamily: 'serif',
    ownContent: '',
    textAlign: 'left',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textColor: '#1a1714',
    letterSpacing: 0,
    zIndex: 10,
    locked: false,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderStyle: 'solid',
    cornerRadius: 0,
    opacity: 1,
    ...partial,
  }
}

export function createDefaultImageFrame(
  pageIndex: number,
  x: number,
  y: number,
): LayoutImageFrame {
  return {
    id: `lif_${Date.now()}`,
    x, y,
    width: 300,
    height: 200,
    pageIndex,
    src: '',
    fit: 'fit',
    caption: '',
    zIndex: 10,
    locked: false,
    opacity: 1,
    cornerRadius: 0,
    borderColor: 'transparent',
    borderWidth: 0,
  }
}

// ── Type guard ────────────────────────────────────────────────────────────────
export function isImageFrame(f: AnyLayoutFrame): f is LayoutImageFrame {
  return 'src' in f
}
