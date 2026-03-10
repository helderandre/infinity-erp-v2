'use client'

import { useState } from 'react'
import { Search, LayoutGrid, List, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { useProcessDocuments } from '@/hooks/use-process-documents'
import { DocumentBreadcrumbNav } from '@/components/processes/document-breadcrumb-nav'
import { DocumentFolderCard } from '@/components/processes/document-folder-card'
import { DocumentFileCard } from '@/components/processes/document-file-card'
import { DocumentFileRow } from '@/components/processes/document-file-row'
import { DocumentPreviewDialog } from '@/components/processes/document-preview-dialog'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import type { DocumentFile, DocumentFolder } from '@/types/process'
import type { PropertyMedia } from '@/types/property'

interface ProcessDocumentsManagerProps {
  processId: string
}

export function ProcessDocumentsManager({ processId }: ProcessDocumentsManagerProps) {
  const [currentFolder, setCurrentFolder] = useState<DocumentFolder | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewFile, setPreviewFile] = useState<DocumentFile | null>(null)

  const { folders, stats, isLoading, refetch } = useProcessDocuments({
    processId,
    search: searchQuery,
  })

  // Keep current folder synced with fetched data
  const activeFolderData = currentFolder
    ? folders.find((f) => f.id === currentFolder.id) || currentFolder
    : null

  const handleDownload = (file: DocumentFile) => {
    window.open(file.file_url, '_blank')
  }

  // Loading skeletons
  if (isLoading && folders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 flex-1 max-w-xs" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[16/10] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <DocumentBreadcrumbNav
          currentFolder={activeFolderData}
          onNavigateRoot={() => setCurrentFolder(null)}
        />

        <div className="flex items-center gap-2 ml-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar ficheiros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>

          {/* View toggle (only inside folder, not media) */}
          {currentFolder && currentFolder.type !== 'media' && (
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')} variant="outline" size="sm">
              <ToggleGroupItem value="grid" aria-label="Vista Grelha">
                <LayoutGrid className="h-4 w-4" />
                Grelha
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Vista Lista">
                <List className="h-4 w-4" />
                Lista
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {/* Stats badge */}
          <Badge variant="secondary" className="whitespace-nowrap">
            {stats.total_documents} {stats.total_documents === 1 ? 'documento' : 'documentos'}
          </Badge>
        </div>
      </div>

      {/* Content: Root view (folders) */}
      {!currentFolder && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <DocumentFolderCard
              key={folder.id}
              folder={folder}
              onClick={() => setCurrentFolder(folder)}
            />
          ))}
        </div>
      )}

      {/* Content: Inside folder */}
      {currentFolder && activeFolderData && (
        <>
          {activeFolderData.type === 'media' ? (
            <PropertyMediaGallery
              propertyId={activeFolderData.entity_id!}
              media={activeFolderData.documents.map((d): PropertyMedia => ({
                id: d.id,
                property_id: activeFolderData.entity_id!,
                url: d.file_url,
                media_type: 'image',
                order_index: 0,
                is_cover: d.doc_type?.name === 'Capa',
              }))}
              onMediaChange={refetch}
            />
          ) : activeFolderData.documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={'Nenhum documento encontrado'}
              description={'Esta pasta ainda não tem documentos.'}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeFolderData.documents.map((file) => (
                <DocumentFileCard
                  key={file.id}
                  file={file}
                  onPreview={setPreviewFile}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeFolderData.documents.map((file) => (
                    <DocumentFileRow
                      key={file.id}
                      file={file}
                      onPreview={setPreviewFile}
                      onDownload={handleDownload}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Preview dialog */}
      <DocumentPreviewDialog
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  )
}
