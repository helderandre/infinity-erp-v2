'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { FileEdit, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

interface Draft {
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
  onResume: (draftId: string) => void
}

export function DraftsList({ onResume }: DraftsListProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/acquisitions/drafts')
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.data || [])
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (draftId: string) => {
    setDeletingId(draftId)
    try {
      const res = await fetch(`/api/acquisitions/${draftId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao eliminar')
      setDrafts((prev) => prev.filter((d) => d.proc_instance_id !== draftId))
      toast.success('Rascunho eliminado')
    } catch {
      toast.error('Erro ao eliminar rascunho')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (drafts.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Rascunhos
        </h3>
        <Badge variant="secondary">{drafts.length}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drafts.map((draft) => (
          <Card key={draft.proc_instance_id} className="group hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {draft.title === 'Rascunho' ? 'Nova Angariação' : draft.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {draft.property_type && (
                      <Badge variant="outline" className="text-xs">
                        {draft.property_type}
                      </Badge>
                    )}
                    {draft.city && (
                      <span className="text-xs text-muted-foreground">{draft.city}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Passo {draft.last_completed_step} de 5</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(draft.updated_at), { locale: pt, addSuffix: true })}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(draft.last_completed_step / 5) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => onResume(draft.proc_instance_id)}
                >
                  <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                  Retomar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(draft.proc_instance_id)}
                  disabled={deletingId === draft.proc_instance_id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
