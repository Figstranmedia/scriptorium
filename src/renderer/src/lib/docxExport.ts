/**
 * BLOQUE 12 — DOCX export from layout frames.
 * Converts LayoutFrame.ownContent (plain text / HTML) to a .docx file
 * using the `docx` npm package (runs in main process via IPC).
 *
 * We only deal with text frames (LayoutFrame), sorted by page then vertical position.
 * Images/shapes/charts are noted as placeholder captions.
 */

import type { AnyLayoutFrame, LayoutFrame } from './threadEngine'
import { isImageFrame, isShapeFrame, isChartFrame } from './threadEngine'

export interface DocxFrameData {
  type: 'text' | 'image' | 'shape' | 'chart'
  content: string        // plain text or [IMAGE] / [SHAPE] / [CHART]
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  textAlign?: string
  pageIndex: number
  y: number
}

/**
 * Convert layout frames to a flat array of frame data sorted by page+position.
 * Main process will use this to build the DOCX.
 */
export function framesToDocxData(frames: AnyLayoutFrame[]): DocxFrameData[] {
  return [...frames]
    .sort((a, b) => a.pageIndex !== b.pageIndex ? a.pageIndex - b.pageIndex : a.y - b.y)
    .map(frame => {
      if (isImageFrame(frame)) {
        return { type: 'image' as const, content: '[IMAGEN]', pageIndex: frame.pageIndex, y: frame.y }
      }
      if (isShapeFrame(frame)) {
        return { type: 'shape' as const, content: '[FORMA]', pageIndex: frame.pageIndex, y: frame.y }
      }
      if (isChartFrame(frame)) {
        return { type: 'chart' as const, content: `[GRÁFICO: ${(frame as any).chartTitle || ''}]`, pageIndex: frame.pageIndex, y: frame.y }
      }
      // Text frame
      const tf = frame as LayoutFrame
      // Strip HTML tags from ownContent → plain text
      const plain = (tf.ownContent || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .trim()
      return {
        type: 'text' as const,
        content: plain,
        fontSize: tf.fontSize ?? 12,
        fontFamily: tf.fontFamily ?? 'serif',
        fontWeight: tf.fontWeight ?? 'normal',
        fontStyle: tf.fontStyle ?? 'normal',
        textAlign: tf.textAlign ?? 'left',
        pageIndex: frame.pageIndex,
        y: frame.y,
      }
    })
    .filter(d => d.content.trim().length > 0)
}
