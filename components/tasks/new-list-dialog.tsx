'use client'

import { useState } from 'react'
import { Hash, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTaskListMutations } from '@/hooks/use-task-lists'
import { TASK_LIST_COLORS, type TaskListColor } from '@/types/task-list'

interface NewListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (listId?: string) => void
}

export function NewListDialog({ open, onOpenChange, onCreated }: NewListDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<TaskListColor>('neutral')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { create } = useTaskListMutations()

  const submit = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      const created = await create({ name: name.trim(), color })
      toast.success('Lista criada')
      setName('')
      setColor('neutral')
      onOpenChange(false)
      onCreated(created?.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lista')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova lista</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Contabilidade, Marketing..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit() }
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Cor</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(TASK_LIST_COLORS) as [TaskListColor, typeof TASK_LIST_COLORS[TaskListColor]][]).map(([key, c]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  className={cn(
                    'size-7 rounded-full flex items-center justify-center transition-all',
                    'hover:bg-muted/60',
                    color === key && 'ring-2 ring-offset-2 ring-primary/40 bg-muted/40',
                  )}
                  title={c.label}
                >
                  <Hash className={cn('size-4', c.hash)} strokeWidth={2.5} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Criar lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
