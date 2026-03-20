'use client'

import { DocCategoryCard } from './DocCategoryCard'
import type { DocType } from '@/types/document'

interface UploadedDoc {
  doc_type_id: string
  file_url?: string       // Opcional — deferred docs não têm URL
  file_name?: string      // Presente em deferred docs
}

interface DocumentsSectionProps {
  byCategory: Record<string, DocType[]>
  uploadedDocs: UploadedDoc[]
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
  // Deletion
  onDeleteSingle?: (docTypeId: string) => void
  selectedForDeletion?: Set<string>
  onToggleDeleteSelection?: (docTypeId: string) => void
  isInDeleteMode?: boolean
}

export function DocumentsSection({
  byCategory,
  uploadedDocs,
  onUploaded,
  propertyId,
  ownerId,
  consultantId,
  deferred,
  onFileSelected,
  onDeleteSingle,
  selectedForDeletion,
  onToggleDeleteSelection,
  isInDeleteMode,
}: DocumentsSectionProps) {
  return (
    <div className="space-y-4">
      {Object.entries(byCategory).map(([category, types]) => (
        <DocCategoryCard
          key={category}
          category={category}
          docTypes={types}
          uploadedDocs={uploadedDocs}
          onUploaded={onUploaded}
          propertyId={propertyId}
          ownerId={ownerId}
          consultantId={consultantId}
          deferred={deferred}
          onFileSelected={onFileSelected}
          onDeleteSingle={onDeleteSingle}
          selectedForDeletion={selectedForDeletion}
          onToggleDeleteSelection={onToggleDeleteSelection}
          isInDeleteMode={isInDeleteMode}
        />
      ))}
    </div>
  )
}
