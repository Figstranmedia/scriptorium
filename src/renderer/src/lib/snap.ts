/**
 * Snap engine — magnetic snap for frame drag/resize.
 * Snaps to guides, frame edges, and page margins.
 */
import type { AnyLayoutFrame } from './threadEngine'
import type { Guide } from '../store/useStore'

export interface SnapLine {
  axis: 'h' | 'v'
  position: number   // page-space px
}

const MARGIN_PX = 57  // ~15mm at 96dpi

/**
 * Given a candidate (x, y) for a frame of size (w, h),
 * returns snapped coordinates and snap indicator lines.
 */
export function snapPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  allFrames: AnyLayoutFrame[],
  guides: Guide[],
  pageWidth: number,
  pageHeight: number,
  snapEnabled: boolean,
  scale: number,
  excludeId?: string,
): { x: number; y: number; lines: SnapLine[] } {
  if (!snapEnabled) return { x, y, lines: [] }

  const radius = 6 / scale  // snap radius in page-space pixels

  // Candidate snap points for the moving frame
  const candidatesX = [x, x + w / 2, x + w]       // left, center, right
  const candidatesY = [y, y + h / 2, y + h]       // top, center, bottom

  let bestSnapX: number | null = null
  let bestDX = radius
  let bestSnapY: number | null = null
  let bestDY = radius
  const lines: SnapLine[] = []

  // Collect all snap targets
  const targetsX: number[] = [MARGIN_PX, pageWidth - MARGIN_PX]   // page margins
  const targetsY: number[] = [MARGIN_PX, pageHeight - MARGIN_PX]

  // Other frames
  for (const f of allFrames) {
    if (f.id === excludeId) continue
    targetsX.push(f.x, f.x + f.width / 2, f.x + f.width)
    targetsY.push(f.y, f.y + f.height / 2, f.y + f.height)
  }

  // Guides
  for (const g of guides) {
    if (g.axis === 'v') targetsX.push(g.position)
    else targetsY.push(g.position)
  }

  // Find best snap on X
  for (const cx of candidatesX) {
    for (const tx of targetsX) {
      const d = Math.abs(cx - tx)
      if (d < bestDX) {
        bestDX = d
        bestSnapX = tx - (cx - x)   // offset frame so candidate aligns to target
      }
    }
  }

  // Find best snap on Y
  for (const cy of candidatesY) {
    for (const ty of targetsY) {
      const d = Math.abs(cy - ty)
      if (d < bestDY) {
        bestDY = d
        bestSnapY = ty - (cy - y)
      }
    }
  }

  const snappedX = bestSnapX !== null ? bestSnapX : x
  const snappedY = bestSnapY !== null ? bestSnapY : y

  if (bestSnapX !== null) {
    // Find which target triggered the snap
    const alignedX = bestSnapX + (candidatesX[0] === x ? 0 : candidatesX[1] === x + w / 2 ? w / 2 : w)
    lines.push({ axis: 'v', position: alignedX + (snappedX - x) - (snappedX - x) })
    // Simpler: just mark the snapped edge
    for (const cx of candidatesX) {
      const realCX = cx - x + snappedX
      if (Math.abs(realCX - (bestSnapX + (cx - x))) < 1) {
        lines.push({ axis: 'v', position: realCX })
      }
    }
  }
  if (bestSnapY !== null) {
    for (const cy of candidatesY) {
      const realCY = cy - y + snappedY
      lines.push({ axis: 'h', position: realCY })
    }
  }

  return {
    x: snappedX,
    y: snappedY,
    lines: lines.slice(0, 4),  // limit to avoid visual noise
  }
}
