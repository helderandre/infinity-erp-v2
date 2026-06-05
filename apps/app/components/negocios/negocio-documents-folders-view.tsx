'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  BatchActionBar,
  CustomDocTypeDialog,
  DocumentUploadDialog,
  DocumentViewerModal,
  DocumentsGrid,
  useBatchDownload,
  type DocumentFile,
  type DocumentFolder,
} from '@/components/documents'
import type {
  DocTypeOption,
  DocumentUploadSubmitInput,
} from '@/components/documents/document-upload-dialog'
import { Button } from '@/components/ui/button'
import { useNegocioDocuments } from '@/hooks/use-negocio-documents'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'

interface NegocioDocumentsFoldersViewProps {
  negocioId: string
}

export function NegocioDocumentsFoldersView({ negocioId }: NegocioDocumentsFoldersViewProps) {
  const { folders, isLoading, refetch } = useNegocioDocuments(negocioId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerFiles, setViewerFiles] = useState<DocumentFile[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFolder, setUploadFolder] = useState<DocumentFolder | null>(null)
  const [docTypes, setDocTypes] = useState<DocTypeOption[]>([])
  const [customOpen, setCustomOpen] = useState(false)
  const { isDownloading, downloadFromFolders } = useBatchDownload()

  const selectedFolders = useMemo(
    () => folders.filter((f) => selectedIds.has(f.id)),
    [folders, selectedIds]
  )
  const totalSelectedFiles = selectedFolders.reduce((a, f) => a + f.files.length, 0)

  const handleBatchDownload = () =>
    downloadFromFolders({
      folders: selectedFolders,
      entityName: `negocio-${negocioId.slice(0, 8)}`,
      onComplete: () => setSelectedIds(new Set()),
    })

  const openUploadFor = async (folder: DocumentFolder | null) => {
    setUploadFolder(folder)
    try {
      const res = await fetch('/api/libraries/doc-types?applies_to=negocios')
      const list = await res.json()
      setDocTypes(
        (Array.isArray(list) ? list : []).map((dt: Record<string, unknown>) => ({
          id: String(dt.id),
          name: String(dt.name),
          slug: String(dt.slug ?? dt.id),
          hasExpiry: !!dt.default_validity_months,
          expiryRequired: false,
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
    const id = 'negocio-upload-progress'
    for (const item of input.items) {
      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('doc_type_id', input.docType.id)
      if (input.validUntil) fd.append('valid_until', input.validUntil)
      if (input.notes) fd.append('notes', input.notes)
      if (item.label) fd.append('label', item.label)
      const res = await fetch(`/api/negocios/${negocioId}/documents`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        toast.error(`${item.file.name}: erro no upload`)
        continue
      }
      uploaded += 1
      toast.loading(DOCUMENT_LABELS.toasts.uploading(uploaded, total), { id })
    }
    toast.dismiss(id)
    toast.success(DOCUMENT_LABELS.toasts.uploaded)
    await refetch()
  }

  const handleDelete = async (file: DocumentFile) => {
    const res = await fetch(`/api/negocios/${negocioId}/documents/${file.id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      toast.error(DOCUMENT_LABELS.toasts.deleteError)
      return
    }
    toast.success(DOCUMENT_LABELS.toasts.deleted)
    await refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => openUploadFor(null)}>
          {DOCUMENT_LABELS.actions.uploadDocument}
        </Button>
      </div>

      <DocumentsGrid
        folders={folders}
        domain="negocios"
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
        onCancel={() => setSelectedIds(new Set())}
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
        domain="negocios"
        onCreated={(dt) => {
          setDocTypes((prev) => [...prev, dt])
          setUploadFolder(null)
          setUploadOpen(true)
        }}
      />
    </div>
  )
}
