'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Bug, Lightbulb, Loader2, Trash2, User, Image as ImageIcon, Sparkles,
  MessageCircle, Send, Forward, Pencil, Check, X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { FEEDBACK_STATUS_MAP, FEEDBACK_TYPE_LABELS, FEEDBACK_PAGE_LABELS } from '@/types/feedback'
import { TASK_PRIORITY_MAP } from '@/types/task'
import type { FeedbackWithRelations, FeedbackStatus } from '@/types/feedback'

interface FeedbackComment {
  id: string
  content: string
  sent_to_chat: boolean
  sent_to_chat_at: string | null
  chat_recipient_id: string | null
  created_at: string
  author: { id: string; commercial_name: string } | null
  chat_recipient: { id: string; commercial_name: string } | null
}

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
  const { user } = useUser()
  const canManage = isManagementRole(user?.role_names ?? [])
  const isSubmitter = !!user?.id && !!item?.submitted_by && user.id === item.submitted_by
  const canDelete = canManage || isSubmitter
  const [isSaving, setIsSaving] = useState(false)
  const [pendingField, setPendingField] = useState<string | null>(null)

  // ─── Comments state ────────────────────────────────────────────
  const [comments, setComments] = useState<FeedbackComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sendViaChat, setSendViaChat] = useState(false)
  // Default recipient = submitter; broker pode mudar para reencaminhar.
  const [chatRecipientId, setChatRecipientId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ─── Inline edit (title + description) ────────────────────────────
  // Autor pode editar o conteúdo do próprio ticket sem ter de abrir um
  // novo no mesmo tema. Management pode editar qualquer item.
  const canEditContent = canManage || isSubmitter
  const [editingField, setEditingField] = useState<'title' | 'description' | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')

  const itemId = item?.id

  const loadComments = useCallback(async (id: string) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/feedback/${id}/comments`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setComments(Array.isArray(data) ? data : [])
    } catch {
      // silent — secção fica vazia se falhar
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && itemId) {
      void loadComments(itemId)
    }
    if (!open) {
      // Reset form ao fechar para não persistir draft entre items.
      setDraft('')
      setSendViaChat(false)
      setChatRecipientId(null)
      setComments([])
    }
  }, [open, itemId, loadComments])

  // Quando muda o item dentro do mesmo open (broker navega entre rows),
  // reset do recipient para alinhar com o novo submitter.
  useEffect(() => {
    if (item) setChatRecipientId(item.submitted_by || null)
  }, [item?.id, item?.submitted_by])

  // Sai do modo de edição quando o item muda ou o sheet fecha.
  useEffect(() => {
    setEditingField(null)
  }, [item?.id, open])

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

  const handleSubmitComment = async () => {
    if (!item) return
    const content = draft.trim()
    if (!content) {
      toast.error('Comentário vazio')
      return
    }
    if (sendViaChat && !chatRecipientId) {
      toast.error('Escolhe um destinatário para o chat')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/feedback/${item.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          send_via_chat: sendViaChat,
          chat_recipient_id: sendViaChat ? chatRecipientId : null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error || 'Erro ao gravar comentário')
      }
      // Optimistic-ish: prepend ao local (server devolve o row hidratado).
      if (body.comment) {
        setComments((prev) => [...prev, body.comment])
      }
      setDraft('')
      // Mantemos o toggle no estado anterior para fluxos repetidos
      // (broker que comenta + chata a múltiplos colegas em série).
      if (body.chat_warning) {
        toast.warning(`Comentário guardado, mas o envio por chat falhou: ${body.chat_warning}`)
      } else {
        toast.success(sendViaChat ? 'Comentário guardado e enviado via chat' : 'Comentário guardado')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gravar')
    } finally {
      setSubmitting(false)
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
  // Guarda contra `created_at` vazio/inválido — pode acontecer durante a
  // animação de saída do Sheet com dados parciais. Sem isto, date-fns
  // dispara `RangeError: Invalid time value` e crasha a app.
  const createdDate = item.created_at ? new Date(item.created_at) : null
  const isValidDate = createdDate && !isNaN(createdDate.getTime())
  const createdAgo = isValidDate
    ? formatDistanceToNow(createdDate, { addSuffix: true, locale: pt })
    : ''
  const createdTooltip = isValidDate
    ? format(createdDate, 'PPP HH:mm', { locale: pt })
    : ''

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
              {editingField === 'title' ? (
                <div className="mt-0.5 flex items-start gap-2">
                  <Input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        const next = titleDraft.trim()
                        if (next && next !== item.title) {
                          handleUpdate({ title: next }, 'title').then(() => setEditingField(null))
                        } else {
                          setEditingField(null)
                        }
                      }
                      if (e.key === 'Escape') setEditingField(null)
                    }}
                    autoFocus
                    disabled={isSaving}
                    className="text-[18px] sm:text-[20px] font-semibold h-9 rounded-lg"
                  />
                  <div className="flex items-center gap-1 pt-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-600"
                      disabled={isSaving || !titleDraft.trim() || titleDraft.trim() === item.title}
                      onClick={() => {
                        const next = titleDraft.trim()
                        if (next && next !== item.title) {
                          handleUpdate({ title: next }, 'title').then(() => setEditingField(null))
                        } else {
                          setEditingField(null)
                        }
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => setEditingField(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-0.5 flex items-start gap-2 group">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold leading-tight tracking-tight break-words flex-1 min-w-0">
                    {item.title}
                  </h2>
                  {canEditContent && (
                    <button
                      type="button"
                      onClick={() => {
                        setTitleDraft(item.title)
                        setEditingField('title')
                      }}
                      className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="Editar título"
                      title="Editar título"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {initials || <User className="h-2.5 w-2.5" />}
                  </span>
                  {submitterName}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span title={createdTooltip}>
                  {createdAgo}
                </span>
              </div>
            </div>

            {/* delete in the corner — management ou autor do item */}
            {canDelete && (
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
            )}
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

          {/* Description — editável inline pelo autor + management. Autor
              que esqueceu detalhes não tem de abrir um ticket novo no mesmo
              tema; pode acrescentar contexto aqui. */}
          {editingField === 'description' ? (
            <div className="space-y-2">
              <Textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingField(null)
                }}
                autoFocus
                disabled={isSaving}
                rows={6}
                className="rounded-2xl bg-card/60 text-sm leading-relaxed"
                placeholder="Adiciona contexto, passos para reproduzir, screenshots..."
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full h-8"
                  onClick={() => setEditingField(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full h-8"
                  disabled={isSaving || descDraft === (item.description ?? '')}
                  onClick={() => {
                    const next = descDraft.trim() || null
                    handleUpdate({ description: next }, 'description').then(() =>
                      setEditingField(null),
                    )
                  }}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : item.description ? (
            <div className="group relative rounded-2xl border border-border/40 bg-card/60 p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.description}</p>
              {canEditContent && (
                <button
                  type="button"
                  onClick={() => {
                    setDescDraft(item.description ?? '')
                    setEditingField('description')
                  }}
                  className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  aria-label="Editar descrição"
                  title="Editar descrição"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : canEditContent ? (
            <button
              type="button"
              onClick={() => {
                setDescDraft('')
                setEditingField('description')
              }}
              className="w-full rounded-2xl border border-dashed border-border/60 bg-card/30 p-4 text-left text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Adicionar descrição
              </span>
            </button>
          ) : null}

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

          {/* ─── Edição triagem (Estado / Prioridade / Atribuído) ───
              Só management edita. Para os restantes, a info já está
              visível em chips read-only no hero. */}
          {canManage && (
            <>
              {/* Estado (chip row) */}
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

              {/* Prioridade (chip row) */}
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

              {/* Atribuído */}
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
            </>
          )}

          {/* ─── Comentários ───
              Mini-timeline + form com toggle "Enviar via chat" e picker de
              destinatário (default: submitter; broker pode escolher outro
              colega para reencaminhar / pedir input). O comentário é gravado
              sempre, independente do envio do chat. */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider inline-flex items-center gap-1.5">
                <MessageCircle className="h-3 w-3" />
                Comentários
              </p>
              {comments.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60">{comments.length}</span>
              )}
              {commentsLoading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>

            {comments.length > 0 && (
              <ul className="space-y-2.5">
                {comments.map((c) => {
                  const authorName = c.author?.commercial_name || 'Utilizador'
                  const initials = authorName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
                  const ago = c.created_at
                    ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: pt })
                    : ''
                  return (
                    <li
                      key={c.id}
                      className="rounded-2xl border border-border/40 bg-card/60 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium">
                          {initials || <User className="h-2.5 w-2.5" />}
                        </span>
                        <span className="font-medium text-foreground">{authorName}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-muted-foreground">{ago}</span>
                        {c.sent_to_chat && c.chat_recipient && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium">
                            <Send className="h-2.5 w-2.5" />
                            chat → {c.chat_recipient.commercial_name?.split(' ')[0] || 'colega'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap leading-relaxed">
                        {c.content}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Form */}
            <div className="rounded-2xl border border-border/40 bg-background/60 p-3 space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Deixa um comentário…"
                rows={3}
                className="rounded-xl bg-background/80 border-border/40 focus-visible:ring-1 resize-none"
                disabled={submitting}
              />

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="flex items-center gap-2 mr-auto">
                  <Switch
                    id="feedback-send-chat"
                    checked={sendViaChat}
                    onCheckedChange={setSendViaChat}
                    disabled={submitting}
                  />
                  <Label htmlFor="feedback-send-chat" className="text-[11px] font-medium cursor-pointer">
                    Enviar via chat
                  </Label>
                </div>

                {sendViaChat && (
                  <Select
                    value={chatRecipientId || '_none'}
                    onValueChange={(v) => setChatRecipientId(v === '_none' ? null : v)}
                    disabled={submitting}
                  >
                    <SelectTrigger className="rounded-full h-8 text-xs px-3 bg-background/80 w-auto min-w-[180px]">
                      <SelectValue placeholder="Escolher destinatário" />
                    </SelectTrigger>
                    <SelectContent>
                      {item.submitted_by && (() => {
                        const submitterUser = consultants.find((c) => c.id === item.submitted_by)
                        const submitterDisplay = submitterUser?.commercial_name || 'Autor'
                        return (
                          <SelectItem value={item.submitted_by}>
                            <span className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{submitterDisplay}</span>
                              <span className="text-[10px] text-muted-foreground">(autor)</span>
                            </span>
                          </SelectItem>
                        )
                      })()}
                      {consultants
                        .filter((c) => c.id !== item.submitted_by)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <Forward className="h-3 w-3 text-muted-foreground" />
                              {c.commercial_name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  size="sm"
                  className={cn(
                    'rounded-full h-8 px-3 gap-1.5',
                    sendViaChat && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                  )}
                  onClick={handleSubmitComment}
                  disabled={submitting || !draft.trim() || (sendViaChat && !chatRecipientId)}
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : sendViaChat ? (
                    <Send className="h-3.5 w-3.5" />
                  ) : null}
                  {sendViaChat ? 'Enviar' : 'Comentar'}
                </Button>
              </div>

              {sendViaChat && (
                <p className="text-[10px] text-muted-foreground/80 leading-snug pt-0.5">
                  Vais enviar o pedido original + este comentário via chat. O comentário fica também guardado aqui.
                </p>
              )}
            </div>
          </div>

          {/* ─── Notas Técnicas ─── (management-only) */}
          {canManage && (
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
