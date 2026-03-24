'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageCircle,
  CheckCircle2,
  Save,
  Send,
  RotateCcw,
  User,
  Building2,
} from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { interpolateVariables } from '@/lib/utils'
import type { ProcSubtask } from '@/types/subtask'

interface SubtaskWhatsAppSheetProps {
  subtask: ProcSubtask
  processId: string
  taskId: string
  ownerPhone?: string
  ownerName?: string
  ownerPersonType?: 'singular' | 'coletiva'
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete: () => void
  onSaveDraft?: () => void
}

export function SubtaskWhatsAppSheet({
  subtask,
  processId,
  taskId,
  ownerPhone,
  ownerName,
  ownerPersonType,
  open,
  onOpenChange,
  onComplete,
}: SubtaskWhatsAppSheetProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')
  const [templateMessages, setTemplateMessages] = useState<{ id: string; type: string; content: string }[]>([])
  const [instances, setInstances] = useState<{ id: string; name: string; phone?: string | null; connection_status: string }[]>([])
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')

  const config = subtask.config as Record<string, unknown>
  const isCompleted = subtask.is_completed
  const hasRendered = !!config.rendered
  const rendered = config.rendered as Record<string, string> | undefined

  // Load template + instances on open
  useEffect(() => {
    if (!open) return
    setIsLoading(true)

    const loadData = async () => {
      try {
        // If already rendered, restore
        if (rendered?.message) {
          setMessage(rendered.message)
        }

        // Load template if configured
        const templateId = config.whatsapp_template_id as string | undefined
        if (templateId && !rendered?.message) {
          const res = await fetch(`/api/automacao/templates-wpp/${templateId}`)
          if (res.ok) {
            const tpl = await res.json()
            if (tpl.messages && Array.isArray(tpl.messages)) {
              setTemplateMessages(tpl.messages)
              // Combine text messages into a single editable message
              const combined = tpl.messages
                .filter((m: { type: string }) => m.type === 'text')
                .map((m: { content: string }) => m.content)
                .join('\n\n')
              if (!rendered?.message) {
                setMessage(combined)
              }
            }
          }
        }

        // Load instances
        const instRes = await fetch('/api/automacao/instancias')
        if (instRes.ok) {
          const data = await instRes.json()
          if (Array.isArray(data)) {
            setInstances(data)
            // Pre-select configured or first connected
            const configInstance = config.whatsapp_instance_id as string | undefined
            if (configInstance) {
              setSelectedInstanceId(configInstance)
            } else {
              const connected = data.find((i: { connection_status: string }) => i.connection_status === 'connected')
              if (connected) setSelectedInstanceId(connected.id)
            }
          }
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [open])

  const handleSaveDraft = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_whatsapp_draft',
          rendered: { message, phone: ownerPhone || '' },
          whatsapp_instance_id: selectedInstanceId || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Rascunho guardado')
      onComplete()
    } catch {
      toast.error('Erro ao guardar rascunho')
    } finally {
      setIsSaving(false)
    }
  }, [message, ownerPhone, selectedInstanceId, processId, taskId, subtask.id, onComplete])

  const handleSend = useCallback(async () => {
    if (!message.trim()) {
      toast.error('A mensagem não pode estar vazia')
      return
    }
    if (!ownerPhone) {
      toast.error('Proprietário não tem número de telemóvel')
      return
    }
    if (!selectedInstanceId) {
      toast.error('Seleccione uma instância WhatsApp')
      return
    }

    setIsSending(true)
    try {
      const res = await fetch(`/api/processes/${processId}/tasks/${taskId}/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_whatsapp',
          rendered: { message, phone: ownerPhone },
          whatsapp_instance_id: selectedInstanceId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao enviar')
      }
      toast.success('Mensagem WhatsApp enviada!')
      onComplete()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar mensagem')
    } finally {
      setIsSending(false)
    }
  }, [message, ownerPhone, selectedInstanceId, processId, taskId, subtask.id, onComplete, onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col gap-0">
        {/* Header */}
        <SheetHeader className="relative overflow-hidden bg-green-600 px-6 py-5 space-y-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-white" />
              <SheetTitle className="text-lg text-white font-bold leading-snug flex-1">
                {subtask.title}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                isCompleted
                  ? 'bg-white/20 text-white border-white/30'
                  : hasRendered
                  ? 'bg-amber-400/20 text-amber-100 border-amber-300/30'
                  : 'bg-white/10 text-white/60 border-white/20'
              )}>
                {isCompleted ? 'Enviada' : hasRendered ? 'Rascunho' : 'Pendente'}
              </span>
              {ownerName && (
                <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/20 flex items-center gap-1">
                  {ownerPersonType === 'coletiva' ? <Building2 className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                  {ownerName}
                </span>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <>
              {/* Instance selector */}
              {!isCompleted && (
                <div className="space-y-2">
                  <Label>Instância WhatsApp</Label>
                  <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar instância..." />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          <span className="flex items-center gap-2">
                            {inst.name}
                            {inst.phone && <span className="text-muted-foreground text-xs">{inst.phone}</span>}
                            <span className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              inst.connection_status === 'connected' ? 'bg-emerald-500' : 'bg-slate-400'
                            )} />
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recipient */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">Destinatário</Label>
                <p className="text-sm font-medium">
                  {ownerPhone || <span className="text-destructive">Sem número de telemóvel</span>}
                  {ownerName && <span className="text-muted-foreground ml-2">({ownerName})</span>}
                </p>
              </div>

              {/* Message editor / preview */}
              <div className="space-y-2">
                <Label>Mensagem</Label>
                {isCompleted ? (
                  <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-4 text-sm whitespace-pre-wrap">
                    {rendered?.message || message}
                  </div>
                ) : (
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escreva a mensagem WhatsApp..."
                    className="min-h-[200px] resize-y"
                  />
                )}
              </div>

              {/* Variable hint */}
              {!isCompleted && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Variáveis disponíveis:</p>
                  <p className="font-mono text-[11px]">
                    {'{{proprietario_nome}}'} {'{{imovel_ref}}'} {'{{imovel_morada}}'} {'{{consultor_nome}}'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!isCompleted && (
          <div className="border-t px-6 py-3 flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSaving || isSending}
            >
              {isSaving ? <Spinner className="mr-1 h-3 w-3" /> : <Save className="mr-1 h-3 w-3" />}
              Guardar Rascunho
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSend}
              disabled={isSaving || isSending || !message.trim() || !ownerPhone}
            >
              {isSending ? <Spinner className="mr-1 h-3 w-3" /> : <Send className="mr-1 h-3 w-3" />}
              Enviar WhatsApp
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
