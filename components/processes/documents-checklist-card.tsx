'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Home,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn, formatDateTime } from '@/lib/utils'
import { Spinner } from '@/components/kibo-ui/spinner'
import { DocIcon } from '@/components/icons/doc-icon'
import { DocumentUploader } from '@/components/documents/document-uploader'
import type { ProcSubtask } from '@/types/subtask'
import type { ProcessDocument, ProcessOwner } from '@/types/process'

interface DocumentsChecklistCardProps {
  processId: string
  taskId: string
  propertyId: string
  uploadSubtasks: ProcSubtask[]
  existingDocs: ProcessDocument[]
  owners?: ProcessOwner[]
  mainOwnerId?: string
  onRevert: (subtaskId: string) => void
  onTaskUpdate: () => void
}

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

interface Group {
  key: string
  label: string
  icon: React.ReactNode
  subtasks: ProcSubtask[]
}

const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']

export function DocumentsChecklistCard({
  processId,
  taskId,
  propertyId,
  uploadSubtasks,
  existingDocs,
  owners = [],
  mainOwnerId,
  onRevert,
  onTaskUpdate,
}: DocumentsChecklistCardProps) {
  const [isClassifying, setIsClassifying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([])

  const subtaskByDocType = useMemo(() => {
    const m = new Map<string, ProcSubtask>()
    for (const sub of uploadSubtasks) {
      if (sub.is_completed) continue
      const docTypeId = sub.config?.doc_type_id
      if (docTypeId) m.set(docTypeId, sub)
    }
    return m
  }, [uploadSubtasks])

  const groups: Group[] = useMemo(() => {
    const byKey = new Map<string, Group>()
    byKey.set('property', {
      key: 'property',
      label: 'Imóvel',
      icon: <Home className="h-3.5 w-3.5" />,
      subtasks: [],
    })

    const sortedOwners = [...owners].sort((a, b) => {
      if (a.is_main_contact && !b.is_main_contact) return -1
      if (!a.is_main_contact && b.is_main_contact) return 1
      return a.name.localeCompare(b.name, 'pt-PT')
    })

    for (const owner of sortedOwners) {
      byKey.set(owner.id, {
        key: owner.id,
        label: owner.name,
        icon:
          owner.person_type === 'coletiva' ? (
            <Building2 className="h-3.5 w-3.5" />
          ) : (
            <User className="h-3.5 w-3.5" />
          ),
        subtasks: [],
      })
    }

    for (const sub of uploadSubtasks) {
      const key = sub.owner_id || 'property'
      const group = byKey.get(key) ?? byKey.get('property')!
      group.subtasks.push(sub)
    }

    return Array.from(byKey.values())
      .filter((g) => g.subtasks.length > 0)
      .map((g) => ({
        ...g,
        subtasks: g.subtasks.sort((a, b) => a.order_index - b.order_index),
      }))
  }, [uploadSubtasks, owners])

  const totalSubtasks = uploadSubtasks.length
  const completedCount = uploadSubtasks.filter((s) => s.is_completed).length
  const progressPct = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 100) : 0

  const classifyFiles = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return
      setIsClassifying(true)
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))

      try {
        const res = await fetch('/api/documents/classify', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error('Erro na classificação')
        const { data } = await res.json()

        const classified: ClassifiedFile[] = files.map((file, idx) => {
          const match = data?.find((d: { index: number }) => d.index === idx) as
            | {
                index: number
                doc_type_id?: string
                doc_type_name?: string
                confidence?: 'high' | 'medium' | 'low'
              }
            | undefined
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

        setClassifiedFiles((prev) => [...prev, ...classified])
        const matched = classified.filter((f) => f.accepted).length
        toast.success(
          `${files.length} ficheiro${files.length !== 1 ? 's' : ''} analisado${
            files.length !== 1 ? 's' : ''
          } — ${matched} correspondência${matched !== 1 ? 's' : ''}`,
        )
      } catch {
        toast.error('Erro ao classificar documentos')
      } finally {
        setIsClassifying(false)
      }
    },
    [subtaskByDocType],
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) classifyFiles(accepted)
    },
    [classifyFiles],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
    noClick: false,
    disabled: isClassifying || isUploading,
  })

  const toggleAccepted = (idx: number) => {
    setClassifiedFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, accepted: !f.accepted } : f)))
  }

  const removeClassified = (idx: number) => {
    setClassifiedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const assignClassifiedTo = (idx: number, subtaskId: string) => {
    const sub = uploadSubtasks.find((s) => s.id === subtaskId)
    if (!sub) return
    setClassifiedFiles((prev) =>
      prev.map((f, i) =>
        i === idx
          ? {
              ...f,
              matched_subtask_id: sub.id,
              matched_subtask_title: sub.title,
              doc_type_id: sub.config?.doc_type_id || f.doc_type_id,
              accepted: true,
            }
          : f,
      ),
    )
  }

  const handleUploadAll = async () => {
    const accepted = classifiedFiles.filter((f) => f.accepted && f.matched_subtask_id)
    if (accepted.length === 0) {
      toast.error('Nenhum ficheiro aceite para enviar')
      return
    }

    setIsUploading(true)
    let successCount = 0
    const uploadedLegalDocs: { file: File; docTypeName: string; docId: string }[] = []

    for (const cf of accepted) {
      const matchedSubtask = uploadSubtasks.find((s) => s.id === cf.matched_subtask_id)
      const subtaskOwnerId = matchedSubtask?.owner_id || mainOwnerId

      try {
        const formData = new FormData()
        formData.append('file', cf.file)
        if (cf.doc_type_id) formData.append('doc_type_id', cf.doc_type_id)
        if (subtaskOwnerId) formData.append('owner_id', subtaskOwnerId)

        const uploadRes = await fetch(`/api/properties/${propertyId}/documents/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          toast.error(`Erro ao enviar "${cf.file.name}"`)
          continue
        }

        const { id: docRegistryId } = await uploadRes.json()

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

        const completeRes = await fetch(
          `/api/processes/${processId}/tasks/${taskId}/subtasks/${cf.matched_subtask_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              is_completed: true,
              task_result: { doc_registry_id: docRegistryId },
            }),
          },
        )

        if (completeRes.ok) successCount++
      } catch {
        toast.error(`Erro ao processar "${cf.file.name}"`)
      }
    }

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
      toast.success(`${successCount} documento${successCount !== 1 ? 's' : ''} enviado${successCount !== 1 ? 's' : ''}`)
      setClassifiedFiles([])
      onTaskUpdate()
    }
    setIsUploading(false)
  }

  const acceptedCount = classifiedFiles.filter((f) => f.accepted && f.matched_subtask_id).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{completedCount}</span> de{' '}
              {totalSubtasks} documento{totalSubtasks !== 1 ? 's' : ''}
            </span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {classifiedFiles.length === 0 ? (
        <div
          {...getRootProps()}
          className={cn(
            'group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
            (isClassifying || isUploading) && 'pointer-events-none opacity-60',
          )}
        >
          <input {...getInputProps()} />
          {isClassifying ? (
            <>
              <Spinner variant="infinite" size={24} className="mb-2" />
              <p className="text-sm font-medium">A analisar documentos…</p>
              <p className="text-xs text-muted-foreground">A IA está a identificar cada ficheiro</p>
            </>
          ) : (
            <>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Larga aqui todos os documentos</p>
              <p className="text-xs text-muted-foreground">
                A IA identifica cada um e preenche as pills automaticamente
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                PDF, JPG, PNG, DOC, DOCX · múltiplos ficheiros
              </p>
            </>
          )}
        </div>
      ) : (
        <ClassifiedPanel
          files={classifiedFiles}
          uploadSubtasks={uploadSubtasks}
          isUploading={isUploading}
          onToggle={toggleAccepted}
          onRemove={removeClassified}
          onAssign={assignClassifiedTo}
          onClear={() => setClassifiedFiles([])}
          onUpload={handleUploadAll}
          acceptedCount={acceptedCount}
        />
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <PillGroup
            key={group.key}
            group={group}
            existingDocs={existingDocs}
            processId={processId}
            taskId={taskId}
            propertyId={propertyId}
            mainOwnerId={mainOwnerId}
            onRevert={onRevert}
            onTaskUpdate={onTaskUpdate}
          />
        ))}
      </div>
    </div>
  )
}

function ClassifiedPanel({
  files,
  uploadSubtasks,
  isUploading,
  onToggle,
  onRemove,
  onAssign,
  onClear,
  onUpload,
  acceptedCount,
}: {
  files: ClassifiedFile[]
  uploadSubtasks: ProcSubtask[]
  isUploading: boolean
  onToggle: (idx: number) => void
  onRemove: (idx: number) => void
  onAssign: (idx: number, subtaskId: string) => void
  onClear: () => void
  onUpload: () => void
  acceptedCount: number
}) {
  const pendingSubtasks = uploadSubtasks.filter((s) => !s.is_completed)

  return (
    <div className="space-y-3 rounded-xl border bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Documentos detectados
        </p>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={onClear}>
          <X className="mr-1 h-3 w-3" />
          Limpar
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background divide-y">
        {files.map((cf, idx) => (
          <div key={idx} className="flex items-center gap-3 px-3 py-2">
            <button
              onClick={() => onToggle(idx)}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                cf.accepted
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-muted-foreground/30 hover:border-muted-foreground/50',
              )}
              aria-label={cf.accepted ? 'Desmarcar' : 'Marcar'}
            >
              {cf.accepted && <CheckCircle2 className="h-3 w-3" />}
            </button>

            <DocIcon className="h-6 w-6 shrink-0" extension={cf.file.name.split('.').pop()} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{cf.file.name}</p>
              {cf.matched_subtask_title ? (
                <p className="truncate text-xs text-muted-foreground">
                  → {cf.matched_subtask_title}
                </p>
              ) : cf.doc_type_name ? (
                <p className="text-xs text-amber-600">
                  {cf.doc_type_name} (sem pill correspondente)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Não identificado</p>
              )}
            </div>

            {cf.doc_type_id && (
              <Badge
                variant="secondary"
                className={cn(
                  'shrink-0 border-0 text-[10px]',
                  cf.confidence === 'high' && 'bg-emerald-100 text-emerald-700',
                  cf.confidence === 'medium' && 'bg-amber-100 text-amber-700',
                  cf.confidence === 'low' && 'bg-red-100 text-red-700',
                )}
              >
                {cf.confidence === 'high' ? 'Alta' : cf.confidence === 'medium' ? 'Média' : 'Baixa'}
              </Badge>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs">
                  {cf.matched_subtask_id ? 'Alterar' : 'Atribuir'}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1" align="end">
                <div className="max-h-64 overflow-y-auto">
                  {pendingSubtasks.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      Sem pills pendentes.
                    </p>
                  ) : (
                    pendingSubtasks.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onAssign(idx, s.id)}
                        className={cn(
                          'w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted',
                          cf.matched_subtask_id === s.id && 'bg-muted',
                        )}
                      >
                        <p className="font-medium">{s.title}</p>
                        {s.owner?.name && (
                          <p className="text-muted-foreground">{s.owner.name}</p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={() => onRemove(idx)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Button size="sm" className="w-full" onClick={onUpload} disabled={isUploading || acceptedCount === 0}>
        {isUploading ? (
          <>
            <Spinner variant="infinite" size={14} className="mr-2" />
            A enviar…
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

function PillGroup({
  group,
  existingDocs,
  processId,
  taskId,
  propertyId,
  mainOwnerId,
  onRevert,
  onTaskUpdate,
}: {
  group: Group
  existingDocs: ProcessDocument[]
  processId: string
  taskId: string
  propertyId: string
  mainOwnerId?: string
  onRevert: (subtaskId: string) => void
  onTaskUpdate: () => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {group.icon}
        <span className="font-medium uppercase tracking-wider">{group.label}</span>
        <span className="ml-auto">
          {group.subtasks.filter((s) => s.is_completed).length}/{group.subtasks.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.subtasks.map((s) => (
          <Pill
            key={s.id}
            subtask={s}
            existingDocs={existingDocs}
            processId={processId}
            taskId={taskId}
            propertyId={propertyId}
            mainOwnerId={mainOwnerId}
            onRevert={onRevert}
            onTaskUpdate={onTaskUpdate}
          />
        ))}
      </div>
    </div>
  )
}

function Pill({
  subtask,
  existingDocs,
  processId,
  taskId,
  propertyId,
  mainOwnerId,
  onRevert,
  onTaskUpdate,
}: {
  subtask: ProcSubtask
  existingDocs: ProcessDocument[]
  processId: string
  taskId: string
  propertyId: string
  mainOwnerId?: string
  onRevert: (subtaskId: string) => void
  onTaskUpdate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const config = subtask.config as Record<string, unknown>
  const docTypeId = config.doc_type_id as string | undefined
  const taskResult = config.task_result as Record<string, string> | undefined
  const docRegistryId = taskResult?.doc_registry_id
  const ownerId = subtask.owner_id || mainOwnerId
  const allowedExtensions =
    (config.allowed_extensions as string[]) || ACCEPTED_EXTENSIONS

  const linkedDoc = docRegistryId ? existingDocs.find((d) => d.id === docRegistryId) : undefined

  const matchingDoc =
    !subtask.is_completed && docTypeId
      ? existingDocs.find((d) => {
          if (d.doc_type?.id !== docTypeId) return false
          if (d.valid_until && new Date(d.valid_until) <= new Date()) return false
          if (ownerId && d.owner_id && d.owner_id !== ownerId) return false
          return true
        })
      : undefined

  const isBlocked = !!(subtask as unknown as { is_blocked?: boolean }).is_blocked

  const completeWithDoc = async (docId: string) => {
    setIsBusy(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_completed: true,
            task_result: { doc_registry_id: docId },
          }),
        },
      )
      if (res.ok) {
        onTaskUpdate()
        setOpen(false)
      } else {
        toast.error('Erro ao vincular documento')
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleUploaded = async (result: { id: string }) => {
    await completeWithDoc(result.id)
  }

  const handleRevert = () => {
    onRevert(subtask.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isBlocked}
          className={cn(
            'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
            subtask.is_completed
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-dashed border-muted-foreground/40 bg-background text-foreground hover:border-primary hover:bg-muted/50',
            isBlocked && 'cursor-not-allowed opacity-50',
          )}
        >
          {subtask.is_completed ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Upload className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="max-w-[200px] truncate">{subtask.title}</span>
          {isBusy && <Spinner variant="infinite" size={10} />}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3" align="start">
        {subtask.is_completed ? (
          <div className="space-y-3">
            {linkedDoc && (
              <div className="flex items-center gap-2 rounded-md border bg-card p-2">
                <DocIcon className="h-8 w-8 shrink-0" extension={linkedDoc.file_name.split('.').pop()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{linkedDoc.doc_type?.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{linkedDoc.file_name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
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
              <p className="text-[11px] text-muted-foreground">
                Concluído em {formatDateTime(subtask.completed_at)}
              </p>
            )}
            {docTypeId && (
              <div>
                <p className="mb-1.5 text-[11px] font-medium">Substituir documento</p>
                <DocumentUploader
                  docTypeId={docTypeId}
                  allowedExtensions={allowedExtensions}
                  propertyId={propertyId}
                  ownerId={ownerId}
                  onUploaded={handleUploaded}
                  disabled={isBusy}
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-orange-600 hover:text-orange-700"
              onClick={handleRevert}
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Reverter
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-medium">{subtask.title}</p>
            {subtask.owner?.name && (
              <p className="text-[11px] text-muted-foreground">{subtask.owner.name}</p>
            )}

            {matchingDoc && (
              <div className="space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-800 dark:bg-emerald-950/20">
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Documento já existente
                </p>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="flex-1 truncate text-xs">{matchingDoc.file_name}</p>
                </div>
                <Button
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => completeWithDoc(matchingDoc.id)}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <Spinner variant="infinite" size={12} className="mr-1.5" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Usar este
                </Button>
              </div>
            )}

            {docTypeId ? (
              <div>
                <p className="mb-1.5 text-[11px] font-medium">
                  {matchingDoc ? 'Ou enviar novo' : 'Enviar documento'}
                </p>
                <DocumentUploader
                  docTypeId={docTypeId}
                  allowedExtensions={allowedExtensions}
                  propertyId={propertyId}
                  ownerId={ownerId}
                  onUploaded={handleUploaded}
                  disabled={isBusy || isBlocked}
                />
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Sem tipo de documento configurado.
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
