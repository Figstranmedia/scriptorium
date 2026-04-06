import type { Document, CitationStyle } from '../store/useStore'
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
