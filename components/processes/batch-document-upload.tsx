'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Sparkles, Loader2, Check, X, AlertTriangle, FileText } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DocIcon } from '@/components/icons/doc-icon'
import type { ProcSubtask } from '@/types/subtask'

interface ClassifiedFile {
  file: File
  index: number
  doc_type_id: string | null
  doc_type_name: string | null
  confidence: 'high' | 'medium' | 'low'
  matched_subtask_id: string | null
  matched_subtask_title: string | null
  accepted: boolean
}

interface BatchDocumentUploadProps {
  processId: string
  taskId: string
  propertyId: string
  /** Upload subtasks that are still pending (not completed) */
  uploadSubtasks: ProcSubtask[]
  ownerId?: string
  onComplete: () => void
}

export function BatchDocumentUpload({
  processId,
  taskId,
  propertyId,
  uploadSubtasks,
  ownerId,
  onComplete,
}: BatchDocumentUploadProps) {
  const [isClassifying, setIsClassifying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Build map of doc_type_id → subtask for matching
  const subtaskByDocType = new Map<string, ProcSubtask>()
  for (const sub of uploadSubtasks) {
    const config = sub.config as Record<string, unknown>
    const docTypeId = config?.doc_type_id as string | undefined
    if (docTypeId && !sub.is_completed) {
      subtaskByDocType.set(docTypeId, sub)
    }
  }

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsClassifying(true)
    const formData = new FormData()
    const fileArray = Array.from(files)
    fileArray.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('/api/documents/classify', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Erro na classificação')

      const { data } = await res.json()

      const classified: ClassifiedFile[] = fileArray.map((file, idx) => {
        const match = data?.find((d: any) => d.index === idx)
        const docTypeId = match?.doc_type_id || null
        const matchedSubtask = docTypeId ? subtaskByDocType.get(docTypeId) : null

        return {
          file,
          index: idx,
          doc_type_id: docTypeId,
          doc_type_name: match?.doc_type_name || null,
          confidence: match?.confidence || 'low',
          matched_subtask_id: matchedSubtask?.id || null,
          matched_subtask_title: matchedSubtask?.title || null,
          accepted: !!matchedSubtask && match?.confidence !== 'low',
        }
      })

      setClassifiedFiles(classified)
      const matchedCount = classified.filter(f => f.accepted).length
      toast.success(`${fileArray.length} ficheiro${fileArray.length > 1 ? 's' : ''} analisado${fileArray.length > 1 ? 's' : ''} — ${matchedCount} correspondência${matchedCount !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Erro ao classificar documentos')
    } finally {
      setIsClassifying(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleAccepted = (idx: number) => {
    setClassifiedFiles(prev => prev.map((f, i) =>
      i === idx ? { ...f, accepted: !f.accepted } : f
    ))
  }

  const removeFile = (idx: number) => {
    setClassifiedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUploadAll = async () => {
    const accepted = classifiedFiles.filter(f => f.accepted && f.matched_subtask_id)
    if (accepted.length === 0) {
      toast.error('Nenhum ficheiro aceite para enviar')
      return
    }

    setIsUploading(true)
    let successCount = 0
    const uploadedLegalDocs: { file: File; docTypeName: string; docId: string }[] = []

    for (const cf of accepted) {
      try {
        // 1. Upload file to R2
        const formData = new FormData()
        formData.append('file', cf.file)
        if (cf.doc_type_id) formData.append('doc_type_id', cf.doc_type_id)
        if (ownerId) formData.append('owner_id', ownerId)

        const uploadRes = await fetch(`/api/properties/${propertyId}/documents/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          toast.error(`Erro ao enviar "${cf.file.name}"`)
          continue
        }

        const { id: docRegistryId } = await uploadRes.json()

        // Track caderneta/certidão for legal extraction
        const lowerName = (cf.doc_type_name || '').toLowerCase()
        if (
          lowerName.includes('caderneta') ||
          lowerName.includes('certidão') ||
          lowerName.includes('certidao')
        ) {
          uploadedLegalDocs.push({
            file: cf.file,
            docTypeName: cf.doc_type_name || '',
            docId: docRegistryId,
          })
        }

        // 2. Complete the matched subtask
        const completeRes = await fetch(
          `/api/processes/${processId}/tasks/${taskId}/subtasks/${cf.matched_subtask_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              is_completed: true,
              task_result: { doc_registry_id: docRegistryId },
            }),
          }
        )

        if (completeRes.ok) {
          successCount++
        }
      } catch {
        toast.error(`Erro ao processar "${cf.file.name}"`)
      }
    }

    // Extract legal_data (Caderneta/CRP) → dev_property_legal_data (background)
    if (uploadedLegalDocs.length > 0) {
      const legalToastId = toast.loading('A extrair dados legais (Caderneta/CRP)...')
      try {
        const legalForm = new FormData()
        const docTypesArr: { name: string; category: string }[] = []
        const docIdsArr: string[] = []
        for (const d of uploadedLegalDocs) {
          legalForm.append('files', d.file)
          docTypesArr.push({ name: d.docTypeName, category: '' })
          docIdsArr.push(d.docId)
        }
        legalForm.append('doc_types', JSON.stringify(docTypesArr))
        legalForm.append('property_id', propertyId)
        legalForm.append('doc_registry_ids', JSON.stringify(docIdsArr))

        const legalRes = await fetch('/api/documents/extract', {
          method: 'POST',
          body: legalForm,
        })
        toast.dismiss(legalToastId)
        if (legalRes.ok) {
          const j = await legalRes.json()
          if (j.legal_data_saved) {
            toast.success(`${j.legal_data_fields_set} campo(s) legal(is) extraído(s)`)
          }
        }
      } catch {
        toast.dismiss(legalToastId)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} documento${successCount > 1 ? 's' : ''} enviado${successCount > 1 ? 's' : ''} com sucesso`)
      setClassifiedFiles([])
      onComplete()
    }
    setIsUploading(false)
  }

  const acceptedCount = classifiedFiles.filter(f => f.accepted).length

  if (classifiedFiles.length === 0) {
    return (
      <div className="opacity-65">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isClassifying}
        >
          {isClassifying ? (
            <>
              <Spinner variant="infinite" size={14} className="mr-2" />
              A analisar documentos...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Enviar Vários Documentos (IA)
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Documentos Detectados
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => setClassifiedFiles([])}
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      </div>

      <div className="rounded-xl border bg-card/50 overflow-hidden divide-y">
        {classifiedFiles.map((cf, idx) => (
          <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
            {/* Accept toggle */}
            <button
              onClick={() => toggleAccepted(idx)}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                cf.accepted
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-muted-foreground/30 hover:border-muted-foreground/50'
              )}
            >
              {cf.accepted && <Check className="h-3 w-3" />}
            </button>

            {/* File info */}
            <DocIcon className="h-6 w-6 shrink-0" extension={cf.file.name.split('.').pop()} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cf.file.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {cf.matched_subtask_title ? (
                  <span className="text-xs text-muted-foreground">→ {cf.matched_subtask_title}</span>
                ) : cf.doc_type_name ? (
                  <span className="text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                    {cf.doc_type_name} (sem tarefa correspondente)
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Não identificado</span>
                )}
              </div>
            </div>

            {/* Confidence */}
            {cf.doc_type_id && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px] border-0 shrink-0',
                  cf.confidence === 'high' && 'bg-emerald-100 text-emerald-700',
                  cf.confidence === 'medium' && 'bg-amber-100 text-amber-700',
                  cf.confidence === 'low' && 'bg-red-100 text-red-700',
                )}
              >
                {cf.confidence === 'high' ? 'Alta' : cf.confidence === 'medium' ? 'Média' : 'Baixa'}
              </Badge>
            )}

            {/* Remove */}
            <button
              onClick={() => removeFile(idx)}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Upload button */}
      <Button
        size="sm"
        className="w-full"
        onClick={handleUploadAll}
        disabled={isUploading || acceptedCount === 0}
      >
        {isUploading ? (
          <>
            <Spinner variant="infinite" size={14} className="mr-2" />
            A enviar...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Enviar {acceptedCount} documento{acceptedCount !== 1 ? 's' : ''}
          </>
        )}
      </Button>
    </div>
  )
}
