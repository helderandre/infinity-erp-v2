'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DocumentUploader } from '@/components/documents/document-uploader'
import { CheckCircle2, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { UploadResult } from '@/types/document'

interface TaskUploadActionProps {
  taskId: string
  processId: string
  propertyId: string
  docTypeId: string
  docTypeName: string
  allowedExtensions: string[]
  existingDocs?: any[]
  ownerId?: string
  onCompleted: () => void
}

export function TaskUploadAction({
  taskId,
  processId,
  propertyId,
  docTypeId,
  docTypeName,
  allowedExtensions,
  existingDocs = [],
  ownerId,
  onCompleted,
}: TaskUploadActionProps) {
  const [isCompleting, setIsCompleting] = useState(false)

  // Filtrar docs validos com o mesmo doc_type_id (suporta doc_type_id directo ou doc_type.id)
  const validExisting = existingDocs.filter(
    (d) => {
      const typeId = d.doc_type_id || d.doc_type?.id
      return (
        typeId === docTypeId &&
        d.status === 'active' &&
        (!d.valid_until || new Date(d.valid_until) > new Date())
      )
    }
  )

  const completeTask = async (docRegistryId: string) => {
    setIsCompleting(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            task_result: { doc_registry_id: docRegistryId },
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao completar tarefa')
      }

      toast.success('Documento associado e tarefa concluida')
      onCompleted()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleUploaded = async (result: UploadResult) => {
    await completeTask(result.id)
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{docTypeName}</span>
        </div>

        {/* Documentos existentes reutilizaveis */}
        {validExisting.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Documentos existentes com este tipo:
            </p>
            {validExisting.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2 rounded border bg-emerald-50/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="truncate">{doc.file_name}</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">
                    Valido
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => completeTask(doc.id)}
                  disabled={isCompleting}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Usar este
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Area de upload */}
        <DocumentUploader
          docTypeId={docTypeId}
          allowedExtensions={allowedExtensions}
          propertyId={propertyId}
          ownerId={ownerId}
          onUploaded={handleUploaded}
        />
      </CardContent>
    </Card>
  )
}
