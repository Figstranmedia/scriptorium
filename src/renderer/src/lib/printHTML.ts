import type { Document, CitationStyle } from '../store/useStore'
import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame, LayoutShapeFrame, LayoutChartFrame } from './threadEngine'
import { isImageFrame, isShapeFrame, isChartFrame } from './threadEngine'
import { formatReference } from './citations'

export interface PDFOptions {
  pageSize: 'A4' | 'Letter' | 'A5' | 'Legal'
  marginTop: number     // mm
  marginBottom: number
  marginLeft: number
  marginRight: number
  includePageNumbers: boolean
  pageNumberPosition: 'bottom-center' | 'bottom-right' | 'top-right'
  citationStyle: CitationStyle
}

// ─── Layout Export ────────────────────────────────────────────────────────────

export interface LayoutExportOptions {
  bleedMM: number      // 0 = no bleed, 3 = standard print bleed
  cropMarks: boolean
  includeBackground: boolean
}

export const DEFAULT_LAYOUT_EXPORT_OPTIONS: LayoutExportOptions = {
  bleedMM: 0,
  cropMarks: false,
  includeBackground: true,
}

const LAYOUT_PAGE_SIZES: Record<string, { widthMM: number; heightMM: number }> = {
  A4:     { widthMM: 210, heightMM: 297 },
  Letter: { widthMM: 216, heightMM: 279 },
  A5:     { widthMM: 148, heightMM: 210 },
  Legal:  { widthMM: 216, heightMM: 356 },
}

/** Convert layout px (96 DPI) to mm */
function pxToMm(px: number): number {
  return (px * 25.4) / 96
}

function resolveFont(family: string): string {
  if (family === 'serif') return 'Georgia, "Times New Roman", serif'
  if (family === 'sans')  return '"Helvetica Neue", Arial, sans-serif'
  if (family === 'mono')  return '"Courier New", monospace'
  return `"${family}", Georgia, serif`
}

const DASH_ARRAY: Record<string, string> = {
  solid: '',
  dashed: '8,4',
  dotted: '2,4',
}

function frameToHTML(f: AnyLayoutFrame): string {
  const xMm  = pxToMm(f.x).toFixed(3)
  const yMm  = pxToMm(f.y).toFixed(3)
  const wMm  = pxToMm(f.width).toFixed(3)
  const hMm  = pxToMm(f.height).toFixed(3)
  const rMm  = pxToMm(f.cornerRadius ?? 0).toFixed(3)

  if (isChartFrame(f)) {
    const cf = f as LayoutChartFrame
    const svgContent = cf.svgCache
      ? cf.svgCache.replace(/width="[^"]*"/, `width="${wMm}mm"`).replace(/height="[^"]*"/, `height="${hMm}mm"`)
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-family:sans-serif;font-size:12px;">Gráfico</div>`
    return `<div style="position:absolute;left:${xMm}mm;top:${yMm}mm;width:${wMm}mm;height:${hMm}mm;opacity:${cf.opacity};overflow:hidden;">${svgContent}</div>`
  }

  if (isShapeFrame(f)) {
    const sf = f as LayoutShapeFrame
    const w = pxToMm(sf.width)
    const h = pxToMm(sf.height)
    const sw = pxToMm(sf.strokeWidth)
    const da = DASH_ARRAY[sf.strokeStyle] || ''
    const dashAttr = da ? ` stroke-dasharray="${da}"` : ''
    let inner = ''

    if (sf.shapeType === 'rect') {
      const rx = pxToMm(sf.cornerRadius ?? 0)
      inner = `<rect x="${(sw/2).toFixed(3)}" y="${(sw/2).toFixed(3)}" width="${Math.max(0,w-sw).toFixed(3)}" height="${Math.max(0,h-sw).toFixed(3)}" fill="${sf.fillColor||'transparent'}" stroke="${sf.strokeColor||'none'}" stroke-width="${sw.toFixed(3)}" rx="${rx.toFixed(3)}"${dashAttr}/>`
    } else if (sf.shapeType === 'ellipse') {
      inner = `<ellipse cx="${(w/2).toFixed(3)}" cy="${(h/2).toFixed(3)}" rx="${Math.max(0,(w-sw)/2).toFixed(3)}" ry="${Math.max(0,(h-sw)/2).toFixed(3)}" fill="${sf.fillColor||'transparent'}" stroke="${sf.strokeColor||'none'}" stroke-width="${sw.toFixed(3)}"${dashAttr}/>`
    } else {
      inner = `<line x1="0" y1="${(h/2).toFixed(3)}" x2="${w.toFixed(3)}" y2="${(h/2).toFixed(3)}" stroke="${sf.strokeColor||'#64748b'}" stroke-width="${sw.toFixed(3)}"${dashAttr}/>`
    }

    return `<div style="position:absolute;left:${xMm}mm;top:${yMm}mm;width:${wMm}mm;height:${hMm}mm;opacity:${sf.opacity};"><svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" overflow="visible">${inner}</svg></div>`
  }

  if (isImageFrame(f)) {
    const img = f as LayoutImageFrame
    const fitCSS = img.fit === 'fit' ? 'object-fit:contain'
      : img.fit === 'fill' ? 'object-fit:cover'
      : 'object-fit:cover'
    const border = img.borderWidth > 0
      ? `border:${pxToMm(img.borderWidth).toFixed(2)}mm solid ${img.borderColor};` : ''
    return `<div style="position:absolute;left:${xMm}mm;top:${yMm}mm;width:${wMm}mm;height:${hMm}mm;overflow:hidden;border-radius:${rMm}mm;opacity:${img.opacity};${border}">` +
      `<img src="${img.src}" style="width:100%;height:100%;display:block;${fitCSS}" /></div>`
  }

  const tf = f as LayoutFrame
  const ptop  = pxToMm(tf.paddingTop    ?? 4).toFixed(2)
  const pright = pxToMm(tf.paddingRight ?? 6).toFixed(2)
  const pbot  = pxToMm(tf.paddingBottom ?? 4).toFixed(2)
  const pleft = pxToMm(tf.paddingLeft   ?? 6).toFixed(2)
  const bg    = (tf.backgroundColor && tf.backgroundColor !== 'transparent') ? `background:${tf.backgroundColor};` : ''
  const border = tf.borderWidth > 0
    ? `border:${pxToMm(tf.borderWidth).toFixed(2)}mm ${tf.borderStyle ?? 'solid'} ${tf.borderColor};` : ''
  const cols  = tf.columns > 1
    ? `column-count:${tf.columns};column-gap:${pxToMm(tf.columnGutter ?? 12).toFixed(2)}mm;` : ''

  return `<div style="position:absolute;left:${xMm}mm;top:${yMm}mm;width:${wMm}mm;height:${hMm}mm;overflow:hidden;` +
    `font-family:${resolveFont(tf.fontFamily)};font-size:${tf.fontSize}pt;line-height:${tf.lineHeight};` +
    `font-weight:${tf.fontWeight};font-style:${tf.fontStyle};text-align:${tf.textAlign};color:${tf.textColor};` +
    `letter-spacing:${(tf.letterSpacing ?? 0) / 1000}em;` +
    `padding:${ptop}mm ${pright}mm ${pbot}mm ${pleft}mm;` +
    `${bg}${border}border-radius:${rMm}mm;opacity:${tf.opacity ?? 1};${cols}">${tf.ownContent || ''}</div>`
}

/** Generate full print-ready HTML for a layout document */
export function generateLayoutPrintHTML(doc: Document, opts: LayoutExportOptions): string {
  const frames   = (doc.layoutFrames  || []) as AnyLayoutFrame[]
  const pageCount = doc.layoutPageCount || 1
  const sizeKey  = doc.layoutPageSize  || 'A4'
  const pageSize = LAYOUT_PAGE_SIZES[sizeKey] ?? LAYOUT_PAGE_SIZES.A4
  const { widthMM, heightMM } = pageSize
  const bleed = opts.bleedMM
  const totalW = widthMM + bleed * 2
  const totalH = heightMM + bleed * 2

  const cropMarkCSS = opts.cropMarks && bleed > 0 ? `
    .cm{position:absolute;background:#000000}
    .cm-tl-h{top:${(bleed-0.5).toFixed(1)}mm;left:0;width:${(bleed-0.3).toFixed(1)}mm;height:.2mm}
    .cm-tl-v{top:0;left:${(bleed-0.5).toFixed(1)}mm;width:.2mm;height:${(bleed-0.3).toFixed(1)}mm}
    .cm-tr-h{top:${(bleed-0.5).toFixed(1)}mm;right:0;width:${(bleed-0.3).toFixed(1)}mm;height:.2mm}
    .cm-tr-v{top:0;right:${(bleed-0.5).toFixed(1)}mm;width:.2mm;height:${(bleed-0.3).toFixed(1)}mm}
    .cm-bl-h{bottom:${(bleed-0.5).toFixed(1)}mm;left:0;width:${(bleed-0.3).toFixed(1)}mm;height:.2mm}
    .cm-bl-v{bottom:0;left:${(bleed-0.5).toFixed(1)}mm;width:.2mm;height:${(bleed-0.3).toFixed(1)}mm}
    .cm-br-h{bottom:${(bleed-0.5).toFixed(1)}mm;right:0;width:${(bleed-0.3).toFixed(1)}mm;height:.2mm}
    .cm-br-v{bottom:0;right:${(bleed-0.5).toFixed(1)}mm;width:.2mm;height:${(bleed-0.3).toFixed(1)}mm}
  ` : ''

  const cropMarkHTML = opts.cropMarks && bleed > 0
    ? '<div class="cm cm-tl-h"></div><div class="cm cm-tl-v"></div>' +
      '<div class="cm cm-tr-h"></div><div class="cm cm-tr-v"></div>' +
      '<div class="cm cm-bl-h"></div><div class="cm cm-bl-v"></div>' +
      '<div class="cm cm-br-h"></div><div class="cm cm-br-v"></div>'
    : ''

  const pagesHTML = Array.from({ length: pageCount }, (_, i) => {
    const pFrames = [...frames.filter(f => f.pageIndex === i)]
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    const framesHTML = pFrames.map(frameToHTML).join('')

    return `<div style="position:relative;width:${totalW}mm;height:${totalH}mm;background:white;overflow:hidden;page-break-after:always;">` +
      cropMarkHTML +
      `<div style="position:absolute;top:${bleed}mm;left:${bleed}mm;width:${widthMM}mm;height:${heightMM}mm;overflow:hidden;">` +
      framesHTML + '</div></div>'
  }).join('\n')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  @page{size:${totalW}mm ${totalH}mm;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{margin:0;padding:0;background:#888}
  ${cropMarkCSS}
</style></head><body>${pagesHTML}</body></html>`
}

export const DEFAULT_PDF_OPTIONS: PDFOptions = {
  pageSize: 'A4',
  marginTop: 25,
  marginBottom: 25,
  marginLeft: 30,
  marginRight: 25,
  includePageNumbers: true,
  pageNumberPosition: 'bottom-center',
  citationStyle: 'apa',
}

// ─── SVG / Affinity Export ────────────────────────────────────────────────────

/** Convert a single layout page to a self-contained SVG string.
 *  Compatible with Affinity Designer 2 (uses foreignObject for text). */
export function generatePageSVG(
  frames: AnyLayoutFrame[],
  pageIndex: number,
  widthMM: number,
  heightMM: number,
): string {
  const W = widthMM
  const H = heightMM

  const pageFrames = [...frames.filter(f => f.pageIndex === pageIndex)]
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  const elements = pageFrames.map(f => {
    const x  = pxToMm(f.x)
    const y  = pxToMm(f.y)
    const w  = pxToMm(f.width)
    const h  = pxToMm(f.height)
    const op = f.opacity ?? 1

    if (isChartFrame(f)) {
      const cf = f as LayoutChartFrame
      if (cf.svgCache) {
        // Wrap existing SVG in a group at correct position
        const inner = cf.svgCache
          .replace(/<svg[^>]*>/, '')
          .replace(/<\/svg>/, '')
        return `<g transform="translate(${x.toFixed(3)},${y.toFixed(3)})" opacity="${op}">` +
          `<svg width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" xmlns="http://www.w3.org/2000/svg">${inner}</svg></g>`
      }
      return `<rect x="${x.toFixed(3)}mm" y="${y.toFixed(3)}mm" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" fill="#f3f4f6" opacity="${op}"/>`
    }

    if (isShapeFrame(f)) {
      const sf = f as LayoutShapeFrame
      const sw = pxToMm(sf.strokeWidth)
      const da = sf.strokeStyle === 'dashed' ? 'stroke-dasharray="8,4"' : sf.strokeStyle === 'dotted' ? 'stroke-dasharray="2,4"' : ''
      const fill = sf.fillColor || 'transparent'
      const stroke = sf.strokeColor || 'none'
      const rx = pxToMm(sf.cornerRadius ?? 0)

      if (sf.shapeType === 'line') {
        return `<line x1="${x.toFixed(3)}mm" y1="${(y + h/2).toFixed(3)}mm" x2="${(x+w).toFixed(3)}mm" y2="${(y + h/2).toFixed(3)}mm" stroke="${stroke}" stroke-width="${sw.toFixed(3)}mm" ${da} opacity="${op}"/>`
      }
      if (sf.shapeType === 'ellipse') {
        return `<ellipse cx="${(x+w/2).toFixed(3)}mm" cy="${(y+h/2).toFixed(3)}mm" rx="${Math.max(0,(w-sw)/2).toFixed(3)}mm" ry="${Math.max(0,(h-sw)/2).toFixed(3)}mm" fill="${fill}" stroke="${stroke}" stroke-width="${sw.toFixed(3)}mm" ${da} opacity="${op}"/>`
      }
      return `<rect x="${(x+sw/2).toFixed(3)}mm" y="${(y+sw/2).toFixed(3)}mm" width="${Math.max(0,w-sw).toFixed(3)}mm" height="${Math.max(0,h-sw).toFixed(3)}mm" fill="${fill}" stroke="${stroke}" stroke-width="${sw.toFixed(3)}mm" rx="${rx.toFixed(3)}mm" ${da} opacity="${op}"/>`
    }

    if (isImageFrame(f)) {
      const img = f as LayoutImageFrame
      const r = pxToMm(img.cornerRadius ?? 0)
      const bw = pxToMm(img.borderWidth ?? 0)
      const clipId = `clip_${f.id}`
      const clipRect = r > 0
        ? `<clipPath id="${clipId}"><rect x="${x.toFixed(3)}mm" y="${y.toFixed(3)}mm" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" rx="${r.toFixed(3)}mm"/></clipPath>`
        : ''
      const clipAttr = r > 0 ? ` clip-path="url(#${clipId})"` : ''
      const aspect = img.fit === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'
      const border = bw > 0 ? `<rect x="${x.toFixed(3)}mm" y="${y.toFixed(3)}mm" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" fill="none" stroke="${img.borderColor||'#000'}" stroke-width="${bw.toFixed(3)}mm" rx="${r.toFixed(3)}mm"/>` : ''
      return `${clipRect}<image href="${img.src}" x="${x.toFixed(3)}mm" y="${y.toFixed(3)}mm" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" preserveAspectRatio="${aspect}" opacity="${op}"${clipAttr}/>${border}`
    }

    // Text frame
    const tf = f as LayoutFrame
    const bg = (tf.backgroundColor && tf.backgroundColor !== 'transparent')
      ? `<rect x="${x.toFixed(3)}mm" y="${y.toFixed(3)}mm" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" fill="${tf.backgroundColor}" opacity="${op}"/>`
      : ''
    const bw = pxToMm(tf.borderWidth ?? 0)
    const r  = pxToMm(tf.cornerRadius ?? 0)
    const border = bw > 0
      ? `<rect x="${x.toFixed(3)}mm" y="${y.toFixed(3)}mm" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" fill="none" stroke="${tf.borderColor||'#000'}" stroke-width="${bw.toFixed(3)}mm" rx="${r.toFixed(3)}mm" opacity="${op}"/>`
      : ''
    const pt = pxToMm(tf.paddingTop ?? 4)
    const pl = pxToMm(tf.paddingLeft ?? 6)
    const font = resolveFont(tf.fontFamily)
    // foreignObject for rich HTML text
    const fo = `<foreignObject x="${(x+pl).toFixed(3)}mm" y="${(y+pt).toFixed(3)}mm" width="${Math.max(0,w-pl*2).toFixed(3)}mm" height="${Math.max(0,h-pt*2).toFixed(3)}mm" opacity="${op}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${font};font-size:${tf.fontSize}pt;line-height:${tf.lineHeight};font-weight:${tf.fontWeight};font-style:${tf.fontStyle};text-align:${tf.textAlign};color:${tf.textColor};overflow:hidden;width:100%;height:100%;">${tf.ownContent || ''}</div>` +
      `</foreignObject>`
    return `${bg}${fo}${border}`
  }).join('\n    ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${elements}
</svg>`
}

/** Generate SVG files for all pages of a layout document */
export function generateLayoutSVGPages(doc: Document): Array<{ svg: string; pageIndex: number }> {
  const frames   = (doc.layoutFrames  || []) as AnyLayoutFrame[]
  const pageCount = doc.layoutPageCount || 1
  const sizeKey  = doc.layoutPageSize  || 'A4'
  const pageSize = LAYOUT_PAGE_SIZES[sizeKey] ?? LAYOUT_PAGE_SIZES.A4

  return Array.from({ length: pageCount }, (_, i) => ({
    svg: generatePageSVG(frames, i, pageSize.widthMM, pageSize.heightMM),
    pageIndex: i,
  }))
}

const PAGE_SIZES = {
  A4:     { width: '210mm', height: '297mm' },
  Letter: { width: '216mm', height: '279mm' },
  A5:     { width: '148mm', height: '210mm' },
  Legal:  { width: '216mm', height: '356mm' },
}

export function generatePrintHTML(doc: Document, opts: PDFOptions): string {
  const size = PAGE_SIZES[opts.pageSize]
  const refs = doc.references || []

  // Build bibliography HTML
  const bibliographyHTML = refs.length > 0
    ? `<div class="bibliography">
        <h2>Referencias bibliográficas</h2>
        <ol class="ref-list">
          ${refs.map((r, i) => `<li class="ref-item">${markdownToHTML(formatReference(r, i + 1, opts.citationStyle))}</li>`).join('\n')}
        </ol>
      </div>`
    : ''

  const pageNumberCSS = opts.includePageNumbers ? `
    @page { @bottom-center { content: counter(page); font-family: serif; font-size: 10pt; } }
  ` : ''

  const positionedPageNum = opts.pageNumberPosition === 'bottom-center'
    ? 'text-align:center;'
    : opts.pageNumberPosition === 'bottom-right'
    ? 'text-align:right;'
    : 'text-align:right;'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(doc.title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Figtree:wght@400;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: ${size.width} ${size.height};
      margin: ${opts.marginTop}mm ${opts.marginRight}mm ${opts.marginBottom}mm ${opts.marginLeft}mm;
      ${pageNumberCSS}
    }

    html, body {
      font-family: 'Lora', Georgia, serif;
      font-size: ${doc.layout === 'thesis' ? '12pt' : '11pt'};
      line-height: ${doc.layout === 'thesis' ? '2' : '1.85'};
      color: #1a1714;
      background: white;
    }

    /* Page number counter */
    body { counter-reset: page; }

    h1 {
      font-family: 'Figtree', sans-serif;
      font-size: 2em;
      font-weight: 700;
      margin: 2em 0 0.8em;
      line-height: 1.2;
      border-bottom: 1.5pt solid #ccc;
      padding-bottom: 0.4em;
      page-break-after: avoid;
    }
    h2 {
      font-family: 'Figtree', sans-serif;
      font-size: 1.45em;
      font-weight: 600;
      margin: 1.8em 0 0.6em;
      page-break-after: avoid;
    }
    h3 {
      font-family: 'Figtree', sans-serif;
      font-size: 1.15em;
      font-weight: 600;
      margin: 1.4em 0 0.5em;
      page-break-after: avoid;
    }
    h4 {
      font-family: 'Figtree', sans-serif;
      font-size: 1em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 1.2em 0 0.4em;
      page-break-after: avoid;
    }

    p { margin: 0 0 0.8em; orphans: 3; widows: 3; }

    blockquote {
      border-left: 3pt solid #c0392b;
      margin: 1.2em 0;
      padding: 0.3em 1.2em;
      color: #444;
      font-style: italic;
    }

    code {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 0.1em 0.3em;
      font-size: 0.88em;
      border-radius: 2pt;
    }

    pre {
      background: #2a2520;
      color: #eee;
      padding: 0.8em 1em;
      border-radius: 4pt;
      overflow-x: auto;
      margin: 1.2em 0;
      page-break-inside: avoid;
    }
    pre code { background: none; padding: 0; color: inherit; }

    ul, ol { padding-left: 1.6em; margin: 0.6em 0; }
    li { margin: 0.25em 0; }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.2em 0;
      page-break-inside: avoid;
      font-size: 0.93em;
    }
    td, th {
      border: 0.5pt solid #bbb;
      padding: 0.35em 0.6em;
      text-align: left;
    }
    th { background: #f0ede8; font-family: 'Figtree', sans-serif; font-weight: 600; }

    img { max-width: 100%; height: auto; display: block; margin: 0.8em auto; }

    hr { border: none; border-top: 1pt solid #ddd; margin: 2em 0; }

    a { color: #c0392b; text-decoration: none; }

    mark { background: #fae4d8; }

    /* Cover */
    .cover {
      text-align: center;
      page-break-after: always;
      padding-top: 30mm;
    }
    .cover h1 {
      font-size: 2.4em;
      border: none;
      padding: 0;
      margin-bottom: 0.4em;
    }
    .cover .subtitle { color: #666; font-size: 1.1em; font-style: italic; }
    .cover .meta { margin-top: 8mm; color: #888; font-size: 0.9em; font-family: 'Figtree', sans-serif; }

    /* Bibliography */
    .bibliography {
      page-break-before: always;
      margin-top: 2em;
    }
    .ref-list {
      padding-left: 2em;
      list-style-type: decimal;
    }
    .ref-item {
      margin: 0.5em 0;
      font-size: 0.93em;
      line-height: 1.5;
      text-align: justify;
    }
    .ref-item em, .ref-item i { font-style: italic; }

    /* Page numbers */
    .page-number {
      position: running(pageNumber);
      ${positionedPageNum}
      font-family: 'Figtree', sans-serif;
      font-size: 9pt;
      color: #888;
    }

    /* Footnotes */
    .footnotes {
      margin-top: 3em;
      border-top: 1pt solid #ccc;
      padding-top: 0.8em;
      font-size: 0.85em;
      color: #555;
    }
    .footnote-ref {
      font-size: 0.75em;
      vertical-align: super;
      color: #c0392b;
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="meta">${new Date(doc.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <main>
    ${processContentForPrint(doc.content)}
  </main>

  ${bibliographyHTML}
</body>
</html>`
}

function processContentForPrint(html: string): string {
  // Convert italic markdown-style in citations (*text*) to <em>
  return html
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/<p>\s*<\/p>/g, '')
}

function markdownToHTML(text: string): string {
  return text.replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
