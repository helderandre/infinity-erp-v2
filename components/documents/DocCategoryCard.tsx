'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DocRow } from './DocRow'
import type { DocType } from '@/types/document'

interface UploadedDoc {
  doc_type_id: string
  file_url?: string       // Opcional — deferred docs não têm URL
  file_name?: string      // Presente em deferred docs
}

interface DocCategoryCardProps {
  category: string
  docTypes: DocType[]
  uploadedDocs: UploadedDoc[]
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Deferred
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}

// SVG circular progress ring
function ProgressRing({
  uploaded,
  total,
}: {
  uploaded: number
  total: number
}) {
  const size = 32
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? uploaded / total : 0
  const offset = circumference - progress * circumference
  const isComplete = uploaded === total && total > 0

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-border"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={isComplete ? 'stroke-emerald-500' : 'stroke-foreground dark:stroke-primary'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
      />
    </svg>
  )
}

export function DocCategoryCard({
  category,
  docTypes,
  uploadedDocs,
  onUploaded,
  propertyId,
  ownerId,
  consultantId,
  deferred,
  onFileSelected,
}: DocCategoryCardProps) {
  // Um doc "conta" se tem file_url (uploaded) OU file_name sem file_url (pending/deferred)
  const uploadedCount = docTypes.filter((dt) =>
    uploadedDocs.some((d) => d.doc_type_id === dt.id && (d.file_url || d.file_name))
  ).length
  const totalCount = docTypes.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{category}</CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            {uploadedCount}/{totalCount}
          </Badge>
        </div>
        <ProgressRing uploaded={uploadedCount} total={totalCount} />
      </CardHeader>
      <CardContent className="space-y-2">
        {docTypes.map((dt) => {
          const isUploaded = uploadedDocs.some(
            (d) => d.doc_type_id === dt.id && d.file_url
          )
          const isPending = !isUploaded && uploadedDocs.some(
            (d) => d.doc_type_id === dt.id && d.file_name && !d.file_url
          )
          return (
            <DocRow
              key={dt.id}
              docType={dt}
              isUploaded={isUploaded}
              isPending={isPending}
              onUploaded={onUploaded}
              propertyId={propertyId}
              ownerId={ownerId}
              consultantId={consultantId}
              deferred={deferred}
              onFileSelected={onFileSelected}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
