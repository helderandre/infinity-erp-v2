'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Eye, Download, RotateCcw, RefreshCw } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { Spinner } from '@/components/kibo-ui/spinner'
import { SubtaskCardBase, type CardState } from './subtask-card-base'
import { DocumentUploader } from '@/components/documents/document-uploader'
import type { ProcSubtask } from '@/types/subtask'
import type { ProcessDocument } from '@/types/process'
import { FileTypeBadge } from '@/components/shared/file-type-badge'

interface SubtaskCardUploadProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  propertyId: string
  existingDocs: ProcessDocument[]
  ownerId?: string
  onRevert: (subtaskId: string) => void
  onTaskUpdate: () => void
}

export function SubtaskCardUpload({
  subtask, processId, taskId, propertyId, existingDocs, ownerId, onRevert, onTaskUpdate,
}: SubtaskCardUploadProps) {
  const [showReplace, setShowReplace] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const config = subtask.config as Record<string, unknown>
  const docTypeId = config.doc_type_id as string | undefined
  const taskResult = config.task_result as Record<string, string> | undefined
  const docRegistryId = taskResult?.doc_registry_id

  const isBlocked = !!(subtask as any).is_blocked
  const state: CardState = subtask.is_completed ? 'completed' : 'pending'

  // Find linked document
  const linkedDoc = docRegistryId
    ? existingDocs.find(d => d.id === docRegistryId)
    : undefined

  const handleUploadComplete = async (result: { id: string; url: string; file_name: string }) => {
    setIsUploading(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_completed: true,
            task_result: { doc_registry_id: result.id },
          }),
        }
      )
      if (res.ok) {
        onTaskUpdate()
        setShowReplace(false)
      }
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <SubtaskCardBase
      subtask={subtask}
      state={state}
      icon={<Upload className={cn('h-4 w-4', state === 'completed' ? 'text-emerald-500' : 'text-blue-500')} />}
      typeLabel="Upload"
    >
      <div className="space-y-2 text-xs">
        {/* Pending: show uploader */}
        {!subtask.is_completed && docTypeId && (
          <DocumentUploader
            docTypeId={docTypeId}
            allowedExtensions={(config.allowed_extensions as string[]) || ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']}
            propertyId={propertyId}
            ownerId={ownerId}
            onUploaded={handleUploadComplete}
            disabled={isUploading || isBlocked}
          />
        )}

        {/* Completed: show uploaded document */}
        {subtask.is_completed && (
          <div className="space-y-2">
            {linkedDoc && (
              <div className="flex items-center gap-2.5 p-2 rounded-md border bg-card">
                <FileTypeBadge fileName={linkedDoc.file_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{linkedDoc.doc_type?.name || linkedDoc.file_name}</p>
                  <p className="text-muted-foreground truncate">{linkedDoc.file_name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={linkedDoc.file_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={linkedDoc.file_url} download={linkedDoc.file_name}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {subtask.completed_at && (
              <p className="text-muted-foreground">
                Concluído em {formatDateTime(subtask.completed_at)}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowReplace(!showReplace)}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Substituir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-orange-600 hover:text-orange-700"
                onClick={() => onRevert(subtask.id)}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reverter
              </Button>
            </div>

            {/* Replace uploader */}
            {showReplace && docTypeId && (
              <div className="pt-1">
                <DocumentUploader
                  docTypeId={docTypeId}
                  allowedExtensions={(config.allowed_extensions as string[]) || ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']}
                  propertyId={propertyId}
                  ownerId={ownerId}
                  onUploaded={handleUploadComplete}
                  disabled={isUploading}
                />
              </div>
            )}
          </div>
        )}

        {isUploading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner variant="infinite" size={14} />
            <span>A processar...</span>
          </div>
        )}
      </div>
    </SubtaskCardBase>
  )
}
