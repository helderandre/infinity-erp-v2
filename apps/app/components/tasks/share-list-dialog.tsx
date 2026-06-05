'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Search, UserMinus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useTaskListMutations } from '@/hooks/use-task-lists'
import type { TaskListMember } from '@/types/task-list'

interface ShareListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  listName: string
  currentMembers: TaskListMember[]
  ownerId: string
  onChanged: () => void
}

interface Consultant {
  id: string
  commercial_name: string
  profile_photo_url?: string | null
}

export function ShareListDialog({
  open,
  onOpenChange,
  listId,
  listName,
  currentMembers,
  ownerId,
  onChanged,
}: ShareListDialogProps) {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { addMember, removeMember } = useTaskListMutations()

  useEffect(() => {
    if (!open) return
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((data) => setConsultants(data.data || data || []))
      .catch(() => setConsultants([]))
  }, [open])

  const memberIds = useMemo(() => new Set(currentMembers.map((m) => m.user_id)), [currentMembers])

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return consultants
      .filter((c) => c.id !== ownerId)
      .filter((c) => !q || c.commercial_name.toLowerCase().includes(q))
  }, [consultants, search, ownerId])

  const handleAdd = async (userId: string) => {
    setBusyId(userId)
    try {
      await addMember(listId, userId)
      toast.success('Membro adicionado')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (userId: string) => {
    setBusyId(userId)
    try {
      await removeMember(listId, userId)
      toast.success('Membro removido')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover')
    } finally {
      setBusyId(null)
    }
  }

  const initials = (name: string) =>
    name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partilhar "{listName}"</DialogTitle>
          <DialogDescription className="text-xs">
            Os membros podem ver e editar todas as tarefas desta lista.
          </DialogDescription>
        </DialogHeader>

        {/* Current members */}
        {currentMembers.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
              Membros ({currentMembers.length})
            </p>
            <div className="space-y-1">
              {currentMembers.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40 group"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={m.profile_photo_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {initials(m.commercial_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-[13px] truncate">{m.commercial_name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(m.user_id)}
                    disabled={busyId === m.user_id}
                    title="Remover"
                  >
                    {busyId === m.user_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <UserMinus className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add members */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
            Adicionar colega
          </p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-3">
                {search ? 'Nenhum colega encontrado.' : 'Todos os colegas já são membros.'}
              </p>
            )}
            {candidates.map((c) => {
              const isMember = memberIds.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => !isMember && handleAdd(c.id)}
                  disabled={isMember || busyId === c.id}
                  className={cn(
                    'w-full flex items-center gap-2.5 py-1.5 px-2 rounded-md text-left transition-colors',
                    isMember
                      ? 'text-muted-foreground/60 cursor-default'
                      : 'hover:bg-muted/60 cursor-pointer',
                  )}
                >
                  <Avatar className="size-7">
                    <AvatarImage src={c.profile_photo_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {initials(c.commercial_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-[13px] truncate">{c.commercial_name}</span>
                  {isMember ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : busyId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
