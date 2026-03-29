'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Bug, Lightbulb, Loader2, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { FEEDBACK_STATUS_MAP, FEEDBACK_TYPE_LABELS } from '@/types/feedback'
import { TASK_PRIORITY_MAP } from '@/types/task'
import type { FeedbackWithRelations, FeedbackStatus } from '@/types/feedback'

interface FeedbackDetailSheetProps {
  item: FeedbackWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  consultants: Array<{ id: string; commercial_name: string }>
}

export function FeedbackDetailSheet({ item, open, onOpenChange, onUpdate, consultants }: FeedbackDetailSheetProps) {
  const [isSaving, setIsSaving] = useState(false)

  if (!item) return null

  const Icon = item.type === 'ticket' ? Bug : Lightbulb
  const statusInfo = FEEDBACK_STATUS_MAP[item.status as FeedbackStatus]
  const priorityInfo = TASK_PRIORITY_MAP[item.priority as keyof typeof TASK_PRIORITY_MAP]

  const handleUpdate = async (data: Record<string, unknown>) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/feedback/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Actualizado')
      onUpdate()
    } catch {
      toast.error('Erro ao actualizar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/feedback/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Eliminado')
      onOpenChange(false)
      onUpdate()
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Icon className={cn(
                'h-5 w-5',
                item.type === 'ticket' ? 'text-red-500' : 'text-amber-500',
              )} />
              {FEEDBACK_TYPE_LABELS[item.type]}
            </SheetTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar {FEEDBACK_TYPE_LABELS[item.type].toLowerCase()}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem a certeza? Esta acção é irreversível.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Title */}
          <div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {item.submitter?.commercial_name || 'Anónimo'}
              <span>·</span>
              <span>{format(new Date(item.created_at), 'PPP HH:mm', { locale: pt })}</span>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{item.description}</p>
            </div>
          )}

          {/* Images */}
          {item.images && item.images.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Imagens ({item.images.length})</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {item.images.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`Imagem ${i + 1}`}
                      className="h-20 w-20 rounded-md object-cover border hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Status */}
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={item.status}
              onValueChange={(v) => handleUpdate({ status: v })}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FEEDBACK_STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', v.dot)} />
                      {v.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={String(item.priority)}
              onValueChange={(v) => handleUpdate({ priority: Number(v) })}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_PRIORITY_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', v.dot)} />
                      {v.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Atribuído a</Label>
            <Select
              value={item.assigned_to || '_none'}
              onValueChange={(v) => handleUpdate({ assigned_to: v === '_none' ? null : v })}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem atribuição</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Tech notes */}
          <div className="space-y-2">
            <Label>Notas Técnicas</Label>
            <Textarea
              defaultValue={item.tech_notes || ''}
              placeholder="Notas internas sobre este item..."
              rows={4}
              onBlur={(e) => {
                const val = e.target.value.trim()
                if (val !== (item.tech_notes || '')) {
                  handleUpdate({ tech_notes: val || null })
                }
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
