'use client'

import { Check, Download, FolderOpen as FolderOpenIconLucide, Upload } from 'lucide-react'
import { memo } from 'react'

import { FolderIcon } from '@/components/icons/folder-icon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { isImageMime } from '@/lib/documents/file-icon'
import { cn } from '@/lib/utils'

import type { DocumentFolder } from './types'

export type FolderCardProps = {
  folder: DocumentFolder
  selected: boolean
  onToggleSelect: (folderId: string, next: boolean) => void
  onOpen: (folder: DocumentFolder) => void
  onUpload: (folder: DocumentFolder) => void
  onDownloadFolder: (folder: DocumentFolder) => void
}

export const FolderCard = memo(function FolderCard({
  folder,
  selected,
  onToggleSelect,
  onOpen,
  onUpload,
  onDownloadFolder,
}: FolderCardProps) {
  const Icon = folder.icon
  const firstImage = folder.files.find((f) => isImageMime(f.mimeType))
  const thumbnailUrl = firstImage?.url

  const handleClick = (e: React.MouseEvent) => {
    if (e.detail === 2) return
    onToggleSelect(folder.id, !selected)
  }

  const handleDoubleClick = () => {
    if (folder.files.length > 0) onOpen(folder)
    else onUpload(folder)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-selectable={folder.id}
          className={cn(
            'selectable-folder group flex w-32 flex-col items-center gap-2 rounded-xl p-2 text-center transition',
            'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected && 'bg-primary/10 ring-2 ring-primary'
          )}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          aria-pressed={selected}
          aria-label={`${folder.name}, ${folder.files.length} ${folder.files.length === 1 ? 'ficheiro' : 'ficheiros'}`}
        >
          <div className="relative">
            <FolderIcon
              className="h-20 w-20"
              state={
                selected
                  ? 'selected'
                  : folder.files.length === 0
                    ? 'empty'
                    : 'filled'
              }
              icon={Icon && !thumbnailUrl ? Icon : undefined}
              thumbnailUrl={thumbnailUrl}
              badgeCount={folder.files.length}
            />
            {selected && (
              <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </div>
          <span className="line-clamp-2 min-h-[2.25rem] text-xs font-medium text-foreground">
            {folder.name}
          </span>
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onToggleSelect(folder.id, !selected)}>
          {selected ? DOCUMENT_LABELS.actions.deselect : DOCUMENT_LABELS.actions.select}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onOpen(folder)}
          disabled={folder.files.length === 0}
        >
          <FolderOpenIconLucide className="mr-2 h-4 w-4" />
          {DOCUMENT_LABELS.actions.open}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onUpload(folder)}>
          <Upload className="mr-2 h-4 w-4" />
          {DOCUMENT_LABELS.actions.upload}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onDownloadFolder(folder)}
          disabled={folder.files.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {DOCUMENT_LABELS.actions.downloadFolder}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
