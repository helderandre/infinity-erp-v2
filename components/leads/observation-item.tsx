'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Phone, Mail, MessageCircle, StickyNote, MapPin, Briefcase, Zap, MoreHorizontal, Pin, Pencil, Trash2, Loader2, Save, X, CalendarDays, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  sms: MessageCircle,
  note: StickyNote,
  visit: MapPin,
  stage_change: Zap,
  assignment: Briefcase,
}

const TYPE_LABEL: Record<string, string> = {
  call: 'Chamada',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  note: 'Observação',
  visit: 'Visita',
  stage_change: 'Mudança de fase',
  assignment: 'Atribuição',
  system: 'Sistema',
  lifecycle_change: 'Ciclo de vida',
}

const TYPE_COLOR: Record<string, string> = {
  call: 'bg-green-500/10 text-green-600',
  email: 'bg-blue-500/10 text-blue-600',
  whatsapp: 'bg-emerald-500/10 text-emerald-600',
  sms: 'bg-purple-500/10 text-purple-600',
  note: 'bg-amber-500/10 text-amber-600',
  visit: 'bg-rose-500/10 text-rose-600',
}

export interface ObservationActivity {
  id: string
  contact_id: string
  negocio_id?: string | null
  activity_type: string
  direction?: string | null
  subject?: string | null
  description?: string | null
  occurred_at?: string | null
  created_at: string
  is_pinned?: boolean
  created_by_user?: { id: string; commercial_name: string | null } | null
  negocio?: {
    id: string
    tipo?: string | null
    business_type?: string | null
    tipo_imovel?: string | null
    quartos?: number | null
    quartos_min?: number | null
    estado?: string | null
    localizacao?: string | null
  } | null
}

interface ObservationItemProps {
  activity: ObservationActivity
  /** Lead/contact id — used for PATCH/DELETE URLs */
  contactId: string
  /** Hide negocio badge (e.g. when rendering inside a negocio sheet) */
  hideNegocioBadge?: boolean
  onChanged?: () => void
  onNegocioClick?: (negocioId: string) => void
}

export function ObservationItem({
  activity,
  contactId,
  hideNegocioBadge,
  onChanged,
  onNegocioClick,
}: ObservationItemProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const [editText, setEditText] = useState(activity.description ?? '')
  const effective = activity.occurred_at || activity.created_at
  const [editDate, setEditDate] = useState(format(parseISO(effective), 'yyyy-MM-dd'))
  const [editTime, setEditTime] = useState(format(parseISO(effective), 'HH:mm'))

  const Icon = TYPE_ICON[activity.activity_type] ?? StickyNote
  const colorClass = TYPE_COLOR[activity.activity_type] ?? 'bg-muted text-muted-foreground'
  const label = TYPE_LABEL[activity.activity_type] ?? activity.activity_type

  async function patch(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/leads/${contactId}/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao actualizar')
      }
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao actualizar')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit() {
    if (!editText.trim()) {
      toast.error('Conteúdo não pode estar vazio')
      return
    }
    const occurred = new Date(`${editDate}T${editTime || '00:00'}`)
    await patch({
      description: editText.trim(),
      occurred_at: occurred.toISOString(),
    })
    setEditing(false)
    toast.success('Observação actualizada')
  }

  async function handleDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/leads/${contactId}/activities/${activity.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao eliminar')
      }
      setConfirmDelete(false)
      onChanged?.()
      toast.success('Observação eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao eliminar')
    } finally {
      setBusy(false)
    }
  }

  const dateLabel = format(parseISO(effective), "d 'de' MMM yyyy 'às' HH:mm", { locale: pt })

  return (
    <>
      <div
        className={cn(
          'group rounded-2xl border bg-card/50 backdrop-blur-sm px-4 py-3 transition-all hover:bg-card/80',
          activity.is_pinned
            ? 'border-amber-500/40 ring-1 ring-amber-500/20'
            : 'border-border/30',
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', colorClass)}>
            <Icon className="h-3.5 w-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{label}</span>
              {activity.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <Pin className="h-2.5 w-2.5 fill-current" />
                  Fixado
                </span>
              )}
              {!hideNegocioBadge && (
                activity.negocio ? (
                  (() => {
                    // Constrói uma lista de chips: perspectiva, tipo de imóvel,
                    // tipologia (T2+, T3, etc.). Cada um vai num chip próprio
                    // para o consultor perceber rapidamente o contexto sem
                    // abrir o negócio.
                    const n = activity.negocio
                    const chips: string[] = []
                    if (n.tipo) chips.push(n.tipo)
                    if (n.tipo_imovel) chips.push(n.tipo_imovel)
                    const isBuyerSide = n.tipo === 'Comprador' || n.tipo === 'Arrendatário' || n.tipo === 'Compra'
                    const rooms = isBuyerSide ? n.quartos_min : (n.quartos ?? n.quartos_min)
                    if (rooms != null) chips.push(`T${rooms}${isBuyerSide ? '+' : ''}`)
                    return (
                      <button
                        type="button"
                        onClick={() => onNegocioClick?.(n.id)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/15 transition-colors"
                      >
                        <Briefcase className="h-2.5 w-2.5 text-blue-700 dark:text-blue-400" />
                        {chips.length > 0 ? (
                          chips.map((c, i) => (
                            <span
                              key={`${c}-${i}`}
                              className="text-[10px] font-medium text-blue-700 dark:text-blue-400"
                            >
                              {c}{i < chips.length - 1 ? ' ·' : ''}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">Negócio</span>
                        )}
                      </button>
                    )
                  })()
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <User className="h-2.5 w-2.5" />
                    Perfil
                  </span>
                )
              )}
            </div>

            {/* Body — view mode OR edit mode */}
            {editing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
                      >
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(`${editDate}T${editTime || '00:00'}`), 'd MMM, HH:mm')}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 rounded-xl space-y-2" align="start">
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 rounded-full text-xs"
                      onClick={() => setEditing(false)}
                      disabled={busy}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2.5 rounded-full text-xs"
                      onClick={handleSaveEdit}
                      disabled={busy || !editText.trim()}
                    >
                      {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                      Guardar
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {activity.subject && (
                  <p className="text-sm text-foreground mt-0.5">{activity.subject}</p>
                )}
                {activity.description && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {activity.description}
                  </p>
                )}
              </>
            )}

            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span>{dateLabel}</span>
              {activity.created_by_user?.commercial_name && (
                <>
                  <span>·</span>
                  <span>{activity.created_by_user.commercial_name}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions — sempre visíveis no topo do card (não só em hover) */}
          {!editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Acções"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem
                  onClick={() => setEditing(true)}
                  className="text-xs gap-2"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => patch({ is_pinned: !activity.is_pinned })}
                  className="text-xs gap-2"
                >
                  <Pin className={cn('h-3.5 w-3.5', activity.is_pinned && 'fill-current')} />
                  {activity.is_pinned ? 'Desafixar' : 'Fixar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar observação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza? Esta acção não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? 'A eliminar...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
