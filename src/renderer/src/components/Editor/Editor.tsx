import React from 'react'
import type { Document } from '../../store/useStore'
import { LayoutCanvas } from '../Layout/LayoutCanvas'

interface Props {
  document: Document
  store: any
  onAIAction: (action: string, text: string) => void
  onSave: (id: string, data: object) => void
  onInsertText?: (text: string) => void
}

export function Editor({ document, onAIAction, onSave }: Props) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <LayoutCanvas document={document} onSave={onSave} onAIAction={onAIAction} />
    </div>
  )
}
