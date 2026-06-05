'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  FileCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { WppMessage } from '@/lib/types/whatsapp-web'

// ── Types ──

interface ErpProperty {
  id: string
  title: string
  city: string | null
  status: string
  property_type: string | null
}

interface PendingUploadItem {
  id: string
  title: string
  doc_type_id: string | null
  stage_name: string | null
  type: 'task' | 'subtask'
  proc_task_id?: string
  owner_id?: string | null
}

interface ErpProcess {
  id: string
  external_ref: string
  current_status: string
  percent_complete: number
  property_id: string
  pending_upload_tasks?: PendingUploadItem[]
  pending_upload_items?: PendingUploadItem[]
}

interface ErpOwner {
  id: string
  name: string
  properties: ErpProperty[]
  processes: ErpProcess[]
}

interface DocType {
  id: string
  name: string
  category: string | null
  allowed_extensions: string[] | null
}

interface SaveToErpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: WppMessage | null
  contactId: string | null
  instanceId: string
  onSaved?: () => void
}

// ── Helpers ──

const MEDIA_TYPES = new Set(['document', 'image', 'video'])

function getFileIcon(type: string) {
  if (type === 'image') return <ImageIcon className="h-5 w-5 text-purple-500" />
  return <FileText className="h-5 w-5 text-blue-500" />
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ──

export function SaveToErpDialog({
  open,
  onOpenChange,
  message,
  contactId,
  instanceId,
  onSaved,
}: SaveToErpDialogProps) {
  // State
  const [ownerData, setOwnerData] = useState<ErpOwner | null>(null)
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [loadingErp, setLoadingErp] = useState(false)
  const [loadingDocTypes, setLoadingDocTypes] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [autoCompleteTask, setAutoCompleteTask] = useState(true)
  const [notes, setNotes] = useState('')

  // Derived
  const activeProcesses = ownerData?.processes.filter(
    (p) => ['in_progress', 'active'].includes(p.current_status)
  ) ?? []

  const selectedProcess = activeProcesses.find(
    (p) => p.property_id === selectedPropertyId
  )

  // Usar pending_upload_items (tarefas + subtarefas) com fallback a pending_upload_tasks
  const allUploadItems = selectedProcess?.pending_upload_items
    ?? selectedProcess?.pending_upload_tasks
    ?? []

  const matchingItems = allUploadItems.filter(
    (t) => !selectedDocTypeId || t.doc_type_id === selectedDocTypeId
  )

  // Fetch ERP data when dialog opens
  const fetchErpData = useCallback(async () => {
    if (!contactId) return
    setLoadingErp(true)
    try {
      const res = await fetch(`/api/whatsapp/contacts/${contactId}/erp-data`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOwnerData(data.owner || null)

      // Auto-select first property if only one
      if (data.owner?.properties?.length === 1) {
        setSelectedPropertyId(data.owner.properties[0].id)
      }
    } catch {
      toast.error('Erro ao carregar dados ERP')
    } finally {
      setLoadingErp(false)
    }
  }, [contactId])

  // Fetch doc types
  const fetchDocTypes = useCallback(async () => {
    setLoadingDocTypes(true)
    try {
      const res = await fetch('/api/libraries/doc-types')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDocTypes(data || [])
    } catch {
      toast.error('Erro ao carregar tipos de documento')
    } finally {
      setLoadingDocTypes(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchErpData()
      fetchDocTypes()
    } else {
      // Reset form on close
      setSelectedPropertyId('')
      setSelectedDocTypeId('')
      setSelectedTaskId('')
      setAutoCompleteTask(true)
      setNotes('')
      setOwnerData(null)
    }
  }, [open, fetchErpData, fetchDocTypes])

  // Auto-select matching item when doc type changes
  useEffect(() => {
    if (matchingItems.length === 1) {
      setSelectedTaskId(matchingItems[0].id)
    } else {
      setSelectedTaskId('')
    }
  }, [selectedDocTypeId, matchingItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Submit
  const handleSave = async () => {
    if (!message || !selectedPropertyId || !selectedDocTypeId) return

    setSaving(true)
    try {
      // Determinar se é tarefa ou subtarefa
      const selectedItem = autoCompleteTask && selectedTaskId
        ? matchingItems.find((i) => i.id === selectedTaskId)
        : null

      const res = await fetch('/api/whatsapp/save-to-erp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: instanceId,
          wa_message_id: message.wa_message_id,
          message_id: message.id,
          doc_type_id: selectedDocTypeId,
          property_id: selectedPropertyId,
          owner_id: ownerData?.id || null,
          proc_task_id: selectedItem?.type === 'task' ? selectedItem.id
            : selectedItem?.type === 'subtask' ? selectedItem.proc_task_id
            : null,
          proc_subtask_id: selectedItem?.type === 'subtask' ? selectedItem.id : null,
          upload_item_type: selectedItem?.type || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(err.error || 'Erro ao guardar')
      }

      const result = await res.json()

      if (result.task_completed) {
        toast.success('Documento guardado e tarefa do processo concluída!')
      } else {
        toast.success('Documento guardado no ERP com sucesso!')
      }

      onOpenChange(false)
      onSaved?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao guardar documento'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Group doc types by category
  const docTypesByCategory = docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  if (!message) return null

  const hasMedia = MEDIA_TYPES.has(message.message_type)
  const noProperties = !loadingErp && (!ownerData || ownerData.properties.length === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Guardar no ERP</DialogTitle>
          <DialogDescription>
            Armazenar ficheiro do WhatsApp como documento do imóvel
          </DialogDescription>
        </DialogHeader>

        {/* File preview */}
        {hasMedia && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            {getFileIcon(message.message_type)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {message.media_file_name || `${message.message_type}-whatsapp`}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(message.media_file_size)}
                {message.media_mime_type && ` · ${message.media_mime_type}`}
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loadingErp ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : noProperties ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Sem propriedades vinculadas</p>
            <p className="text-xs text-muted-foreground mt-1">
              O contacto precisa de estar vinculado a um proprietário com imóveis.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Property selector */}
            {ownerData && ownerData.properties.length > 1 && (
              <div className="space-y-2">
                <Label>Imóvel</Label>
                <RadioGroup
                  value={selectedPropertyId}
                  onValueChange={setSelectedPropertyId}
                  className="gap-2"
                >
                  {ownerData.properties.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <RadioGroupItem value={p.id} id={`prop-${p.id}`} />
                      <Label
                        htmlFor={`prop-${p.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="text-sm font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.city} · {p.property_type}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Single property info */}
            {ownerData && ownerData.properties.length === 1 && (
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {ownerData.properties[0].title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ownerData.properties[0].city} · {ownerData.properties[0].property_type}
                  </div>
                </div>
              </div>
            )}

            {/* Active process info */}
            {selectedProcess && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm">
                <FileCheck className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800 dark:text-blue-300">
                  Processo {selectedProcess.external_ref}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedProcess.percent_complete}%
                </Badge>
              </div>
            )}

            {/* Document type selector */}
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              {loadingDocTypes ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedDocTypeId}
                  onValueChange={setSelectedDocTypeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(docTypesByCategory).map(([category, types]) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{category}</SelectLabel>
                        {types.map((dt) => (
                          <SelectItem key={dt.id} value={dt.id}>
                            {dt.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Process task/subtask auto-complete */}
            {matchingItems.length > 0 && (
              <div className="space-y-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="auto-complete"
                    checked={autoCompleteTask}
                    onCheckedChange={(v) => setAutoCompleteTask(v === true)}
                  />
                  <Label htmlFor="auto-complete" className="text-sm font-medium cursor-pointer">
                    Completar tarefa/subtarefa do processo
                  </Label>
                </div>

                {autoCompleteTask && matchingItems.length > 1 && (
                  <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Seleccionar tarefa/subtarefa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {matchingItems.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-1.5">
                            {t.type === 'subtask' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                sub
                              </Badge>
                            )}
                            {t.title}
                            {t.stage_name && (
                              <span className="text-muted-foreground"> · {t.stage_name}</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {autoCompleteTask && matchingItems.length === 1 && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 ml-6">
                    {matchingItems[0].type === 'subtask' && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 mr-1">
                        sub
                      </Badge>
                    )}
                    {matchingItems[0].title}
                    {matchingItems[0].stage_name && ` · ${matchingItems[0].stage_name}`}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Recebido via WhatsApp..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedPropertyId || !selectedDocTypeId || noProperties}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              'Guardar no ERP'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
