import type { Reference, CitationStyle } from '../store/useStore'

// ── Inline citation (inserted into text) ────────────────────────────────────

export function formatInlineCitation(ref: Reference, index: number, style: CitationStyle): string {
  switch (style) {
    case 'apa':
      return `(${firstAuthorLastName(ref.author)}, ${ref.year})`
    case 'mla':
      return `(${firstAuthorLastName(ref.author)} ${ref.pages || ref.year})`
    case 'chicago':
      return `(${firstAuthorLastName(ref.author)} ${ref.year}${ref.pages ? ', ' + ref.pages : ''})`
    case 'ieee':
      return `[${index}]`
    default:
      return `(${firstAuthorLastName(ref.author)}, ${ref.year})`
  }
}

// ── Full bibliography entry ─────────────────────────────────────────────────

export function formatReference(ref: Reference, index: number, style: CitationStyle): string {
  switch (style) {
    case 'apa':   return formatAPA(ref)
    case 'mla':   return formatMLA(ref)
    case 'chicago': return formatChicago(ref)
    case 'ieee':  return `[${index}] ${formatIEEE(ref)}`
    default:      return formatAPA(ref)
  }
}

// ── APA 7th ─────────────────────────────────────────────────────────────────

function formatAPA(ref: Reference): string {
  const author = formatAuthorAPA(ref.author)
  const year = ref.year ? `(${ref.year}).` : '(s.f.).'

  if (ref.type === 'article') {
    const journal = ref.journal ? `*${ref.journal}*` : ''
    const vol = ref.volume ? `, *${ref.volume}*` : ''
    const issue = ref.issue ? `(${ref.issue})` : ''
    const pages = ref.pages ? `, ${ref.pages}` : ''
    const doi = ref.doi ? ` https://doi.org/${ref.doi}` : ref.url ? ` ${ref.url}` : ''
    return `${author} ${year} ${ref.title}.${journal}${vol}${issue}${pages}.${doi}`
  }

  if (ref.type === 'website') {
    const date = ref.accessDate ? ` Recuperado el ${ref.accessDate} de` : ''
    return `${author} ${year} *${ref.title}*.${date} ${ref.url || ''}`
  }

  if (ref.type === 'thesis') {
    return `${author} ${year} *${ref.title}* [Tesis doctoral/maestría, ${ref.publisher || ''}]. ${ref.url || ''}`
  }

  // book (default)
  const edition = ref.edition ? ` (${ref.edition} ed.).` : '.'
  const publisher = ref.publisher || ''
  return `${author} ${year} *${ref.title}*${edition} ${publisher}.`
}

function formatAuthorAPA(raw: string): string {
  // Accepts: "García, L." or "García, L. & Martínez, P."
  return raw.trim().endsWith('.') ? raw.trim() : raw.trim() + '.'
}

// ── MLA 9th ─────────────────────────────────────────────────────────────────

function formatMLA(ref: Reference): string {
  const author = ref.author.trim()

  if (ref.type === 'article') {
    const journal = ref.journal ? `"${ref.title}." *${ref.journal}*` : `"${ref.title}."`
    const vol = ref.volume ? `, vol. ${ref.volume}` : ''
    const issue = ref.issue ? `, no. ${ref.issue}` : ''
    const year = ref.year ? `, ${ref.year}` : ''
    const pages = ref.pages ? `, pp. ${ref.pages}` : ''
    return `${author}. ${journal}${vol}${issue}${year}${pages}.`
  }

  if (ref.type === 'website') {
    return `${author}. "${ref.title}." ${ref.publisher || ''}, ${ref.year}. ${ref.url || ''}.`
  }

  const publisher = ref.publisher ? `. ${ref.publisher}` : ''
  const year = ref.year ? `, ${ref.year}` : ''
  return `${author}. *${ref.title}*${publisher}${year}.`
}

// ── Chicago 17th (Author-Date) ───────────────────────────────────────────────

function formatChicago(ref: Reference): string {
  const author = ref.author.trim()

  if (ref.type === 'article') {
    const journal = ref.journal ? `"${ref.title}." *${ref.journal}*` : `"${ref.title}."`
    const vol = ref.volume ? ` ${ref.volume}` : ''
    const issue = ref.issue ? `, no. ${ref.issue}` : ''
    const year = ref.year ? ` (${ref.year})` : ''
    const pages = ref.pages ? `: ${ref.pages}` : ''
    const doi = ref.doi ? `. https://doi.org/${ref.doi}` : ''
    return `${author}. ${journal}${vol}${issue}${year}${pages}${doi}.`
  }

  if (ref.type === 'website') {
    const date = ref.accessDate ? ` Accessed ${ref.accessDate}.` : ''
    return `${author}. "${ref.title}." ${ref.publisher || ''}, ${ref.year}. ${ref.url || ''}.${date}`
  }

  const city = ref.city ? `${ref.city}: ` : ''
  const publisher = ref.publisher || ''
  const year = ref.year ? `, ${ref.year}` : ''
  return `${author}. *${ref.title}*. ${city}${publisher}${year}.`
}

// ── IEEE ─────────────────────────────────────────────────────────────────────

function formatIEEE(ref: Reference): string {
  const initials = ref.author.split(',').reverse().join(' ').trim()

  if (ref.type === 'article') {
    const journal = ref.journal ? `*${ref.journal}*` : ''
    const vol = ref.volume ? `, vol. ${ref.volume}` : ''
    const issue = ref.issue ? `, no. ${ref.issue}` : ''
    const pages = ref.pages ? `, pp. ${ref.pages}` : ''
    const year = ref.year ? `, ${ref.year}` : ''
    return `${initials}, "${ref.title}," ${journal}${vol}${issue}${pages}${year}.`
  }

  const publisher = ref.publisher || ''
  const year = ref.year ? `, ${ref.year}` : ''
  return `${initials}, *${ref.title}*, ${publisher}${year}.`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstAuthorLastName(author: string): string {
  // "García, L. & Martínez, P." → "García et al." if multiple, or "García"
  const parts = author.split('&')
  const lastName = parts[0].split(',')[0].trim()
  return parts.length > 1 ? `${lastName} et al.` : lastName
}

// ── TOC from HTML ────────────────────────────────────────────────────────────

export interface TOCEntry {
  level: 1 | 2 | 3
  text: string
  id: string
}

export function extractTOC(html: string): TOCEntry[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const entries: TOCEntry[] = []

  doc.querySelectorAll('h1, h2, h3').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    const level = parseInt(tag[1]) as 1 | 2 | 3
    const text = el.textContent?.trim() || ''
    if (!text) return
    const id = `toc-${text.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`
    entries.push({ level, text, id })
  })

  return entries
}

export function formatTOCAsHTML(entries: TOCEntry[], title = 'Tabla de Contenido'): string {
  if (entries.length === 0) return '<p><em>No se encontraron encabezados en el documento.</em></p>'

  const lines = entries.map(entry => {
    const indent = entry.level === 1 ? '' : entry.level === 2 ? '&nbsp;&nbsp;&nbsp;&nbsp;' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'
    const weight = entry.level === 1 ? 'font-weight:600;' : ''
    const size = entry.level === 1 ? 'font-size:1em;' : 'font-size:0.93em;'
    return `<p style="margin:0.3em 0;${weight}${size}">${indent}${entry.text}</p>`
  }).join('\n')

  return `<h2>${title}</h2>\n${lines}\n<hr/>`
}
