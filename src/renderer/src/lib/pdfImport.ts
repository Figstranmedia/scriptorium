/**
 * PDF Import — extracts text blocks and graphic regions using pdfjs-dist.
 * Text blocks are clustered into paragraphs; graphic regions (raster images
 * and vector charts) are detected via operator list analysis and returned
 * as cropped JPEG data URLs.
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

export interface PDFGraphicRegion {
  pageIndex: number
  x: number       // PDF points, same coord system as PDFTextBlock
  y: number
  width: number
  height: number
  dataUrl: string  // JPEG crop of the region
}

export interface PDFImportResult {
  pageCount: number
  pageWidthPts: number
  pageHeightPts: number
  pageSizeName: string
  blocks: PDFTextBlock[]
  graphicRegions: PDFGraphicRegion[]
}

/** Parse a PDF from base64-encoded data and extract text blocks + graphic regions. */
export async function parsePDF(base64Data: string): Promise<PDFImportResult> {
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const pageCount = pdf.numPages
  let pageWidthPts = 595
  let pageHeightPts = 842
  const allBlocks: PDFTextBlock[] = []
  const allGraphics: PDFGraphicRegion[] = []

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })

    if (p === 1) {
      pageWidthPts = vp.width
      pageHeightPts = vp.height
    }

    // ── Text extraction ────────────────────────────────────────────────────────
    const tc = await page.getTextContent()
    type RawItem = { str: string; transform: number[]; width: number; height: number; fontName: string }
    const items = (tc.items as RawItem[]).filter(i => i.str.trim().length > 0)

    const mapped = items.map(i => ({
      str: i.str,
      x: i.transform[4],
      y: vp.height - i.transform[5] - Math.abs(i.transform[3]),
      w: i.width,
      h: Math.abs(i.transform[3]) || i.height || 11,
      fontName: i.fontName || '',
    }))
    mapped.sort((a, b) => {
      const dy = a.y - b.y
      if (Math.abs(dy) > 4) return dy
      return a.x - b.x
    })

    const blocks = clusterIntoBlocks(mapped, p - 1)
    allBlocks.push(...blocks)

    // ── Graphic region detection ───────────────────────────────────────────────
    const graphics = await detectGraphicRegions(page, vp, blocks, p - 1)
    allGraphics.push(...graphics)
  }

  return {
    pageCount,
    pageWidthPts,
    pageHeightPts,
    pageSizeName: detectPageSizeName(pageWidthPts, pageHeightPts),
    blocks: allBlocks,
    graphicRegions: allGraphics,
  }
}

// ── Graphic region detection ───────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number }

/** Matrix multiply: result = a × b (both are 6-element [a,b,c,d,e,f] arrays) */
function matMul(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

/** Apply CTM to a point; returns [x, y] in PDF user space */
function applyCtm(ctm: number[], x: number, y: number): [number, number] {
  return [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]
}

/**
 * Detect raster images and large vector graphic zones on a PDF page.
 * Uses pdfjs operator list: tracks CTM to find image XObject placements,
 * and tracks path bounding boxes to find vector chart regions.
 */
async function detectGraphicRegions(
  page: pdfjsLib.PDFPageProxy,
  vp: pdfjsLib.PageViewport,
  textBlocks: PDFTextBlock[],
  pageIndex: number,
): Promise<PDFGraphicRegion[]> {
  const opList = await page.getOperatorList()
  const OPS = (pdfjsLib as any).OPS as Record<string, number>

  // Values confirmed against pdfjs-dist 3.11.x
  const OP_SAVE      = OPS.save      ?? 10
  const OP_RESTORE   = OPS.restore   ?? 11
  const OP_TRANSFORM = OPS.transform ?? 12
  const OP_MOVETO    = OPS.moveTo    ?? 13
  const OP_LINETO    = OPS.lineTo    ?? 14
  const OP_CURVETO   = OPS.curveTo   ?? 15
  const OP_CURVETO2  = OPS.curveTo2  ?? 16
  const OP_CURVETO3  = OPS.curveTo3  ?? 17
  const OP_RECT      = OPS.rectangle ?? 19
  const OP_STROKE    = OPS.stroke    ?? 20
  const OP_FILL      = OPS.fill      ?? 22
  const OP_FILLSTROKE = OPS.fillStroke ?? 24
  const OP_EOFILL    = OPS.eoFill    ?? 23
  const OP_EOFILLSTROKE = OPS.eoFillStroke ?? 25
  const OP_ENDPATH   = OPS.endPath   ?? 28
  const OP_PAINT_IMG = OPS.paintImageXObject ?? 85
  const OP_PAINT_INLINE = OPS.paintInlineImageXObject ?? 86
  const OP_PAINT_JPEG = 82   // not in OPS map but used in some PDFs
  const OP_CONSTRUCT_PATH = OPS.constructPath ?? 91

  const rawBoxes: Box[] = []

  // CTM tracking
  const cmStack: number[][] = []
  let ctm = [1, 0, 0, 1, 0, 0]

  // Path accumulator
  let pathBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null

  const expandPath = (x: number, y: number) => {
    if (!pathBox) pathBox = { minX: x, minY: y, maxX: x, maxY: y }
    else {
      pathBox.minX = Math.min(pathBox.minX, x)
      pathBox.minY = Math.min(pathBox.minY, y)
      pathBox.maxX = Math.max(pathBox.maxX, x)
      pathBox.maxY = Math.max(pathBox.maxY, y)
    }
  }

  const recordPathBox = () => {
    if (!pathBox) return
    const w = pathBox.maxX - pathBox.minX
    const h = pathBox.maxY - pathBox.minY
    if (w > 25 && h > 25) {
      // PDF y is from bottom; convert to top-origin (same as text blocks)
      rawBoxes.push({ x: pathBox.minX, y: vp.height - pathBox.maxY, w, h })
    }
    pathBox = null
  }

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i] as any[]

    if (fn === OP_SAVE) {
      cmStack.push([...ctm])
    } else if (fn === OP_RESTORE) {
      ctm = cmStack.pop() ?? [1, 0, 0, 1, 0, 0]
    } else if (fn === OP_TRANSFORM) {
      ctm = matMul(ctm, args as number[])

    // ── Raster images ──────────────────────────────────────────────────────────
    } else if (fn === OP_PAINT_IMG || fn === OP_PAINT_INLINE || fn === OP_PAINT_JPEG) {
      // Image occupies unit square [0,1]×[0,1]; transform by CTM to get PDF coords
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [cx, cy] of [[0,0],[1,0],[1,1],[0,1]] as [number,number][]) {
        const [px, py] = applyCtm(ctm, cx, cy)
        minX = Math.min(minX, px); maxX = Math.max(maxX, px)
        minY = Math.min(minY, py); maxY = Math.max(maxY, py)
      }
      if (maxX - minX > 20 && maxY - minY > 20) {
        rawBoxes.push({ x: minX, y: vp.height - maxY, w: maxX - minX, h: maxY - minY })
      }

    // ── Individual path ops ────────────────────────────────────────────────────
    } else if (fn === OP_MOVETO || fn === OP_LINETO) {
      const [px, py] = applyCtm(ctm, args[0], args[1])
      expandPath(px, py)
    } else if (fn === OP_CURVETO) {
      for (let j = 0; j < 6; j += 2) {
        const [px, py] = applyCtm(ctm, args[j], args[j + 1])
        expandPath(px, py)
      }
    } else if (fn === OP_CURVETO2 || fn === OP_CURVETO3) {
      for (let j = 0; j < 4; j += 2) {
        const [px, py] = applyCtm(ctm, args[j], args[j + 1])
        expandPath(px, py)
      }
    } else if (fn === OP_RECT) {
      const [x1, y1] = applyCtm(ctm, args[0], args[1])
      const [x2, y2] = applyCtm(ctm, args[0] + args[2], args[1] + args[3])
      expandPath(x1, y1); expandPath(x2, y2)

    // ── Batched constructPath (pdfjs 3.x optimization) ────────────────────────
    } else if (fn === OP_CONSTRUCT_PATH) {
      const ops = args[0] as number[]
      const coords = args[1] as number[]
      let ci = 0
      for (const op of ops) {
        if (op === OP_MOVETO || op === OP_LINETO) {
          const [px, py] = applyCtm(ctm, coords[ci], coords[ci + 1]); ci += 2
          expandPath(px, py)
        } else if (op === OP_CURVETO) {
          for (let j = 0; j < 3; j++) {
            const [px, py] = applyCtm(ctm, coords[ci], coords[ci + 1]); ci += 2
            expandPath(px, py)
          }
        } else if (op === OP_CURVETO2 || op === OP_CURVETO3) {
          for (let j = 0; j < 2; j++) {
            const [px, py] = applyCtm(ctm, coords[ci], coords[ci + 1]); ci += 2
            expandPath(px, py)
          }
        } else if (op === OP_RECT) {
          const [x1, y1] = applyCtm(ctm, coords[ci], coords[ci + 1])
          const [x2, y2] = applyCtm(ctm, coords[ci] + coords[ci + 2], coords[ci + 1] + coords[ci + 3])
          ci += 4
          expandPath(x1, y1); expandPath(x2, y2)
        }
      }

    // ── Path termination → flush accumulated box ───────────────────────────────
    } else if (
      fn === OP_STROKE || fn === OP_FILL || fn === OP_FILLSTROKE ||
      fn === OP_EOFILL || fn === OP_EOFILLSTROKE || fn === OP_ENDPATH
    ) {
      recordPathBox()
    }
  }
  recordPathBox()

  if (rawBoxes.length === 0) return []

  // ── Merge nearby boxes into unified regions ───────────────────────────────────
  const MERGE_GAP = 20  // pt — merge boxes closer than this
  const merged = mergeBoxes(rawBoxes, MERGE_GAP)

  // ── Filter: remove tiny regions and those mostly covered by text ──────────────
  const MIN_PT = 50
  const pageTextBlocks = textBlocks.filter(t => t.pageIndex === pageIndex)
  const significant = merged.filter(box => {
    if (box.w < MIN_PT || box.h < MIN_PT) return false
    const area = box.w * box.h
    const textOverlap = pageTextBlocks.reduce((sum, t) => {
      const ox = Math.max(0, Math.min(box.x + box.w, t.x + t.width) - Math.max(box.x, t.x))
      const oy = Math.max(0, Math.min(box.y + box.h, t.y + t.height) - Math.max(box.y, t.y))
      return sum + ox * oy
    }, 0)
    return textOverlap / area < 0.6
  })

  if (significant.length === 0) return []

  // ── Render page and crop each region ─────────────────────────────────────────
  const RENDER_SCALE = 1.5
  const vpRender = page.getViewport({ scale: RENDER_SCALE })
  const pageCanvas = window.document.createElement('canvas')
  pageCanvas.width = Math.round(vpRender.width)
  pageCanvas.height = Math.round(vpRender.height)
  const pageCtx = pageCanvas.getContext('2d')!
  await page.render({ canvasContext: pageCtx, viewport: vpRender }).promise

  const CROP_MARGIN = 6  // pt of extra padding
  return significant.map(box => {
    const sx = Math.max(0, (box.x - CROP_MARGIN) * RENDER_SCALE)
    const sy = Math.max(0, (box.y - CROP_MARGIN) * RENDER_SCALE)
    const sw = Math.min(pageCanvas.width - sx, (box.w + CROP_MARGIN * 2) * RENDER_SCALE)
    const sh = Math.min(pageCanvas.height - sy, (box.h + CROP_MARGIN * 2) * RENDER_SCALE)

    const cropCanvas = window.document.createElement('canvas')
    cropCanvas.width = Math.round(sw)
    cropCanvas.height = Math.round(sh)
    cropCanvas.getContext('2d')!.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, sw, sh)

    return {
      pageIndex,
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      dataUrl: cropCanvas.toDataURL('image/jpeg', 0.92),
    }
  })
}

/** Merge overlapping or nearby bounding boxes (greedy iterative pass). */
function mergeBoxes(boxes: Box[], gap: number): Box[] {
  const result = [...boxes]
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j]
        if (
          a.x - gap < b.x + b.w && a.x + a.w + gap > b.x &&
          a.y - gap < b.y + b.h && a.y + a.h + gap > b.y
        ) {
          result[i] = {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
            h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
          }
          result.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }
  return result
}

// ── Text clustering (unchanged) ───────────────────────────────────────────────

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

/**
 * Renders each page of a PDF to a canvas and returns base64 data URLs.
 * Use this to import a PDF as image frames instead of text frames.
 */
export async function renderPDFToImages(
  base64Data: string,
  scale = 1.5,
): Promise<Array<{ pageIndex: number; dataUrl: string; widthPx: number; heightPx: number }>> {
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const results: Array<{ pageIndex: number; dataUrl: string; widthPx: number; heightPx: number }> = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale })

    const canvas = window.document.createElement('canvas')
    canvas.width  = Math.round(vp.width)
    canvas.height = Math.round(vp.height)
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport: vp }).promise
    results.push({
      pageIndex: p - 1,
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      widthPx: canvas.width,
      heightPx: canvas.height,
    })
  }
  return results
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
