'use client'

import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Bug, Lightbulb, Loader2, Trash2, User, Image as ImageIcon, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { FEEDBACK_STATUS_MAP, FEEDBACK_TYPE_LABELS, FEEDBACK_PAGE_LABELS } from '@/types/feedback'
import { TASK_PRIORITY_MAP } from '@/types/task'
import type { FeedbackWithRelations, FeedbackStatus } from '@/types/feedback'

interface FeedbackDetailSheetProps {
  item: FeedbackWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  consultants: Array<{ id: string; commercial_name: string }>
}

// Visual key per type — drives the hero gradient + accent ring on the icon
// so a Bug looks distinct from an Ideia at a glance.
const TYPE_THEME = {
  ticket: {
    Icon: Bug,
    gradient: 'from-red-500/12 via-rose-500/8 to-transparent',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-600',
    ring: 'ring-red-300/40 dark:ring-red-700/40',
  },
  ideia: {
    Icon: Lightbulb,
    gradient: 'from-amber-500/12 via-yellow-500/8 to-transparent',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-600',
    ring: 'ring-amber-300/40 dark:ring-amber-700/40',
  },
} as const

export function FeedbackDetailSheet({ item, open, onOpenChange, onUpdate, consultants }: FeedbackDetailSheetProps) {
  const isMobile = useIsMobile()
  const [isSaving, setIsSaving] = useState(false)
  const [pendingField, setPendingField] = useState<string | null>(null)

  if (!item) return null

  const theme = TYPE_THEME[item.type as keyof typeof TYPE_THEME] ?? TYPE_THEME.ticket
  const Icon = theme.Icon
  const statusInfo = FEEDBACK_STATUS_MAP[item.status as FeedbackStatus]
  const priorityInfo = TASK_PRIORITY_MAP[item.priority as keyof typeof TASK_PRIORITY_MAP]

  const handleUpdate = async (data: Record<string, unknown>, field?: string) => {
    setIsSaving(true)
    if (field) setPendingField(field)
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
      setPendingField(null)
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

  const submitterName = item.submitter?.commercial_name || 'Anónimo'
  const initials = submitterName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const createdAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: pt })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[560px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>{FEEDBACK_TYPE_LABELS[item.type]}</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        {/* ─── Hero ─── */}
        <div className="relative shrink-0 px-6 pt-8 pb-5 sm:px-8 sm:pt-10">
          {/* gradient backdrop keyed to type */}
          <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none', theme.gradient)} />
          <div className="relative flex items-start gap-4">
            <div className={cn(
              'shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center ring-1',
              theme.iconBg, theme.ring,
            )}>
              <Icon className={cn('h-6 w-6', theme.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
                {FEEDBACK_TYPE_LABELS[item.type]}
              </p>
              <h2 className="mt-0.5 text-[18px] sm:text-[20px] font-semibold leading-tight tracking-tight break-words">
                {item.title}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {initials || <User className="h-2.5 w-2.5" />}
                  </span>
                  {submitterName}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span title={format(new Date(item.created_at), 'PPP HH:mm', { locale: pt })}>
                  {createdAgo}
                </span>
              </div>
            </div>

            {/* delete in the corner */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive">
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
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* current state at-a-glance — quick chips below the title */}
          <div className="relative mt-4 flex items-center gap-1.5 flex-wrap">
            {statusInfo && (
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                statusInfo.bg, statusInfo.text,
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', statusInfo.dot)} />
                {statusInfo.label}
              </span>
            )}
            {priorityInfo && (
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                priorityInfo.bg, priorityInfo.color,
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', priorityInfo.dot)} />
                {priorityInfo.label}
              </span>
            )}
            {item.assigned_to && (() => {
              const assignee = consultants.find((c) => c.id === item.assigned_to)
              if (!assignee) return null
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-muted text-foreground/80">
                  <User className="h-2.5 w-2.5" />
                  {assignee.commercial_name}
                </span>
              )
            })()}
            {isSaving && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                a guardar
              </span>
            )}
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 pb-8 space-y-6">
          {/* Page detected — clue para a equipa técnica saber onde ir. */}
          {item.page && FEEDBACK_PAGE_LABELS[item.page as keyof typeof FEEDBACK_PAGE_LABELS] && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wider text-muted-foreground/80">
                Página
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-foreground font-medium">
                {FEEDBACK_PAGE_LABELS[item.page as keyof typeof FEEDBACK_PAGE_LABELS]}
              </span>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.description}</p>
            </div>
          )}

          {/* Images grid */}
          {item.images && item.images.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
                <ImageIcon className="h-3 w-3" />
                Imagens · {item.images.length}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {item.images.map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border/40 bg-muted/30"
                  >
                    <img
                      src={url}
                      alt={`Imagem ${i + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ─── Estado (chip row) ─── */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(FEEDBACK_STATUS_MAP) as [FeedbackStatus, typeof FEEDBACK_STATUS_MAP['novo']][]).map(
                ([key, info]) => {
                  const isActive = item.status === key
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isSaving}
                      onClick={() => !isActive && handleUpdate({ status: key }, 'status')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium border transition-all',
                        isActive
                          ? cn(info.bg, info.text, 'border-transparent shadow-sm')
                          : 'bg-background/60 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60',
                        'disabled:opacity-60',
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', info.dot)} />
                      {info.label}
                    </button>
                  )
                },
              )}
            </div>
          </div>

          {/* ─── Prioridade (chip row) ─── */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
              Prioridade
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TASK_PRIORITY_MAP).map(([key, info]) => {
                const isActive = String(item.priority) === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isSaving}
                    onClick={() => !isActive && handleUpdate({ priority: Number(key) }, 'priority')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium border transition-all',
                      isActive
                        ? cn(info.bg, info.color, 'border-transparent shadow-sm')
                        : 'bg-background/60 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60',
                      'disabled:opacity-60',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', info.dot)} />
                    {info.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─── Atribuído ─── */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
              Atribuído a
            </p>
            <Select
              value={item.assigned_to || '_none'}
              onValueChange={(v) => handleUpdate({ assigned_to: v === '_none' ? null : v }, 'assignee')}
              disabled={isSaving}
            >
              <SelectTrigger className="rounded-full h-10 bg-background/60">
                <SelectValue placeholder="Sem atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Sem atribuição
                  </span>
                </SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                        {c.commercial_name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'}
                      </span>
                      {c.commercial_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ─── Notas Técnicas ─── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Notas Técnicas
              </p>
              {pendingField === 'tech_notes' && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <Textarea
              defaultValue={item.tech_notes || ''}
              placeholder="Notas internas sobre este item — repro, hipóteses, próximos passos…"
              rows={4}
              className="rounded-2xl bg-background/60 border-border/40 focus-visible:ring-1"
              onBlur={(e) => {
                const val = e.target.value.trim()
                if (val !== (item.tech_notes || '')) {
                  handleUpdate({ tech_notes: val || null }, 'tech_notes')
                }
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
