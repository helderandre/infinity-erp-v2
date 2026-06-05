'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { FileEdit, Trash2, Clock, Plus, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

export interface AcquisitionDraft {
  proc_instance_id: string
  property_id: string
  title: string
  property_type: string | null
  city: string | null
  listing_price: number | null
  last_completed_step: number
  negocio_id: string | null
  created_at: string
  updated_at: string
}

interface DraftsListProps {
  drafts: AcquisitionDraft[]
  onResume: (draftId: string) => void
  onStartNew: () => void
  onDeleted: (draftId: string) => void
}

export function DraftsList({ drafts, onResume, onStartNew, onDeleted }: DraftsListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setDeletingId(id)
    try {
      const res = await fetch(`/api/acquisitions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar')
      onDeleted(id)
      toast.success('Rascunho eliminado')
    } catch {
      toast.error('Erro ao eliminar rascunho')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const hasDrafts = drafts.length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          {hasDrafts ? 'Continuar onde parou?' : 'Pronto para começar'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {hasDrafts
            ? drafts.length === 1
              ? 'Tem um rascunho de angariação por terminar.'
              : `Tem ${drafts.length} rascunhos de angariação por terminar.`
            : 'Sem rascunhos guardados — comece uma nova angariação.'}
        </p>
      </div>

      <Button
        type="button"
        onClick={onStartNew}
        className="w-full rounded-full h-10 text-sm gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Nova angariação
      </Button>

      {hasDrafts && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              ou retomar
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
        </>
      )}

      <div className="space-y-2.5">
        {drafts.map((draft) => {
          const isDeleting = deletingId === draft.proc_instance_id
          return (
            <Card
              key={draft.proc_instance_id}
              className="group transition-shadow hover:shadow-md"
            >
              <CardContent className="p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onResume(draft.proc_instance_id)}
                    disabled={isDeleting}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium text-sm truncate">
                      {draft.title === 'Rascunho' || !draft.title
                        ? 'Nova angariação'
                        : draft.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {draft.property_type && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                          {draft.property_type}
                        </Badge>
                      )}
                      {draft.city && (
                        <span className="text-[11px] text-muted-foreground">{draft.city}</span>
                      )}
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDeleteId(draft.proc_instance_id)}
                    disabled={isDeleting}
                    aria-label="Eliminar rascunho"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Passo {draft.last_completed_step} de 5</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(draft.updated_at), {
                      locale: pt,
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(draft.last_completed_step / 5) * 100}%` }}
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8 rounded-full"
                  onClick={() => onResume(draft.proc_instance_id)}
                  disabled={isDeleting}
                >
                  <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                  Retomar
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este rascunho? Esta acção é irreversível
              e todo o trabalho não submetido será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
