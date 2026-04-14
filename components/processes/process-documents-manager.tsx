'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  BatchActionBar,
  DocumentViewerModal,
  DocumentsGrid,
  useBatchDownload,
  type DocumentFile,
  type DocumentFolder,
} from '@/components/documents'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useProcessDocuments } from '@/hooks/use-process-documents'
import { mapProcessFoldersToDocumentFolders } from '@/lib/documents/adapters/process'
import { isImageMime } from '@/lib/documents/file-icon'
import type { PropertyMedia } from '@/types/property'

interface ProcessDocumentsManagerProps {
  processId: string
}

export function ProcessDocumentsManager({ processId }: ProcessDocumentsManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerFiles, setViewerFiles] = useState<DocumentFile[]>([])
  const [initialFileId, setInitialFileId] = useState<string | undefined>(undefined)
  const [mediaFolder, setMediaFolder] = useState<DocumentFolder | null>(null)
  const { isDownloading, downloadFromFolders } = useBatchDownload()

  const { folders: rawFolders, stats, isLoading, refetch } = useProcessDocuments({
    processId,
    search: searchQuery,
  })

  const folders = useMemo(() => mapProcessFoldersToDocumentFolders(rawFolders), [rawFolders])

  const selectedFolders = useMemo(
    () => folders.filter((f) => selectedIds.has(f.id)),
    [folders, selectedIds]
  )
  const totalSelectedFiles = selectedFolders.reduce((a, f) => a + f.files.length, 0)

  const handleBatchDownload = () =>
    downloadFromFolders({
      folders: selectedFolders,
      entityName: `processo-${processId.slice(0, 8)}`,
      onComplete: () => setSelectedIds(new Set()),
    })

  const openFolder = (folder: DocumentFolder, fileId?: string) => {
    if (folder.source?.kind === 'property-media') {
      setMediaFolder(folder)
      return
    }
    setViewerFiles(folder.files)
    setInitialFileId(fileId)
    setViewerOpen(true)
  }

  const mediaItems: PropertyMedia[] = useMemo(() => {
    if (!mediaFolder || mediaFolder.source?.kind !== 'property-media') return []
    const propertyId = mediaFolder.source.propertyId
    return mediaFolder.files.map((file, index) => ({
      id: file.id,
      property_id: propertyId,
      url: file.url,
      media_type: isImageMime(file.mimeType) ? 'image' : 'document',
      order_index: index,
      is_cover: file.label === 'Capa',
    }))
  }, [mediaFolder])

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar ficheiros..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="ml-auto whitespace-nowrap">
          {stats.total_documents}{' '}
          {stats.total_documents === 1 ? 'documento' : 'documentos'}
        </Badge>
      </div>

      <DocumentsGrid
        folders={folders}
        domain="processes"
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenFolder={(folder, fileId) => openFolder(folder, fileId)}
        onDownloadFolder={(folder) =>
          downloadFromFolders({ folders: [folder], entityName: folder.name })
        }
      />

      <BatchActionBar
        selectedCount={selectedIds.size}
        totalFiles={totalSelectedFiles}
        isBusy={isDownloading}
        onDownload={handleBatchDownload}
        onCancel={() => setSelectedIds(new Set())}
      />

      <DocumentViewerModal
        open={viewerOpen}
        files={viewerFiles}
        initialFileId={initialFileId}
        onOpenChange={setViewerOpen}
        onDownload={(file) => window.open(file.url, '_blank')}
      />

      <Dialog open={!!mediaFolder} onOpenChange={(v) => !v && setMediaFolder(null)}>
        <DialogContent className="flex h-[85vh] !max-w-6xl flex-col gap-0 overflow-hidden !p-0 sm:!p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b px-6 py-3">
            <DialogTitle>{mediaFolder?.name ?? 'Imagens do Imóvel'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {mediaFolder && mediaFolder.source?.kind === 'property-media' && (
              <PropertyMediaGallery
                propertyId={mediaFolder.source.propertyId}
                media={mediaItems}
                onMediaChange={() => refetch()}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
