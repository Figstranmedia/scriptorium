/**
 * BLOQUE IMPORT-MEJORADA — DOCX import helper (renderer side).
 * Parses the HTML produced by mammoth.js into LayoutFrame-ready blocks.
 */

export interface DocxBlock {
  html: string           // HTML suitable for ownContent
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right' | 'justify'
  isHeading: boolean
  headingLevel: number   // 1-6, 0 = paragraph
}

/**
 * Parse mammoth HTML into a flat array of block groups.
 * Each block represents one "logical text unit" to place into a LayoutFrame.
 * Groups of body paragraphs are collected together (one frame per page-worth);
 * headings always start a new block.
 */
export function parseDocxHTML(html: string): DocxBlock[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html')
  const children = Array.from(doc.body.children)

  const blocks: DocxBlock[] = []
  let currentParas: string[] = []

  const flushParas = () => {
    if (currentParas.length === 0) return
    blocks.push({
      html: currentParas.join(''),
      fontSize: 11,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      isHeading: false,
      headingLevel: 0,
    })
    currentParas = []
  }

  for (const el of children) {
    const tag = el.tagName.toLowerCase()
    const text = el.textContent?.trim() || ''
    if (!text) continue

    const headingMatch = tag.match(/^h([1-6])$/)
    if (headingMatch) {
      flushParas()
      const level = parseInt(headingMatch[1])
      const fontSize = level === 1 ? 22 : level === 2 ? 18 : level === 3 ? 15 : 13
      blocks.push({
        html: el.outerHTML,
        fontSize,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'left',
        isHeading: true,
        headingLevel: level,
      })
    } else if (tag === 'p' || tag === 'blockquote') {
      currentParas.push(el.outerHTML)
      // Flush every ~15 paragraphs to create separate frames (approx one page)
      if (currentParas.length >= 15) flushParas()
    } else if (tag === 'ul' || tag === 'ol') {
      flushParas()
      blocks.push({
        html: el.outerHTML,
        fontSize: 11,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        isHeading: false,
        headingLevel: 0,
      })
    } else if (tag === 'table') {
      // Skip tables — they'll need manual recreation as LayoutTableFrames
    }
  }
  flushParas()

  return blocks
}
