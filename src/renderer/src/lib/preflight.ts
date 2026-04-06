import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame } from './threadEngine'
import { isImageFrame } from './threadEngine'

export type PreflightSeverity = 'error' | 'warning' | 'ok'

export interface PreflightIssue {
  id: string
  severity: PreflightSeverity
  frameId?: string
  pageIndex?: number
  message: string
  detail?: string
}

export interface PreflightReport {
  status: PreflightSeverity
  issues: PreflightIssue[]
  errorCount: number
  warningCount: number
}

/**
 * Runs all preflight checks and returns a report.
 */
export function runPreflight(
  frames: AnyLayoutFrame[],
  contentMap: Map<string, string>,
  pageCount: number,
): PreflightReport {
  const issues: PreflightIssue[] = []

  // 1. Text overflow: text frame has content that doesn't fit and no threadNext
  const textFrames = frames.filter(f => !isImageFrame(f)) as LayoutFrame[]
  for (const frame of textFrames) {
    const content = contentMap.get(frame.id) || ''
    if (!content && !frame.threadPrevId) {
      issues.push({
        id: `empty_${frame.id}`,
        severity: 'warning',
        frameId: frame.id,
        pageIndex: frame.pageIndex,
        message: 'Marco de texto vacío',
        detail: `El marco en página ${frame.pageIndex + 1} no tiene contenido asignado.`,
      })
    }
  }

  // 2. Image frames without source
  const imageFrames = frames.filter(f => isImageFrame(f)) as LayoutImageFrame[]
  for (const frame of imageFrames) {
    if (!frame.src) {
      issues.push({
        id: `no_img_${frame.id}`,
        severity: 'error',
        frameId: frame.id,
        pageIndex: frame.pageIndex,
        message: 'Marco de imagen sin imagen',
        detail: `El marco en página ${frame.pageIndex + 1} no tiene imagen asignada.`,
      })
    }
  }

  // 3. Broken thread chains (threadNextId points to non-existent frame)
  const frameIds = new Set(frames.map(f => f.id))
  for (const frame of textFrames) {
    if (frame.threadNextId && !frameIds.has(frame.threadNextId)) {
      issues.push({
        id: `broken_thread_${frame.id}`,
        severity: 'error',
        frameId: frame.id,
        pageIndex: frame.pageIndex,
        message: 'Enlace de texto roto',
        detail: `El marco en página ${frame.pageIndex + 1} apunta a un marco que ya no existe.`,
      })
    }
  }

  // 4. Frames outside page bounds (basic check)
  for (const frame of frames) {
    if (frame.x < 0 || frame.y < 0) {
      issues.push({
        id: `out_bounds_${frame.id}`,
        severity: 'warning',
        frameId: frame.id,
        pageIndex: frame.pageIndex,
        message: 'Marco fuera de márgenes',
        detail: `Un marco en página ${frame.pageIndex + 1} tiene posición negativa.`,
      })
    }
  }

  // 5. Pages with no frames at all
  for (let i = 0; i < pageCount; i++) {
    const pageFrames = frames.filter(f => f.pageIndex === i)
    if (pageFrames.length === 0) {
      issues.push({
        id: `empty_page_${i}`,
        severity: 'warning',
        pageIndex: i,
        message: `Página ${i + 1} sin marcos`,
        detail: 'La página no tiene ningún marco de contenido.',
      })
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const status: PreflightSeverity = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'ok'

  return { status, issues, errorCount, warningCount }
}
