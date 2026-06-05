'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  uploadImageFile,
  uploadAttachmentFile,
  type AttachmentUploadResult,
} from './use-attachment-upload'

export interface EditorDropHandlers {
  /** Called after an image file has been uploaded successfully. */
  onImageUploaded: (url: string) => void
  /** Called after a non-image file has been uploaded as an attachment. */
  onAttachmentUploaded: (data: AttachmentUploadResult) => void
}

/**
 * Attach drag-and-drop + paste listeners to a DOM element. Image files are
 * routed through `uploadImageFile` and non-images through `uploadAttachmentFile`.
 * The hook returns a `dragging` boolean that callers can use to show a
 * drop-zone overlay.
 */
export function useEditorDrop(
  target: HTMLElement | null,
  handlers: EditorDropHandlers
): { dragging: boolean; uploading: boolean } {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!target) return

    let dragDepth = 0

    const hasFiles = (e: DragEvent): boolean => {
      const types = e.dataTransfer?.types
      if (!types) return false
      for (let i = 0; i < types.length; i++) {
        if (types[i] === 'Files') return true
      }
      return false
    }

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth += 1
      if (dragDepth === 1) setDragging(true)
    }

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setDragging(false)
    }

    const processFiles = async (files: FileList) => {
      const list = Array.from(files)
      if (list.length === 0) return
      setUploading(true)
      const toastId = toast.loading(
        list.length === 1
          ? 'A carregar ficheiro...'
          : `A carregar ${list.length} ficheiros...`
      )
      try {
        for (const file of list) {
          if (file.type.startsWith('image/')) {
            const url = await uploadImageFile(file)
            handlers.onImageUploaded(url)
          } else {
            const data = await uploadAttachmentFile(file)
            handlers.onAttachmentUploaded(data)
          }
        }
        toast.success(
          list.length === 1
            ? 'Ficheiro carregado'
            : `${list.length} ficheiros carregados`,
          { id: toastId }
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar', {
          id: toastId,
        })
      } finally {
        setUploading(false)
      }
    }

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      dragDepth = 0
      setDragging(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        void processFiles(files)
      }
    }

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length === 0) return
      // Intercept only when the clipboard actually holds files so plain
      // text paste continues to flow through the editor normally.
      e.preventDefault()
      const dt = new DataTransfer()
      for (const f of files) dt.items.add(f)
      void processFiles(dt.files)
    }

    target.addEventListener('dragenter', onDragEnter)
    target.addEventListener('dragover', onDragOver)
    target.addEventListener('dragleave', onDragLeave)
    target.addEventListener('drop', onDrop)
    target.addEventListener('paste', onPaste as EventListener)

    return () => {
      target.removeEventListener('dragenter', onDragEnter)
      target.removeEventListener('dragover', onDragOver)
      target.removeEventListener('dragleave', onDragLeave)
      target.removeEventListener('drop', onDrop)
      target.removeEventListener('paste', onPaste as EventListener)
    }
  }, [target, handlers])

  return { dragging, uploading }
}
