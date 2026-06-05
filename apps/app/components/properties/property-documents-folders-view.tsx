'use client'

import { Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  BatchActionBar,
  CustomDocTypeDialog,
  DocumentUploadDialog,
  DocumentViewerModal,
  DocumentsGrid,
  SendDocumentsDialog,
  useBatchDownload,
  type DocumentFile,
  type DocumentFolder,
} from '@/components/documents'
import type {
  DocTypeOption,
  DocumentUploadSubmitInput,
} from '@/components/documents/document-upload-dialog'
import { Button } from '@/components/ui/button'
import { usePropertyDocuments } from '@/hooks/use-property-documents'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'

interface PropertyDocumentsFoldersViewProps {
  propertyId: string
}

export function PropertyDocumentsFoldersView({ propertyId }: PropertyDocumentsFoldersViewProps) {
  const { folders, isLoading, refetch } = usePropertyDocuments(propertyId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerFiles, setViewerFiles] = useState<DocumentFile[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFolder, setUploadFolder] = useState<DocumentFolder | null>(null)
  const [docTypes, setDocTypes] = useState<DocTypeOption[]>([])
  const [customOpen, setCustomOpen] = useState(false)
  const [extractingAll, setExtractingAll] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const { isDownloading, downloadFromFolders } = useBatchDownload()

  const selectedFolders = useMemo(
    () => folders.filter((f) => selectedIds.has(f.id)),
    [folders, selectedIds]
  )
  const totalSelectedFiles = selectedFolders.reduce((a, f) => a + f.files.length, 0)

  const handleBatchDownload = () =>
    downloadFromFolders({
      folders: selectedFolders,
      entityName: `imovel-${propertyId.slice(0, 8)}`,
      onComplete: () => setSelectedIds(new Set()),
    })

  const openUploadFor = async (folder: DocumentFolder | null) => {
    setUploadFolder(folder)
    try {
      const res = await fetch('/api/libraries/doc-types?applies_to=properties')
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.items || []
      setDocTypes(
        list.map((dt: Record<string, unknown>) => ({
          id: String(dt.id),
          name: String(dt.name),
          slug: String(dt.slug ?? dt.id),
          hasExpiry: Boolean(dt.has_expiry ?? dt.default_validity_months),
          expiryRequired: Boolean(dt.expiry_required),
          allowedExtensions: (dt.allowed_extensions as string[]) ?? null,
          categoryId: (dt.category as string) ?? null,
        }))
      )
    } catch {
      setDocTypes([])
    }
    setUploadOpen(true)
  }

  const handleUploadSubmit = async (input: DocumentUploadSubmitInput) => {
    const total = input.items.length
    let uploaded = 0
    for (const item of input.items) {
      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('doc_type_id', input.docType.id)
      fd.append('property_id', propertyId)
      if (input.validUntil) fd.append('valid_until', input.validUntil)
      if (input.notes) fd.append('notes', input.notes)
      if (item.label) fd.append('label', item.label)
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        toast.error(`${item.file.name}: erro no upload`)
        continue
      }
      uploaded += 1
      toast.loading(DOCUMENT_LABELS.toasts.uploading(uploaded, total), { id: 'upload-progress' })
    }
    toast.dismiss('upload-progress')
    toast.success(DOCUMENT_LABELS.toasts.uploaded)
    await refetch()
  }

  const handleDelete = async (file: DocumentFile) => {
    const res = await fetch(`/api/documents/${file.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error(DOCUMENT_LABELS.toasts.deleteError)
      return
    }
    toast.success(DOCUMENT_LABELS.toasts.deleted)
    await refetch()
  }

  const handleExtractAll = async () => {
    setExtractingAll(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents/extract-validity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('extract-validity')
      const data = await res.json()
      toast.success(`Datas extraídas: ${data.updated ?? 0}/${data.total ?? 0}`)
      await refetch()
    } catch {
      toast.error('Erro ao extrair datas de validade')
    } finally {
      setExtractingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExtractAll}
          disabled={extractingAll || folders.length === 0}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {extractingAll ? 'A extrair...' : 'Extrair datas'}
        </Button>
        <Button type="button" size="sm" onClick={() => openUploadFor(null)}>
          Enviar documento
        </Button>
      </div>

      <DocumentsGrid
        folders={folders}
        domain="properties"
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onOpenFolder={(folder) => {
          setViewerFiles(folder.files)
          setViewerOpen(true)
        }}
        onUpload={(folder) => openUploadFor(folder)}
        onDownloadFolder={(folder) =>
          downloadFromFolders({ folders: [folder], entityName: folder.name })
        }
        onCreateCustomType={() => setCustomOpen(true)}
      />

      <BatchActionBar
        selectedCount={selectedIds.size}
        totalFiles={totalSelectedFiles}
        isBusy={isDownloading}
        onDownload={handleBatchDownload}
        onSend={() => setSendOpen(true)}
        onCancel={() => setSelectedIds(new Set())}
      />

      <SendDocumentsDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        domain="properties"
        entityId={propertyId}
        folders={selectedFolders}
        onSuccess={() => {
          setSelectedIds(new Set())
          setSendOpen(false)
        }}
      />

      <DocumentViewerModal
        open={viewerOpen}
        files={viewerFiles}
        onOpenChange={setViewerOpen}
        onDownload={(file) => window.open(file.url, '_blank')}
        onDelete={async (file) => {
          await handleDelete(file)
          setViewerFiles((arr) => arr.filter((f) => f.id !== file.id))
        }}
      />

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        docTypes={docTypes}
        defaultDocTypeId={uploadFolder?.docTypeId ?? null}
        onSubmit={handleUploadSubmit}
      />

      <CustomDocTypeDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        domain="properties"
        onCreated={(dt) => {
          setDocTypes((prev) => [...prev, dt])
          setUploadFolder(null)
          setUploadOpen(true)
        }}
      />
    </div>
  )
}
